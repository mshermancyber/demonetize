/*
 * This file is part of Demonitize.
 * Copyright (C) 2026 Mark Sherman
 *
 * Demonitize is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * Demonitize is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { AdSdkFinding, CodeLocation, ManifestEntry, PatchResult, AiAnalysis, Job } from '../types';
import { getJobDir, getOutputPath, readTextFile, writeTextFile, findFiles, fileExists } from '../services/fileManager';
import { updateJobStatus, updateJobResults } from '../database';
import { detectAdSdksInBinary, detectAdUrls, IOS_AD_SDKS } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

export async function runIpaPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const ipaPath = path.join(jobDir, '..', '..', 'uploads', job.filename);
  
  try {
    // Step 1: Extract IPA (it's a ZIP containing a Payload folder)
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');
    
    try {
      const zip = new AdmZip(ipaPath);
      zip.extractAllTo(extractDir, true);
    } catch (e: any) {
      throw new Error(`Failed to extract IPA: ${e.message}`);
    }

    // Find the .app bundle
    const payloadDir = path.join(extractDir, 'Payload');
    let appBundle: string | null = null;
    if (fs.existsSync(payloadDir)) {
      const entries = fs.readdirSync(payloadDir);
      appBundle = entries.find(e => e.endsWith('.app')) || null;
      if (appBundle) {
        appBundle = path.join(payloadDir, appBundle);
      }
    }

    if (!appBundle) {
      throw new Error('No .app bundle found in IPA Payload');
    }

    // Step 2: Scan for ad frameworks
    updateJobStatus(job.id, 'scanning');

    // Scan Info.plist
    const plistPath = path.join(appBundle, 'Info.plist');
    const plistContent = fileExists(plistPath) ? readTextFile(plistPath) : '';

    // Collect all strings from the binary and frameworks
    let allContent = plistContent;
    
    // Find the main binary
    const appName = path.basename(appBundle, '.app');
    const binaryPath = path.join(appBundle, appName);
    
    if (fileExists(binaryPath)) {
      try {
        const binaryBuf = fs.readFileSync(binaryPath);
        const readable = binaryBuf.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '');
        allContent += '\n' + readable.slice(0, 500000);
      } catch {}
    }

    // Scan embedded frameworks
    const frameworksDir = path.join(appBundle, 'Frameworks');
    if (fs.existsSync(frameworksDir)) {
      const frameworkEntries = fs.readdirSync(frameworksDir);
      for (const entry of frameworkEntries) {
        if (entry.endsWith('.framework')) {
          const fwBinary = path.join(frameworksDir, entry, entry.replace('.framework', ''));
          if (fileExists(fwBinary)) {
            try {
              const fwBuf = fs.readFileSync(fwBinary);
              const readable = fwBuf.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '');
              allContent += '\n' + readable.slice(0, 100000);
            } catch {}
          }
        }
      }
    }

    // Detect ad SDKs
    const sdkDetections = detectAdSdksInBinary(allContent);
    const adUrls = detectAdUrls(allContent);

    const adFindings: AdSdkFinding[] = [];
    for (const det of sdkDetections) {
      // Avoid duplicate SDK entries
      if (adFindings.some(f => f.sdkName === det.sdk.name)) continue;
      
      adFindings.push({
        sdkName: det.sdk.name,
        packagePattern: det.sdk.packagePatterns[0] || det.sdk.name,
        detectedIn: [appName, ...det.matches.map(m => `pattern:${m}`)],
        codeLocations: det.matches.map(m => ({
          file: appName,
          line: 0,
          snippet: m,
          type: 'initialization' as const,
        })),
        manifestEntries: [],
      });
    }

    // Check Info.plist for ad-related entries
    const plistAdEntries: ManifestEntry[] = [];
    
    // GADApplicationIdentifier (Google AdMob)
    if (plistContent.includes('GADApplicationIdentifier')) {
      plistAdEntries.push({ type: 'meta-data', name: 'GADApplicationIdentifier', line: 0 });
    }
    // Facebook AdvertiserIDCollection
    if (plistContent.includes('FacebookAdvertiserIDCollectionEnabled')) {
      plistAdEntries.push({ type: 'meta-data', name: 'FacebookAdvertiserIDCollectionEnabled', line: 0 });
    }
    // SKAdNetwork items (ad attribution)
    if (plistContent.includes('SKAdNetworkItems') || plistContent.includes('SKAdNetworkIdentifier')) {
      plistAdEntries.push({ type: 'meta-data', name: 'SKAdNetworkItems (ad attribution)', line: 0 });
    }

    if (plistAdEntries.length > 0 && adFindings.length > 0) {
      adFindings[0].manifestEntries = plistAdEntries;
    }

    // Check for ad-related URL schemes and ATS exceptions
    if (plistContent.includes('NSAppTransportSecurity')) {
      const atsSection = plistContent.match(/<key>NSAppTransportSecurity<\/key>[\s\S]*?<\/dict>/);
      if (atsSection) {
        const atsContent = atsSection[0];
        // Check if ATS exceptions include ad domains
        for (const sdk of IOS_AD_SDKS) {
          for (const url of sdk.urlPatterns) {
            if (atsContent.includes(url)) {
              const existing = adFindings.find(f => f.sdkName === sdk.name);
              if (existing) {
                existing.manifestEntries.push({
                  type: 'meta-data',
                  name: `ATS exception for ${url}`,
                  line: 0,
                });
              }
            }
          }
        }
      }
    }

    updateJobResults(job.id, { adSdksFound: adFindings });

    // Step 3: AI Analysis
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];

    for (const finding of adFindings.slice(0, 5)) {
      const relevantContent = allContent.slice(0, 6000);
      const analysis = await analyzeAdCode(
        finding.sdkName,
        relevantContent,
        plistContent.slice(0, 4000),
        'ios'
      );
      aiAnalyses.push(analysis);
    }

    updateJobResults(job.id, { aiAnalyses });

    // Step 4: Apply patches
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    // Patch Info.plist: remove ad-related entries
    if (plistContent && adFindings.length > 0) {
      try {
        let patchedPlist = plistContent;
        
        // Remove GADApplicationIdentifier
        patchedPlist = patchedPlist.replace(
          /<key>GADApplicationIdentifier<\/key>\s*\n\s*<string>[^<]*<\/string>/g,
          '<!-- GADApplicationIdentifier removed by Demonitize -->'
        );
        
        // Remove FacebookAdvertiserIDCollectionEnabled
        patchedPlist = patchedPlist.replace(
          /<key>FacebookAdvertiserIDCollectionEnabled<\/key>\s*\n\s*<(?:true|false)\/>/g,
          '<!-- FacebookAdvertiserIDCollectionEnabled removed by Demonitize -->'
        );

        // Remove SKAdNetworkItems
        patchedPlist = patchedPlist.replace(
          /<key>SKAdNetworkItems<\/key>\s*\n\s*<array>[\s\S]*?<\/array>/g,
          '<!-- SKAdNetworkItems removed by Demonitize -->'
        );

        // Clean up ATS exceptions for ad domains
        for (const finding of adFindings) {
          for (const sdk of IOS_AD_SDKS) {
            if (finding.sdkName === sdk.name) {
              for (const url of sdk.urlPatterns) {
                const escapedUrl = url.replace(/\./g, '\\.');
                const atsRegex = new RegExp(`<key>NSExceptionDomains<\\/key>[\\s\\S]*?<key>${escapedUrl}<\\/key>[\\s\\S]*?<\\/dict>[\\s\\S]*?<\\/dict>`, 'g');
                patchedPlist = patchedPlist.replace(atsRegex, '<!-- ATS exception removed by Demonitize -->');
              }
            }
          }
        }

        writeTextFile(plistPath, patchedPlist);
        patchesApplied.push({
          sdkName: 'iOS Ad SDKs',
          filePatched: 'Info.plist',
          change: 'Removed ad-related Info.plist entries (GADApplicationIdentifier, FacebookAdvertiserIDCollection, SKAdNetworkItems, ATS ad exceptions)',
          success: true,
        });
      } catch (e: any) {
        patchesApplied.push({
          sdkName: 'iOS Ad SDKs',
          filePatched: 'Info.plist',
          change: 'Failed to patch Info.plist',
          success: false,
          error: e.message,
        });
      }
    }

    // Remove ad frameworks from the bundle
    const adFrameworkNames = [
      'GoogleMobileAds', 'FBAudienceNetwork', 'UnityAds', 'AppLovinSDK',
      'IronSource', 'VungleSDK', 'AdColony', 'Chartboost', 'InMobiSDK',
    ];

    if (fs.existsSync(frameworksDir)) {
      for (const fwName of adFrameworkNames) {
        const fwPath = path.join(frameworksDir, `${fwName}.framework`);
        const dsymPath = path.join(frameworksDir, `${fwName}.framework.dSYM`);
        
        if (fs.existsSync(fwPath)) {
          try {
            fs.rmSync(fwPath, { recursive: true, force: true });
            patchesApplied.push({
              sdkName: fwName,
              filePatched: `Frameworks/${fwName}.framework`,
              change: 'Removed ad framework bundle',
              success: true,
            });
          } catch (e: any) {
            patchesApplied.push({
              sdkName: fwName,
              filePatched: `Frameworks/${fwName}.framework`,
              change: 'Failed to remove',
              success: false,
              error: e.message,
            });
          }
        }
        
        // Also clean up dSYM if present
        if (fs.existsSync(dsymPath)) {
          try {
            fs.rmSync(dsymPath, { recursive: true, force: true });
          } catch {}
        }
      }
    }

    updateJobResults(job.id, { patchesApplied });

    // Step 5: Re-package IPA
    updateJobStatus(job.id, 'rebuilding');
    
    try {
      const outputPath = getOutputPath(job.id, job.originalName);
      const repackagedZip = new AdmZip();
      
      // Add Payload directory back
      const payloadEntries = fs.readdirSync(extractDir);
      for (const entry of payloadEntries) {
        const fullPath = path.join(extractDir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          repackagedZip.addLocalFolder(fullPath, entry);
        } else {
          repackagedZip.addLocalFile(fullPath);
        }
      }
      
      repackagedZip.writeZip(outputPath);
      
      patchesApplied.push({
        sdkName: 'IPA Repackaging',
        filePatched: 'IPA bundle',
        change: 'Re-packaged IPA with ad frameworks and plist entries removed. NOTE: This IPA will need to be re-signed with your own provisioning profile before installation.',
        success: true,
      });
      
      updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
      updateJobStatus(job.id, 'completed');
    } catch (e: any) {
      throw new Error(`Failed to repackage IPA: ${e.message}`);
    }

  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
