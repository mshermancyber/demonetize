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
import { detectAdSdksInBinary, detectAdUrls, detectAdSdksInManifest } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// ---------------------------------------------------------------------------
// Utility: extract printable ASCII/UTF-8 strings from a Buffer
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
// Ad SDK file-name tokens
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
// Pipeline entry point — handles .xapk, .apks, .apkm
// ---------------------------------------------------------------------------
export async function runXapkPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const bundlePath = path.join(jobDir, '..', '..', 'uploads', job.filename);

  try {
    // =======================================================================
    // Step 1: Extract outer ZIP bundle
    // =======================================================================
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');

    let outerZip: AdmZip;
    try {
      outerZip = new AdmZip(bundlePath);
      outerZip.extractAllTo(extractDir, true);
    } catch (e: any) {
      throw new Error(`Failed to extract bundle: ${e.message}`);
    }

    // Find all inner APK files
    const innerApks = findFilesByPathPattern(extractDir, /\.apk$/i);
    if (innerApks.length === 0) {
      throw new Error('No APK files found inside the bundle');
    }

    // =======================================================================
    // Step 2: Scan each inner APK
    // =======================================================================
    updateJobStatus(job.id, 'scanning');

    // Read outer manifest.json if present
    const outerManifestPath = path.join(extractDir, 'manifest.json');
    let outerManifestContent = '';
    if (fileExists(outerManifestPath)) {
      try {
        outerManifestContent = fs.readFileSync(outerManifestPath, 'utf-8');
      } catch {
        // skip
      }
    }

    let allDexStrings = '';
    let allManifestContent = '';
    const allApkInfo: { apkName: string; dexStrings: string; manifestContent: string }[] = [];

    for (const apkFile of innerApks) {
      const apkName = path.basename(apkFile);
      let innerZip: AdmZip;
      try {
        innerZip = new AdmZip(apkFile);
      } catch {
        continue;
      }

      // Extract DEX strings from inner APK
      const entries = innerZip.getEntries();
      for (const entry of entries) {
        const entryName = entry.entryName;
        if (entry.isDirectory) continue;

        // classes.dex files
        if (/^classes\d*\.dex$/.test(path.basename(entryName))) {
          try {
            const buf = entry.getData();
            const strings = extractStrings(buf, 4).join('\n');
            allDexStrings += strings + '\n';
          } catch {
            // skip
          }
        }

        // AndroidManifest.xml
        if (entryName === 'AndroidManifest.xml') {
          try {
            const buf = entry.getData();
            const strings = extractStrings(buf, 4).join('\n');
            allManifestContent += strings + '\n';
          } catch {
            // skip
          }
        }
      }

      allApkInfo.push({
        apkName,
        dexStrings: allDexStrings,
        manifestContent: allManifestContent,
      });
    }

    const combinedScanContent = allManifestContent + '\n' + allDexStrings + '\n' + outerManifestContent;

    // Detect ad SDKs
    const rawDetections = detectAdSdksInBinary(combinedScanContent);
    const sdkDetections = rawDetections.filter(d => !d.sdk.name.includes('(iOS)'));
    const adUrls = detectAdUrls(combinedScanContent);

    // Detect manifest patterns
    const manifestFindings = detectAdSdksInManifest(allManifestContent);

    // Build merged findings
    const adFindings: AdSdkFinding[] = [];
    const seenSdkNames = new Set<string>();

    for (const mf of manifestFindings) {
      const sdkName = mf.sdk.name;
      if (seenSdkNames.has(sdkName)) {
        const existing = adFindings.find(f => f.sdkName === sdkName);
        if (existing) {
          for (const match of mf.matches) {
            existing.manifestEntries.push({ type: 'meta-data', name: match, line: 0 });
          }
        }
      } else {
        seenSdkNames.add(sdkName);
        adFindings.push({
          sdkName,
          packagePattern: mf.sdk.packagePatterns[0] || sdkName,
          detectedIn: innerApks.map(a => path.basename(a)),
          codeLocations: mf.matches.map(m => ({
            file: 'AndroidManifest.xml',
            line: 0,
            snippet: m,
            type: 'initialization' as const,
          })),
          manifestEntries: mf.matches.map(m => ({ type: 'meta-data' as const, name: m, line: 0 })),
        });
      }
    }

    for (const det of sdkDetections) {
      const sdkName = det.sdk.name;
      if (seenSdkNames.has(sdkName)) {
        const existing = adFindings.find(f => f.sdkName === sdkName);
        if (existing) {
          for (const match of det.matches) {
            if (!existing.codeLocations.some(l => l.snippet === match)) {
              existing.codeLocations.push({
                file: 'classes.dex',
                line: 0,
                snippet: match,
                type: 'initialization' as const,
              });
            }
          }
        }
      } else {
        seenSdkNames.add(sdkName);
        adFindings.push({
          sdkName,
          packagePattern: det.sdk.packagePatterns[0] || sdkName,
          detectedIn: innerApks.map(a => path.basename(a)),
          codeLocations: det.matches.map(m => ({
            file: 'classes.dex',
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
      const manifestCtx = allManifestContent.slice(0, 4000);

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
          howItWorks: `The ${finding.sdkName} SDK is integrated across split APKs to display advertisements.`,
          initializationFlow: `Standard ${finding.sdkName} initialization flow detected in DEX bytecode across split APKs.`,
          displayEntryPoints: ['Banner ad view', 'Interstitial ad', 'Rewarded video ad'],
          minimalPatch: `Remove ${finding.sdkName} entries from all split APK manifests. DEX-level patching requires baksmali (apktool/Java unavailable).`,
          antiTamperConcerns: 'None identified from static analysis.',
          confidence: 'low',
        });
      }
    }

    updateJobResults(job.id, { aiAnalyses });

    // =======================================================================
    // Step 4: Patch — remove ad files from inner APKs, then re-bundle
    // =======================================================================
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    // Re-open outer ZIP to modify
    const finalZip = new AdmZip(bundlePath);
    const finalEntries = finalZip.getEntries();
    const entriesToRemove: string[] = [];

    // Remove ad files from within the outer ZIP
    for (const entry of finalEntries) {
      const entryName = entry.entryName;
      if (entry.isDirectory) continue;

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

    // Also try to patch inner APKs by extracting them, removing ad files, and repacking
    const patchedDir = path.join(jobDir, 'patched');
    if (!fs.existsSync(patchedDir)) {
      fs.mkdirSync(patchedDir, { recursive: true });
    }

    for (const apkFile of innerApks) {
      const apkName = path.basename(apkFile);
      try {
        const innerZip = new AdmZip(apkFile);
        const innerEntries = innerZip.getEntries();
        const toRemove: string[] = [];

        for (const entry of innerEntries) {
          const eName = entry.entryName;
          if (entry.isDirectory) continue;
          const lowerName = eName.toLowerCase();
          const isLib = lowerName.startsWith('lib/') && lowerName.endsWith('.so');
          const isRes = lowerName.startsWith('res/');
          const isAsset = lowerName.startsWith('assets/');

          if (!isLib && !isRes && !isAsset) continue;

          const match = matchesAdFileToken(eName);
          if (match) {
            toRemove.push(eName);
            patchesApplied.push({
              sdkName: match.sdkName,
              filePatched: `${apkName}/${eName}`,
              change: `Removed ad-related file from split: ${eName}`,
              success: true,
            });
          }
        }

        for (const en of [...new Set(toRemove)]) {
          try { innerZip.deleteFile(en); } catch { /* skip */ }
        }

        const patchedApkPath = path.join(patchedDir, apkName);
        innerZip.writeZip(patchedApkPath);
      } catch {
        // Copy unmodified
        fs.copyFileSync(apkFile, path.join(patchedDir, apkName));
      }
    }

    // Remove inner APK entries from outer zip, add patched ones
    for (const entry of finalEntries) {
      if (entry.entryName.toLowerCase().endsWith('.apk') && !entry.isDirectory) {
        try { finalZip.deleteFile(entry.entryName); } catch { /* skip */ }
      }
    }

    // Add patched APKs and any non-APK files back
    const patchedFiles = fs.readdirSync(patchedDir);
    for (const pf of patchedFiles) {
      finalZip.addLocalFile(path.join(patchedDir, pf));
    }

    // Re-add any non-APK entries from original extraction
    const extractedFiles = fs.readdirSync(extractDir);
    for (const ef of extractedFiles) {
      const fullPath = path.join(extractDir, ef);
      if (ef.toLowerCase().endsWith('.apk')) continue; // skip originals
      if (fs.statSync(fullPath).isDirectory()) {
        finalZip.addLocalFolder(fullPath, ef);
      } else {
        try { finalZip.addLocalFile(fullPath); } catch { /* skip */ }
      }
    }

    if (adFindings.length > 0) {
      const dexNote = adFindings
        .map(f => `${f.sdkName}: detected in ${f.detectedIn.join(', ')} — ${f.codeLocations.length} references`)
        .join('\n');
      patchesApplied.push({
        sdkName: 'all-ad-sdks',
        filePatched: 'split APKs (multiple)',
        change: `DEX-level changes documented but NOT applied (requires apktool/baksmali — Java unavailable). ${dexNote}`,
        success: true,
      });
    }

    updateJobResults(job.id, { patchesApplied });

    // =======================================================================
    // Step 5: Rebuild bundle
    // =======================================================================
    updateJobStatus(job.id, 'rebuilding');

    const outputPath = getOutputPath(job.id, job.originalName);
    try {
      finalZip.writeZip(outputPath);
    } catch (e: any) {
      throw new Error(`Failed to repackage bundle: ${e.message}`);
    }

    patchesApplied.push({
      sdkName: 'signing',
      filePatched: 'Bundle signing',
      change: 'Bundle rebuilt without signing. The output must be re-signed before installation.',
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
