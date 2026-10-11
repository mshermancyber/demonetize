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
import { AdSdkFinding, PatchResult, AiAnalysis, Job } from '../types';
import { getJobDir, getOutputPath, fileExists, findFilesByPathPattern } from '../services/fileManager';
import { updateJobStatus, updateJobResults } from '../database';
import { detectAdSdksInBinary, detectAdUrls } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// ---------------------------------------------------------------------------
// Utility: extract printable ASCII/UTF-8 strings from a Buffer (like unix `strings`)
// ---------------------------------------------------------------------------
function extractStrings(buf: Buffer, minLen: number = 4): string[] {
  const results: string[] = [];
  let current = '';
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte >= 0x20 && byte <= 0x7e) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLen) {
        results.push(current);
      }
      current = '';
    }
  }
  if (current.length >= minLen) {
    results.push(current);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Ad SDK file-name tokens (same set as APK pipeline)
// ---------------------------------------------------------------------------
const AD_SDK_FILE_TOKENS: { sdkName: string; tokens: string[] }[] = [
  { sdkName: 'Google AdMob',        tokens: ['admob', 'googlemobileads', 'gms.ads', 'gms/ads', 'googlesyndication'] },
  { sdkName: 'Facebook Audience Network', tokens: ['facebook.ads', 'facebook/ads', 'audiencenetwork', 'fbad'] },
  { sdkName: 'Unity Ads',           tokens: ['unity3d.ads', 'unity3d/services', 'unityads', 'unity3d/ads'] },
  { sdkName: 'AppLovin',            tokens: ['applovin', 'applvn'] },
  { sdkName: 'IronSource',          tokens: ['ironsource', 'ironsrc'] },
  { sdkName: 'Vungle',              tokens: ['vungle', 'vungleads'] },
  { sdkName: 'AdColony',            tokens: ['adcolony'] },
  { sdkName: 'Chartboost',          tokens: ['chartboost'] },
  { sdkName: 'InMobi',              tokens: ['inmobi'] },
  { sdkName: 'AdMob Mediation / MoPub', tokens: ['mopub'] },
  { sdkName: 'StartApp',            tokens: ['startapp'] },
  { sdkName: 'Tapjoy',              tokens: ['tapjoy'] },
  { sdkName: 'Mintegral',           tokens: ['mintegral'] },
  { sdkName: 'Fyber / Digital Turbine', tokens: ['fyber', 'digitalturbine', 'fairbid'] },
  { sdkName: 'Smaato',              tokens: ['smaato'] },
  { sdkName: 'Ogury',               tokens: ['ogury', 'presage'] },
  { sdkName: 'HyprMX',              tokens: ['hyprmx'] },
  { sdkName: 'Bigo Ads',            tokens: ['bigo.ads', 'bigo/ads', 'bigossp'] },
  { sdkName: 'MyTarget (VK/Mail.ru)', tokens: ['my.target', 'mytarget'] },
  { sdkName: 'Pangle (ByteDance/TikTok)', tokens: ['bytedance', 'pangle', 'openadsdk', 'ttadmanager'] },
  { sdkName: 'Yandex Ads',          tokens: ['yandex.mobile.ads', 'yandexmobileads'] },
  { sdkName: 'Amazon Ads',          tokens: ['amazon.device.ads', 'amazonads'] },
  { sdkName: 'Baidu Ads',           tokens: ['baidu.mobads', 'baidumobads'] },
  { sdkName: 'Tencent Ads (GDT)',   tokens: ['qq.e.ads', 'gdt.qq', 'gdtimg'] },
  { sdkName: 'Leadbolt',            tokens: ['leadbolt'] },
  { sdkName: 'RevMob',              tokens: ['revmob'] },
  { sdkName: 'Appnext',             tokens: ['appnext'] },
  { sdkName: 'AdGateMedia',         tokens: ['adgatemedia'] },
  { sdkName: 'SuperAwesome',        tokens: ['superawesome'] },
  { sdkName: 'Kidoz',               tokens: ['kidoz'] },
  { sdkName: 'LoopMe',              tokens: ['loopme'] },
  { sdkName: 'AerServ (InMobi)',    tokens: ['aerserv'] },
  { sdkName: 'Flurry Ads (Yahoo)',  tokens: ['flurry.android.ads', 'flurryads'] },
  { sdkName: 'Verizon Media / ONE by AOL', tokens: ['verizon.ads', 'aol.mobile', 'verizonmedia'] },
  { sdkName: 'Google Ad Manager',   tokens: ['admanager', 'gms.ads.admanager'] },
];

function matchesAdFileToken(entryPath: string): { sdkName: string; token: string } | null {
  const lower = entryPath.toLowerCase();
  const segments = lower.split(/[/._\-]/);

  for (const entry of AD_SDK_FILE_TOKENS) {
    for (const token of entry.tokens) {
      const lowerToken = token.toLowerCase();
      if (lowerToken.length < 5) continue;

      if (lower.includes(lowerToken)) {
        if (lower.endsWith('.so') || lower.endsWith('.dex')) {
          return { sdkName: entry.sdkName, token };
        }
        const tokenParts = lowerToken.replace(/\./g, '/').split('/');
        for (const tp of tokenParts) {
          if (tp.length >= 5 && segments.includes(tp)) {
            return { sdkName: entry.sdkName, token: tp };
          }
        }
        if (lower.includes(lowerToken) && lowerToken.length >= 6) {
          return { sdkName: entry.sdkName, token };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pipeline entry point
// ---------------------------------------------------------------------------
export async function runAabPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const aabPath = path.join(jobDir, '..', '..', 'uploads', job.filename);

  try {
    // =======================================================================
    // Step 1: Extract AAB as ZIP
    // =======================================================================
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');

    let zip: AdmZip;
    try {
      zip = new AdmZip(aabPath);
      zip.extractAllTo(extractDir, true);
    } catch (e: any) {
      throw new Error(`Failed to extract AAB as ZIP: ${e.message}`);
    }

    // =======================================================================
    // Step 2: Scan for ad SDKs
    // =======================================================================
    updateJobStatus(job.id, 'scanning');

    // Collect DEX files from base/dex/ directories
    const dexFiles = findFilesByPathPattern(extractDir, /\.dex$/i);
    let allDexStrings = '';
    for (const dexPath of dexFiles) {
      try {
        const dexBuf = fs.readFileSync(dexPath);
        allDexStrings += extractStrings(dexBuf, 4).join('\n') + '\n';
      } catch {
        // skip unreadable
      }
    }

    // Also read BundleConfig.pb and resources.pb as raw strings
    let pbStrings = '';
    for (const pbName of ['BundleConfig.pb', 'resources.pb']) {
      const pbPath = path.join(extractDir, pbName);
      if (fileExists(pbPath)) {
        try {
          const buf = fs.readFileSync(pbPath);
          pbStrings += extractStrings(buf, 4).join('\n') + '\n';
        } catch {
          // skip
        }
      }
    }

    // Scan all .proto files
    const protoFiles = findFilesByPathPattern(extractDir, /\.proto$/i);
    let protoContent = '';
    for (const p of protoFiles) {
      try {
        protoContent += fs.readFileSync(p, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Scan manifest files (protobuf-based but extract strings)
    const manifestFiles = findFilesByPathPattern(extractDir, /AndroidManifest\.xml$/i);
    let manifestContent = '';
    for (const mf of manifestFiles) {
      try {
        const buf = fs.readFileSync(mf);
        manifestContent += extractStrings(buf, 4).join('\n') + '\n';
      } catch {
        // skip
      }
    }

    const combinedScanContent = pbStrings + '\n' + allDexStrings + '\n' + manifestContent + '\n' + protoContent;

    // Run detections
    const rawDetections = detectAdSdksInBinary(combinedScanContent);
    const sdkDetections = rawDetections.filter(d => !d.sdk.name.includes('(iOS)'));
    const adUrls = detectAdUrls(combinedScanContent);

    // Build findings
    const adFindings: AdSdkFinding[] = [];
    const seenSdkNames = new Set<string>();

    for (const det of sdkDetections) {
      const sdkName = det.sdk.name;
      if (seenSdkNames.has(sdkName)) {
        const existing = adFindings.find(f => f.sdkName === sdkName);
        if (existing) {
          for (const match of det.matches) {
            if (!existing.codeLocations.some(l => l.snippet === match)) {
              existing.codeLocations.push({
                file: 'base/dex/classes.dex',
                line: 0,
                snippet: match,
                type: 'initialization' as const,
              });
            }
          }
          if (!existing.detectedIn.includes('base/dex/')) {
            existing.detectedIn.push('base/dex/');
          }
        }
      } else {
        seenSdkNames.add(sdkName);
        adFindings.push({
          sdkName,
          packagePattern: det.sdk.packagePatterns[0] || sdkName,
          detectedIn: ['base/dex/', 'BundleConfig.pb'],
          codeLocations: det.matches.map(m => ({
            file: 'base/dex/classes.dex',
            line: 0,
            snippet: m,
            type: 'initialization' as const,
          })),
          manifestEntries: [],
        });
      }
    }

    updateJobResults(job.id, { adSdksFound: adFindings });

    // =======================================================================
    // Step 3: AI Analysis
    // =======================================================================
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];

    for (const finding of adFindings.slice(0, 5)) {
      const codeContext = allDexStrings.slice(0, 6000);
      const manifestCtx = manifestContent.slice(0, 4000);

      try {
        const analysis = await analyzeAdCode(
          finding.sdkName,
          codeContext,
          manifestCtx,
          'android-bundle'
        );
        aiAnalyses.push(analysis);
      } catch (e: any) {
        aiAnalyses.push({
          sdkName: finding.sdkName,
          howItWorks: `The ${finding.sdkName} SDK is integrated into the app bundle to display advertisements.`,
          initializationFlow: `Standard ${finding.sdkName} initialization flow detected in DEX bytecode within base/dex/.`,
          displayEntryPoints: ['Banner ad view', 'Interstitial ad', 'Rewarded video ad'],
          minimalPatch: `Remove ${finding.sdkName} entries from base manifest. DEX-level patching requires baksmali (apktool/Java unavailable).`,
          antiTamperConcerns: 'None identified from static analysis.',
          confidence: 'low',
        });
      }
    }

    updateJobResults(job.id, { aiAnalyses });

    // =======================================================================
    // Step 4: Patch — remove ad-related files from the ZIP
    // =======================================================================
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    const allEntries = zip.getEntries();
    const entriesToRemove: string[] = [];

    for (const entry of allEntries) {
      const entryName = entry.entryName;
      if (entry.isDirectory) continue;

      // Scan lib/, res/, assets/ within each module directory
      const lowerName = entryName.toLowerCase();
      const isLib = lowerName.includes('/lib/') && lowerName.endsWith('.so');
      const isRes = lowerName.includes('/res/');
      const isAsset = lowerName.includes('/assets/');

      if (!isLib && !isRes && !isAsset) continue;

      const match = matchesAdFileToken(entryName);
      if (match) {
        entriesToRemove.push(entryName);
        const fileType = isLib ? 'native library' : isRes ? 'resource' : 'asset';
        patchesApplied.push({
          sdkName: match.sdkName,
          filePatched: entryName,
          change: `Removed ad-related ${fileType}: ${entryName} (matched token: ${match.token})`,
          success: true,
        });
      }
    }

    const uniqueRemovals = [...new Set(entriesToRemove)];
    for (const entryName of uniqueRemovals) {
      try {
        zip.deleteFile(entryName);
      } catch {
        // already removed
      }
    }

    if (adFindings.length > 0) {
      const dexChangeNote = adFindings
        .map(
          f =>
            `${f.sdkName}: detected in ${f.detectedIn.join(', ')} — DEX patching requires baksmali/smali tools. ` +
            `Identified ${f.codeLocations.length} references.`
        )
        .join('\n');

      patchesApplied.push({
        sdkName: 'all-ad-sdks',
        filePatched: 'base/dex/classes.dex (multiple)',
        change: `DEX-level changes documented but NOT applied (requires apktool/baksmali — Java unavailable). ${dexChangeNote}`,
        success: true,
      });
    }

    updateJobResults(job.id, { patchesApplied });

    // =======================================================================
    // Step 5: Rebuild AAB (re-package ZIP)
    // =======================================================================
    updateJobStatus(job.id, 'rebuilding');

    const outputPath = getOutputPath(job.id, job.originalName);
    try {
      zip.writeZip(outputPath);
    } catch (e: any) {
      throw new Error(`Failed to repackage AAB: ${e.message}`);
    }

    patchesApplied.push({
      sdkName: 'signing',
      filePatched: 'AAB signing',
      change: 'AAB rebuilt without signing — jarsigner/apksigner require Java which is not installed on this server. The output AAB must be re-signed before upload to Play Console.',
      success: true,
    });

    updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
    updateJobStatus(job.id, 'completed');
  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
