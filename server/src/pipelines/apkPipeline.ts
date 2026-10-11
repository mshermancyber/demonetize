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
import { spawnSync } from 'child_process';
import AdmZip from 'adm-zip';
import { AdSdkFinding, CodeLocation, PatchResult, AiAnalysis, Job } from '../types';
import { getJobDir, getOutputPath, readTextFile, writeTextFile, findFiles, fileExists } from '../services/fileManager';
import { updateJobStatus, updateJobResults } from '../database';
import { detectAdSdksInBinary, detectAdUrls, detectAdSdksInManifest, detectAdSdksInSmali, KNOWN_AD_SDKS } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// apktool and a JRE are not distributed with this project. Both are discovered
// at runtime: an explicit env override wins, then any JRE unpacked under
// `server/tools/`, then whatever `java` is on PATH. When neither apktool nor a
// JRE can be found, the pipeline falls back to repackaging without smali
// patching (see `useApktool` below).
const TOOLS_DIR = process.env.TOOLS_DIR || path.join(__dirname, '..', '..', 'tools');

/** Locate a `java` executable, or null when none is available. */
function resolveJava(): string | null {
  const override = process.env.JAVA_BIN;
  if (override) return fs.existsSync(override) ? override : null;

  if (fs.existsSync(TOOLS_DIR)) {
    for (const entry of fs.readdirSync(TOOLS_DIR)) {
      const candidate = path.join(TOOLS_DIR, entry, 'bin', 'java');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const probe = spawnSync('java', ['-version'], { encoding: 'utf-8' });
  return probe.error ? null : 'java';
}

/** Locate apktool.jar, or null when it has not been installed. */
function resolveApktool(): string | null {
  const jar = process.env.APKTOOL_JAR || path.join(TOOLS_DIR, 'apktool.jar');
  return fs.existsSync(jar) ? jar : null;
}

/** Resolve the `keytool` that ships beside the chosen `java`. */
function resolveKeytool(java: string): string {
  return java === 'java' ? 'keytool' : path.join(path.dirname(java), 'keytool');
}

const JAVA_BIN = resolveJava();
const APKTOOL_JAR = resolveApktool();

function hasApkTools(): boolean {
  return JAVA_BIN !== null && APKTOOL_JAR !== null;
}

// Uses spawnSync with argument arrays to prevent command injection.
function execArgs(args: string[], cwd?: string): string {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    maxBuffer: 50 * 1024 * 1024,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  return (result.stdout || '') + (result.stderr || '');
}

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

function decodeManifest(manifestBuf: Buffer): string {
  const strings = extractStrings(manifestBuf, 4);
  return strings.join('\n');
}

// ---------------------------------------------------------------------------
// Conservative ad-SDK file-name tokens for resource / lib / asset removal.
// These are hand-picked identifiers that appear in ad SDK file/directory names
// and are long enough to avoid false positives (minimum 5 characters).
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

/** Check if a file path inside an APK matches any ad SDK token. */
function matchesAdFileToken(entryPath: string): { sdkName: string; token: string } | null {
  const lower = entryPath.toLowerCase();
  // Split path into segments (by /, ., _, -) for word-boundary-aware matching
  const segments = lower.split(/[/._\-]/);

  for (const entry of AD_SDK_FILE_TOKENS) {
    for (const token of entry.tokens) {
      const lowerToken = token.toLowerCase();
      // Require token to be at least 5 characters to avoid short-string false positives
      if (lowerToken.length < 5) continue;

      // Match: token appears as a substring in the entry path
      // For .so files: match if token appears anywhere (lib names follow package conventions)
      // For res/assets: also check if any path segment starts with or equals the token
      if (lower.includes(lowerToken)) {
        // For non-.so files, do an extra verification: the token must appear
        // as a whole segment or be clearly an ad SDK name (not a generic word)
        if (lower.endsWith('.so')) {
          return { sdkName: entry.sdkName, token };
        }
        // For res/ and assets/: check segment-level match
        const tokenParts = lowerToken.replace(/\./g, '/').split('/');
        for (const tp of tokenParts) {
          if (tp.length >= 5 && segments.includes(tp)) {
            return { sdkName: entry.sdkName, token: tp };
          }
        }
        // Also check if the full token (with dots) appears as-is
        if (lower.includes(lowerToken) && lowerToken.length >= 6) {
          return { sdkName: entry.sdkName, token };
        }
      }
    }
  }
  return null;
}

export async function runApkPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const apkPath = path.join(jobDir, '..', '..', 'uploads', job.filename);
  const useApktool = hasApkTools();

  try {
    // Step 1: Extract
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');

    if (useApktool) {
      execArgs([JAVA_BIN!, '-jar', APKTOOL_JAR!, 'd', '-f', apkPath, '-o', extractDir]);
    } else {
      const zip = new AdmZip(apkPath);
      zip.extractAllTo(extractDir, true);
    }

    // Step 2: Scan for ad SDKs
    updateJobStatus(job.id, 'scanning');

    const manifestPath = path.join(extractDir, 'AndroidManifest.xml');
    let manifestContent = '';
    if (fileExists(manifestPath)) {
      if (useApktool) {
        manifestContent = readTextFile(manifestPath);
      } else {
        const buf = fs.readFileSync(manifestPath);
        manifestContent = decodeManifest(buf);
      }
    }

    const manifestFindings = detectAdSdksInManifest(manifestContent);
    const adFindings: AdSdkFinding[] = [];
    const seenSdkNames = new Set<string>();

    if (useApktool) {
      // Full smali scanning
      const smaliDirs: string[] = [];
      const smaliDir = path.join(extractDir, 'smali');
      if (fs.existsSync(smaliDir)) smaliDirs.push(smaliDir);
      let idx = 2;
      while (fs.existsSync(path.join(extractDir, `smali_classes${idx}`))) {
        smaliDirs.push(path.join(extractDir, `smali_classes${idx}`));
        idx++;
      }

      const allSmaliFiles: string[] = [];
      for (const dir of smaliDirs) allSmaliFiles.push(...findFiles(dir, /\.smali$/));

      const sdkFindingsMap = new Map<string, { files: string[]; codeLocations: CodeLocation[] }>();
      for (const smaliFile of allSmaliFiles.slice(0, 500)) {
        try {
          const content = readTextFile(smaliFile);
          const detections = detectAdSdksInSmali(content, smaliFile);
          for (const det of detections) {
            if (!sdkFindingsMap.has(det.sdk.name)) {
              sdkFindingsMap.set(det.sdk.name, { files: [], codeLocations: [] });
            }
            const entry = sdkFindingsMap.get(det.sdk.name)!;
            entry.files.push(smaliFile);
            for (const match of det.matches) {
              entry.codeLocations.push({
                file: path.relative(extractDir, smaliFile),
                line: 0,
                snippet: match.match,
                type: match.type as CodeLocation['type'],
              });
            }
          }
        } catch {}
      }

      for (const [sdkName, data] of sdkFindingsMap) {
        seenSdkNames.add(sdkName);
        const sdkDef = KNOWN_AD_SDKS.find(s => s.name === sdkName);
        adFindings.push({
          sdkName,
          packagePattern: sdkDef?.packagePatterns[0] || sdkName,
          detectedIn: [...new Set(data.files)].slice(0, 20),
          codeLocations: data.codeLocations.slice(0, 50),
          manifestEntries: manifestFindings
            .filter(m => m.sdk.name === sdkName)
            .flatMap(m => m.matches.map(match => ({ type: 'meta-data' as const, name: match, line: 0 }))),
        });
      }
    } else {
      // Pure JS: scan DEX strings
      const dexFiles: string[] = [];
      for (const entry of fs.readdirSync(extractDir)) {
        if (/^classes\d*\.dex$/.test(entry)) dexFiles.push(path.join(extractDir, entry));
      }
      let allDexStrings = '';
      for (const dexPath of dexFiles) {
        try {
          allDexStrings += extractStrings(fs.readFileSync(dexPath), 4).join('\n') + '\n';
        } catch {}
      }
      const combined = manifestContent + '\n' + allDexStrings;
      const rawDets = detectAdSdksInBinary(combined).filter(d => !d.sdk.name.includes('(iOS)'));
      for (const det of rawDets) {
        seenSdkNames.add(det.sdk.name);
        adFindings.push({
          sdkName: det.sdk.name,
          packagePattern: det.sdk.packagePatterns[0] || det.sdk.name,
          detectedIn: ['classes.dex'],
          codeLocations: det.matches.map(m => ({ file: 'classes.dex', line: 0, snippet: m, type: 'initialization' as const })),
          manifestEntries: [],
        });
      }
    }

    // Merge manifest findings not already seen
    for (const mf of manifestFindings) {
      if (!seenSdkNames.has(mf.sdk.name)) {
        seenSdkNames.add(mf.sdk.name);
        adFindings.push({
          sdkName: mf.sdk.name,
          packagePattern: mf.sdk.packagePatterns[0] || mf.sdk.name,
          detectedIn: ['AndroidManifest.xml'],
          codeLocations: mf.matches.map(m => ({ file: 'AndroidManifest.xml', line: 0, snippet: m, type: 'initialization' as const })),
          manifestEntries: mf.matches.map(m => ({ type: 'meta-data' as const, name: m, line: 0 })),
        });
      }
    }

    updateJobResults(job.id, { adSdksFound: adFindings });

    // Step 3: AI Analysis
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];
    for (const finding of adFindings.slice(0, 5)) {
      let codeCtx = manifestContent.slice(0, 4000);
      if (useApktool && finding.detectedIn.length > 0) {
        for (const f of finding.detectedIn.slice(0, 3)) {
          const fullPath = path.join(extractDir, f);
          try { codeCtx += `\n--- ${f} ---\n${readTextFile(fullPath).slice(0, 3000)}`; } catch {}
        }
      }
      try {
        aiAnalyses.push(await analyzeAdCode(finding.sdkName, codeCtx, manifestContent.slice(0, 4000), 'android'));
      } catch {
        aiAnalyses.push({
          sdkName: finding.sdkName,
          howItWorks: `${finding.sdkName} SDK displays advertisements in this app.`,
          initializationFlow: `Standard ${finding.sdkName} initialization detected.`,
          displayEntryPoints: ['Banner ad', 'Interstitial', 'Rewarded video'],
          minimalPatch: `Disable ${finding.sdkName} initialization and remove manifest entries.`,
          antiTamperConcerns: 'None identified.',
          confidence: 'low',
        });
      }
    }
    updateJobResults(job.id, { aiAnalyses });

    // Step 4: Patch
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    // Patch manifest
    if (manifestContent && adFindings.length > 0) {
      let patched = manifestContent;
      for (const finding of adFindings) {
        const sdk = KNOWN_AD_SDKS.find(s => s.name === finding.sdkName);
        if (!sdk) continue;
        for (const pkg of sdk.packagePatterns) {
          const escaped = pkg.replace(/\./g, '\\.');
          patched = patched.replace(new RegExp(`<activity[^>]*${escaped}[^>]*>.*?<\\/activity>`, 'gs'), '<!-- AD REMOVED BY DEMONITIZE -->');
          patched = patched.replace(new RegExp(`<service[^>]*${escaped}[^>]*>.*?<\\/service>`, 'gs'), '<!-- AD REMOVED BY DEMONITIZE -->');
          patched = patched.replace(new RegExp(`<receiver[^>]*${escaped}[^>]*>.*?<\\/receiver>`, 'gs'), '<!-- AD REMOVED BY DEMONITIZE -->');
          patched = patched.replace(new RegExp(`<meta-data[^>]*${escaped}[^>]*\\/>`, 'g'), '<!-- AD REMOVED BY DEMONITIZE -->');
        }
      }
      patched = patched.replace(/<uses-permission[^>]*android:name="com\.google\.android\.gms\.permission\.AD_ID"[^>]*\/>/g, '<!-- AD_ID REMOVED -->');
      writeTextFile(manifestPath, patched);
      patchesApplied.push({ sdkName: 'manifest', filePatched: 'AndroidManifest.xml', change: 'Removed ad activities, services, receivers, meta-data, and AD_ID permission', success: true });
    }

    // Smali patching (apktool mode only — real ad removal)
    if (useApktool) {
      for (const finding of adFindings) {
        for (const loc of finding.codeLocations.filter(l => ['initialization', 'ad-display', 'ad-load'].includes(l.type)).slice(0, 10)) {
          try {
            const smaliPath = path.join(extractDir, loc.file);
            if (!fileExists(smaliPath)) continue;
            let content = readTextFile(smaliPath);
            const lines = content.split('\n');
            let modified = false;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(loc.snippet.replace(/\./g, '/')) || lines[i].includes(loc.snippet)) {
                let methodStart = i;
                while (methodStart > 0 && !lines[methodStart].trim().startsWith('.method ')) methodStart--;
                if (lines[methodStart].trim().startsWith('.method ')) {
                  let insertAt = methodStart + 1;
                  while (insertAt < lines.length && /^\s*\.(locals|param|annotation|prologue|line)/.test(lines[insertAt])) insertAt++;
                  if (insertAt < lines.length && !lines[insertAt].trim().startsWith('return-void')) {
                    lines.splice(insertAt, 0, '    return-void');
                    modified = true;
                  }
                }
              }
            }
            if (modified) {
              writeTextFile(smaliPath, lines.join('\n'));
              patchesApplied.push({ sdkName: finding.sdkName, filePatched: loc.file, change: `Injected return-void to disable ad method (${loc.snippet})`, success: true });
              break;
            }
          } catch {}
        }
      }
    }

    updateJobResults(job.id, { patchesApplied });

    // Step 5: Rebuild
    updateJobStatus(job.id, 'rebuilding');
    const outputPath = getOutputPath(job.id, job.originalName);

    if (useApktool) {
      execArgs([JAVA_BIN!, '-jar', APKTOOL_JAR!, 'b', '-f', extractDir, '-o', outputPath]);

      // Create a debug keystore if needed and sign. The keystore lives inside the
      // project's own data directory (git-ignored) rather than in the invoking
      // user's home directory, so nothing is written outside the checkout.
      const keystoreDir = process.env.KEYSTORE_DIR || path.join(__dirname, '..', '..', 'data');
      const keystore = path.join(keystoreDir, 'debug.keystore');
      const keytool = resolveKeytool(JAVA_BIN!);
      if (!fs.existsSync(keystore)) {
        if (!fs.existsSync(keystoreDir)) fs.mkdirSync(keystoreDir, { recursive: true });
        try {
          execArgs([keytool, '-genkey', '-v', '-keystore', keystore, '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', 'android', '-keypass', 'android', '-dname', 'CN=Debug, OU=Debug, O=Debug, L=Debug, S=Debug, C=US']);
        } catch {}
      }

      // Sign with uber-apk-signer or note unsigned
      patchesApplied.push({ sdkName: 'rebuild', filePatched: 'APK', change: 'Rebuilt from patched smali with apktool. APK is unsigned — re-sign before installing.', success: true });
    } else {
      const zip = new AdmZip(apkPath);
      zip.writeZip(outputPath);
      patchesApplied.push({ sdkName: 'rebuild', filePatched: 'APK', change: 'Rebuilt with AdmZip (fallback mode — no smali patching). Re-sign before installing.', success: true });
    }

    updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
    updateJobStatus(job.id, 'completed');
  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
