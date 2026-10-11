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
import { detectWindowsAdPatterns, windowsSignatureToAdSdk, detectAdUrls } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// ---------------------------------------------------------------------------
// Pipeline — handles .msix and .appx (Windows Store app packages)
// ---------------------------------------------------------------------------
export async function runMsixPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const pkgPath = path.join(jobDir, '..', '..', 'uploads', job.filename);

  try {
    // =======================================================================
    // Step 1: Extract (MSIX/APPX are ZIP files)
    // =======================================================================
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');

    try {
      const zip = new AdmZip(pkgPath);
      zip.extractAllTo(extractDir, true);
    } catch (e: any) {
      throw new Error(`Failed to extract package: ${e.message}`);
    }

    // =======================================================================
    // Step 2: Scan for ad SDKs
    // =======================================================================
    updateJobStatus(job.id, 'scanning');

    // Read AppxManifest.xml
    const manifestPath = path.join(extractDir, 'AppxManifest.xml');
    let manifestContent = '';
    if (fileExists(manifestPath)) {
      try {
        manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      } catch {
        // leave empty
      }
    }

    // Collect all DLL filenames
    const dllFiles = findFiles(extractDir, /\.dll$/i);
    const dllNames = dllFiles.map(f => path.basename(f));

    // Collect XAML files
    const xamlFiles = findFiles(extractDir, /\.xaml$/i);
    let allXamlContent = '';
    for (const xf of xamlFiles) {
      try {
        allXamlContent += fs.readFileSync(xf, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Collect HTML/JS files (for hosted web apps / WebView components)
    const htmlFiles = findFiles(extractDir, /\.html?$/i);
    let allHtmlContent = '';
    for (const hf of htmlFiles) {
      try {
        allHtmlContent += fs.readFileSync(hf, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    const jsFiles = findFiles(extractDir, /\.js$/i);
    let allJsContent = '';
    for (const jf of jsFiles) {
      try {
        allJsContent += fs.readFileSync(jf, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Run Windows-specific detection
    const winDetections = detectWindowsAdPatterns(
      dllNames,
      manifestContent,
      allXamlContent + allHtmlContent
    );

    // Also scan binary content in DLLs for ad URLs
    let allDllContent = '';
    for (const dllFile of dllFiles) {
      try {
        const buf = fs.readFileSync(dllFile);
        // Extract printable strings from DLL binary
        let str = '';
        for (let i = 0; i < buf.length; i++) {
          const byte = buf[i];
          if (byte >= 0x20 && byte <= 0x7e) {
            str += String.fromCharCode(byte);
          } else {
            if (str.length >= 4) allDllContent += str + '\n';
            str = '';
          }
        }
      } catch {
        // skip
      }
    }

    // Also detect ad URLs across all content
    const allContent = manifestContent + '\n' + allXamlContent + '\n' + allHtmlContent + '\n' + allJsContent + '\n' + allDllContent;
    const adUrls = detectAdUrls(allContent);

    // Build findings
    const adFindings: AdSdkFinding[] = [];
    for (const det of winDetections) {
      const sig = det.sig;
      adFindings.push({
        sdkName: sig.name,
        packagePattern: sig.dllPatterns[0] || sig.name,
        detectedIn: dllFiles.filter(d => {
          const bn = path.basename(d).toLowerCase();
          return sig.dllPatterns.some(dp => bn.includes(dp.toLowerCase()));
        }).map(d => path.relative(extractDir, d)),
        codeLocations: det.matches.map(m => ({
          file: 'AppxManifest.xml / XAML',
          line: 0,
          snippet: m,
          type: 'initialization' as const,
        })),
        manifestEntries: sig.manifestPatterns.map(p => ({
          type: 'meta-data' as const,
          name: p,
          line: 0,
        })),
      });
    }

    updateJobResults(job.id, { adSdksFound: adFindings });

    // =======================================================================
    // Step 3: AI Analysis
    // =======================================================================
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];

    for (const finding of adFindings.slice(0, 5)) {
      const codeContext = allDllContent.slice(0, 6000);
      const manifestCtx = manifestContent.slice(0, 4000);

      try {
        const analysis = await analyzeAdCode(
          finding.sdkName,
          codeContext,
          manifestCtx,
          'windows'
        );
        aiAnalyses.push(analysis);
      } catch (e: any) {
        aiAnalyses.push({
          sdkName: finding.sdkName,
          howItWorks: `The ${finding.sdkName} is integrated into the Windows Store app to display advertisements.`,
          initializationFlow: `Standard ${finding.sdkName} initialization detected via DLL analysis and AppxManifest.xml references.`,
          displayEntryPoints: ['AdControl in XAML', 'Interstitial ad display', 'Banner ad placement'],
          minimalPatch: `Remove ${finding.sdkName} DLL files and references from AppxManifest.xml. Remove ad controls from XAML pages.`,
          antiTamperConcerns: 'App may crash if ad controls are removed without checking null references. Verify XAML pages after removal.',
          confidence: 'medium',
        });
      }
    }

    updateJobResults(job.id, { aiAnalyses });

    // =======================================================================
    // Step 4: Patch
    // =======================================================================
    updateJobStatus(job.id, 'patching');
    const patchesApplied: PatchResult[] = [];

    // Patch AppxManifest.xml to remove ad-related extensions
    if (manifestContent && adFindings.length > 0) {
      try {
        let patchedManifest = manifestContent;

        // Remove ad-related Extension elements
        for (const finding of adFindings) {
          for (const sig of finding.manifestEntries) {
            // Try to remove XML elements containing ad references
            const escaped = sig.name.replace(/\./g, '\\.');
            const extRegex = new RegExp(`<Extension[^>]*${escaped}[^>]*>[\\s\\S]*?<\\/Extension>`, 'gi');
            patchedManifest = patchedManifest.replace(extRegex, '<!-- Extension removed by Demonitize -->');

            // Remove capability declarations
            const capRegex = new RegExp(`<[^>]*${escaped}[^>]*\\/?>`, 'gi');
            patchedManifest = patchedManifest.replace(capRegex, '<!-- Capability removed by Demonitize -->');
          }
        }

        writeTextFile(manifestPath, patchedManifest);
        patchesApplied.push({
          sdkName: 'Windows Ad SDKs',
          filePatched: 'AppxManifest.xml',
          change: 'Removed ad SDK extension and capability references from AppxManifest.xml',
          success: true,
        });
      } catch (e: any) {
        patchesApplied.push({
          sdkName: 'Windows Ad SDKs',
          filePatched: 'AppxManifest.xml',
          change: 'Failed to patch AppxManifest.xml',
          success: false,
          error: e.message,
        });
      }
    }

    // Remove ad SDK DLLs
    for (const finding of adFindings) {
      const adDlls = dllFiles.filter(d => {
        const bn = path.basename(d).toLowerCase();
        return finding.packagePattern.toLowerCase().includes(bn) ||
               bn.includes(finding.packagePattern.toLowerCase());
      });

      for (const dllPath of adDlls) {
        try {
          fs.unlinkSync(dllPath);
          patchesApplied.push({
            sdkName: finding.sdkName,
            filePatched: path.relative(extractDir, dllPath),
            change: 'Removed ad SDK DLL',
            success: true,
          });
        } catch (e: any) {
          patchesApplied.push({
            sdkName: finding.sdkName,
            filePatched: path.relative(extractDir, dllPath),
            change: 'Failed to remove ad SDK DLL',
            success: false,
            error: e.message,
          });
        }
      }
    }

    // Patch XAML files to remove ad controls
    for (const xamlFile of xamlFiles) {
      try {
        let content = fs.readFileSync(xamlFile, 'utf-8');
        let modified = false;

        // Remove common ad control XML namespaces and controls
        const xamlAdPatterns: [RegExp, string][] = [
          [/<UI:AdControl[^>]*\/>/gi, '<!-- AdControl removed by Demonitize -->'],
          [/<AdControl[^>]*>[\s\S]*?<\/AdControl>/gi, '<!-- AdControl removed by Demonitize -->'],
          [/<adduplex:AdControl[^>]*\/>/gi, '<!-- AdDuplex removed by Demonitize -->'],
          [/<MSAdControl[^>]*\/>/gi, '<!-- MSAdControl removed by Demonitize -->'],
          [/xmlns:[^=]*=[\"']using:Microsoft\.Advertising[^\"']*[\"']/gi, '<!-- Ad namespace removed -->'],
          [/xmlns:[^=]*=[\"']using:Microsoft\.AdMediator[^\"']*[\"']/gi, '<!-- AdMediator namespace removed -->'],
        ];

        for (const [pattern, replacement] of xamlAdPatterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            modified = true;
            // Reset lastIndex since we used test()
            pattern.lastIndex = 0;
          }
        }

        if (modified) {
          writeTextFile(xamlFile, content);
          patchesApplied.push({
            sdkName: 'Windows Ad Controls',
            filePatched: path.relative(extractDir, xamlFile),
            change: 'Removed ad controls from XAML file',
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
    try {
      const repackagedZip = new AdmZip();

      walkDir(extractDir, (filePath, relativePath) => {
        if (relativePath.startsWith('__MACOSX') || relativePath.includes('/__MACOSX')) return;
        repackagedZip.addLocalFile(filePath, path.dirname(relativePath));
      });

      repackagedZip.writeZip(outputPath);

      patchesApplied.push({
        sdkName: 'MSIX/APPX Repackaging',
        filePatched: 'Package',
        change: 'Re-packaged Windows Store app with ad SDKs removed. NOTE: The package must be re-signed with your own code signing certificate before installation.',
        success: true,
      });

      updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
      updateJobStatus(job.id, 'completed');
    } catch (e: any) {
      throw new Error(`Failed to repackage: ${e.message}`);
    }
  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
