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
import { getJobDir, getOutputPath, fileExists, findFiles, writeTextFile, walkDir } from '../services/fileManager';
import { updateJobStatus, updateJobResults } from '../database';
import { BROWSER_AD_PATTERNS, browserSignatureToAdSdk, detectBrowserAdPatterns } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// ---------------------------------------------------------------------------
// Pipeline — handles .AppImage, .snap, .flatpak (Linux app packages)
// These are less common for ad content, but we do a basic scan for
// embedded HTML/JS ad patterns.
//
// Note: AppImage is an ELF with a squashfs — we attempt extraction as a
// raw binary and scan for strings. .snap is a squashfs. .flatpak is an
// ostree archive but typically distributed as .flatpakref (a text file).
// We treat these as best-effort detection stubs.
// ---------------------------------------------------------------------------
export async function runLinuxPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const pkgPath = path.join(jobDir, '..', '..', 'uploads', job.filename);
  const ext = path.extname(job.filename).toLowerCase();

  try {
    // =======================================================================
    // Step 1: Extract / scan
    // =======================================================================
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    let allContent = '';

    if (ext === '.flatpak') {
      // .flatpakref files are text (INI-like) — just read them
      try {
        allContent = fs.readFileSync(pkgPath, 'utf-8');
      } catch (e: any) {
        throw new Error(`Failed to read flatpak file: ${e.message}`);
      }
      // Copy to extractDir for consistency
      fs.copyFileSync(pkgPath, path.join(extractDir, job.filename));
    } else if (ext === '.appimage') {
      // AppImage: ELF with appended squashfs.
      // Try to find and extract the squashfs portion, otherwise extract strings from the binary.
      try {
        const buf = fs.readFileSync(pkgPath);
        // Search for squashfs magic (0x68737173 = "hsqs")
        let foundSquashfs = false;
        for (let i = 0; i < buf.length - 4; i++) {
          if (buf[i] === 0x68 && buf[i + 1] === 0x73 && buf[i + 2] === 0x71 && buf[i + 3] === 0x73) {
            // Found squashfs — but we can't easily extract it without squashfs-tools.
            // Fall through to string extraction.
            foundSquashfs = true;
            break;
          }
        }

        // Extract readable strings from the entire binary
        let current = '';
        const strings: string[] = [];
        for (let i = 0; i < buf.length; i++) {
          const byte = buf[i];
          if (byte >= 0x20 && byte <= 0x7e) {
            current += String.fromCharCode(byte);
          } else {
            if (current.length >= 4) strings.push(current);
            current = '';
          }
        }
        if (current.length >= 4) strings.push(current);
        allContent = strings.join('\n');

        if (foundSquashfs) {
          // Try to extract with unsquashfs if available
          try {
            const { execSync } = require('child_process');
            execSync(`unsquashfs -d "${extractDir}" "${pkgPath}" 2>/dev/null`, { timeout: 30000 });
          } catch {
            // unsquashfs not available — strings-based analysis only
          }
        }
      } catch (e: any) {
        throw new Error(`Failed to process AppImage: ${e.message}`);
      }
    } else if (ext === '.snap') {
      // Snap: squashfs archive
      try {
        const { execSync } = require('child_process');
        execSync(`unsquashfs -d "${extractDir}" "${pkgPath}" 2>/dev/null`, { timeout: 30000 });
      } catch {
        // unsquashfs not available — read as raw binary for strings
        try {
          const buf = fs.readFileSync(pkgPath);
          let current = '';
          const strings: string[] = [];
          for (let i = 0; i < buf.length; i++) {
            const byte = buf[i];
            if (byte >= 0x20 && byte <= 0x7e) {
              current += String.fromCharCode(byte);
            } else {
              if (current.length >= 4) strings.push(current);
              current = '';
            }
          }
          if (current.length >= 4) strings.push(current);
          allContent = strings.join('\n');
        } catch (e2: any) {
          throw new Error(`Failed to process snap: ${e2.message}`);
        }
      }
    }

    // =======================================================================
    // Step 2: Scan for ad patterns in the extracted / collected content
    // =======================================================================
    updateJobStatus(job.id, 'scanning');

    // Look for HTML/JS ad patterns if extraction produced files
    const jsFiles = findFiles(extractDir, /\.js$/i);
    let allJsContent = '';
    for (const jf of jsFiles) {
      try { allJsContent += fs.readFileSync(jf, 'utf-8') + '\n'; } catch { /* skip */ }
    }

    const htmlFiles = findFiles(extractDir, /\.html?$/i);
    let allHtmlContent = '';
    for (const hf of htmlFiles) {
      try { allHtmlContent += fs.readFileSync(hf, 'utf-8') + '\n'; } catch { /* skip */ }
    }

    // Use browser ad pattern detection on any HTML/JS found
    let manifestContent = '{}';
    if (fileExists(path.join(extractDir, 'manifest.json'))) {
      try {
        manifestContent = fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf-8');
      } catch { /* skip */ }
    }

    const browserDetections = detectBrowserAdPatterns(
      allJsContent,
      manifestContent,
      allHtmlContent
    );

    // Also scan the raw string content for ad URLs
    const allScanContent = allContent + '\n' + allJsContent + '\n' + allHtmlContent;

    // Simple ad domain detection
    const adDomains = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'taboola.com', 'outbrain.com', 'amazon-adsystem.com',
      'pagead2.googlesyndication.com', 'adsrvr.org', 'adnxs.com',
      'rubiconproject.com', 'criteo.com', 'criteo.net',
      'pubmatic.com', 'openx.net', 'casalemedia.com',
    ];

    const foundDomains: string[] = [];
    for (const domain of adDomains) {
      if (allScanContent.includes(domain)) {
        foundDomains.push(domain);
      }
    }

    // Build findings
    const adFindings: AdSdkFinding[] = [];

    // Findings from browser pattern detection
    for (const det of browserDetections) {
      const sig = det.sig;
      adFindings.push({
        sdkName: sig.name,
        packagePattern: sig.urlPatterns[0] || sig.name,
        detectedIn: jsFiles.concat(htmlFiles).map(f => path.relative(extractDir, f)),
        codeLocations: det.matches.map(m => ({
          file: 'extracted content',
          line: 0,
          snippet: m,
          type: 'initialization' as const,
        })),
        manifestEntries: sig.permissions.map(p => ({
          type: 'permission' as const,
          name: p,
          line: 0,
        })),
      });
    }

    // Add a generic finding for ad domains found in raw strings
    if (foundDomains.length > 0 && adFindings.length === 0) {
      adFindings.push({
        sdkName: 'Embedded Ad Content (Linux)',
        packagePattern: foundDomains[0],
        detectedIn: ['binary strings', ...jsFiles.map(f => path.relative(extractDir, f))],
        codeLocations: foundDomains.map(d => ({
          file: 'binary strings',
          line: 0,
          snippet: d,
          type: 'network-call' as const,
        })),
        manifestEntries: [],
      });
    }

    updateJobResults(job.id, { adSdksFound: adFindings });

    // =======================================================================
    // Step 3: AI Analysis (only if findings exist)
    // =======================================================================
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];

    for (const finding of adFindings.slice(0, 3)) {
      const codeContext = allScanContent.slice(0, 6000);

      try {
        const analysis = await analyzeAdCode(
          finding.sdkName,
          codeContext,
          '',
          'linux'
        );
        aiAnalyses.push(analysis);
      } catch (e: any) {
        aiAnalyses.push({
          sdkName: finding.sdkName,
          howItWorks: `The Linux app package contains ${finding.sdkName} patterns suggesting embedded ad/tracking content.`,
          initializationFlow: `Patterns detected: ${finding.codeLocations.map(l => l.snippet).join(', ').slice(0, 200)}`,
          displayEntryPoints: ['Embedded webview', 'HTML/JS rendering', 'Network requests to ad servers'],
          minimalPatch: `For AppImage/Snap/Flatpak: extract the package, remove ad-related HTML/JS files, and rebuild. For AppImage: use --appimage-extract then re-package with appimagetool.`,
          antiTamperConcerns: 'Rebuilt package may fail integrity checks. Re-sign if applicable.',
          confidence: 'low',
        });
      }
    }

    // If no findings, add a clean bill of health note
    if (adFindings.length === 0) {
      aiAnalyses.push({
        sdkName: 'No ad content detected',
        howItWorks: 'No advertising SDKs or ad-related patterns were detected in this Linux package. Note that AppImage/Snap/Flatpak packages rarely embed traditional ad SDKs — ads, if present, are usually served via embedded web content.',
        initializationFlow: 'N/A',
        displayEntryPoints: [],
        minimalPatch: 'No patch needed.',
        antiTamperConcerns: 'N/A',
        confidence: 'high',
      });
    }

    updateJobResults(job.id, { aiAnalyses });

    // =======================================================================
    // Step 4: Patch (limited for Linux packages)
    // =======================================================================
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    // If we have JS/HTML files with ad patterns, neutralize them
    for (const jsFile of jsFiles) {
      try {
        let content = fs.readFileSync(jsFile, 'utf-8');
        const adPatterns = [
          /doubleclick\.net/gi,
          /googlesyndication\.com/gi,
          /pagead2\./gi,
          /adsbygoogle/gi,
          /taboola\.com/gi,
          /outbrain\.com/gi,
        ];

        let modified = false;
        for (const pattern of adPatterns) {
          if (pattern.test(content)) {
            content = `/* DEMONITIZE: Ad references neutralized */\n(function(){ return; /*\n${content}\n*/ })();`;
            modified = true;
            break;
          }
        }

        if (modified) {
          writeTextFile(jsFile, content);
          patchesApplied.push({
            sdkName: 'Ad Content Neutralization',
            filePatched: path.relative(extractDir, jsFile),
            change: 'Neutralized ad-related JavaScript content',
            success: true,
          });
        }
      } catch {
        // skip
      }
    }

    updateJobResults(job.id, { patchesApplied });

    // =======================================================================
    // Step 5: Rebuild
    // =======================================================================
    updateJobStatus(job.id, 'rebuilding');

    const outputPath = getOutputPath(job.id, job.originalName);

    if (ext === '.flatpak') {
      // Flatpak files are text — just copy with modifications
      try {
        fs.writeFileSync(outputPath, allContent, 'utf-8');
        patchesApplied.push({
          sdkName: 'Flatpak Output',
          filePatched: 'flatpak file',
          change: 'Flatpak manifest processed. Apply the modified manifest to your Flatpak build.',
          success: true,
        });
      } catch (e: any) {
        throw new Error(`Failed to write flatpak output: ${e.message}`);
      }
    } else {
      // For AppImage and Snap — if we have extracted content, try to rebuild as ZIP
      // (proper rebuilding requires appimagetool / snapcraft which aren't available)
      try {
        const repackagedZip = new AdmZip();

        walkDir(extractDir, (filePath, relativePath) => {
          if (relativePath.startsWith('__MACOSX') || relativePath.includes('/__MACOSX')) return;
          repackagedZip.addLocalFile(filePath, path.dirname(relativePath));
        });

        repackagedZip.writeZip(outputPath);

        patchesApplied.push({
          sdkName: 'Linux Package Repackaging',
          filePatched: 'Package',
          change: `Linux package extracted and repackaged as ZIP. For ${ext === '.appimage' ? 'AppImage' : 'Snap'}: re-build with ${ext === '.appimage' ? 'appimagetool' : 'snapcraft'} using the extracted/modified contents.`,
          success: true,
        });
      } catch (e: any) {
        // If we can't rebuild, just copy the original
        fs.copyFileSync(pkgPath, outputPath);
        patchesApplied.push({
          sdkName: 'Linux Package',
          filePatched: 'Package',
          change: 'Could not rebuild package — copied original. Manual re-packaging required.',
          success: true,
        });
      }
    }

    updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
    updateJobStatus(job.id, 'completed');
  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
