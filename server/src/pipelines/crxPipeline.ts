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
import { getJobDir, getOutputPath, fileExists, writeTextFile, findFiles, walkDir } from '../services/fileManager';
import { updateJobStatus, updateJobResults } from '../database';
import { detectBrowserAdPatterns, BrowserAdSignature } from '../services/adSdkDatabase';
import { analyzeAdCode } from '../services/aiAnalysis';

// ---------------------------------------------------------------------------
// CRX binary header constants
// ---------------------------------------------------------------------------
const CRX_MAGIC = 'Cr24'; // 4 bytes
const CRX_HEADER_MIN_SIZE = 12;

/**
 * Read a CRX file and return the ZIP data (stripping the binary header).
 * CRX3 format: magic(4) + version(4) + headerSize(4) + header(headerSize) + ZIP
 */
function stripCrxHeader(crxPath: string): Buffer {
  const fd = fs.openSync(crxPath, 'r');
  try {
    const magicBuf = Buffer.alloc(4);
    if (fs.readSync(fd, magicBuf, 0, 4, 0) !== 4) {
      throw new Error('Failed to read CRX magic number');
    }
    const magic = magicBuf.toString('ascii');
    if (magic !== CRX_MAGIC) {
      throw new Error(`Invalid CRX magic: expected "${CRX_MAGIC}", got "${magic}"`);
    }

    // Read version (little-endian 32-bit)
    const versionBuf = Buffer.alloc(4);
    fs.readSync(fd, versionBuf, 0, 4, 4);
    const version = versionBuf.readUInt32LE(0);

    // Read header length (little-endian 32-bit)
    const headerLenBuf = Buffer.alloc(4);
    fs.readSync(fd, headerLenBuf, 0, 4, 8);

    let zipOffset: number;
    if (version === 2) {
      // CRX2: header length is the public key length + signature length (but this can vary)
      // For CRX3: header length = size of protobuf header
      zipOffset = CRX_HEADER_MIN_SIZE + headerLenBuf.readUInt32LE(0);
    } else {
      // CRX3+: headerLenBuf contains the length of the protobuf header
      const headerLen = headerLenBuf.readUInt32LE(0);
      zipOffset = CRX_HEADER_MIN_SIZE + headerLen;
    }

    const stat = fs.fstatSync(fd);
    const zipSize = stat.size - zipOffset;
    if (zipSize <= 0) {
      throw new Error('CRX file has no ZIP payload');
    }

    const zipBuf = Buffer.alloc(zipSize);
    fs.readSync(fd, zipBuf, 0, zipSize, zipOffset);
    return zipBuf;
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Pipeline — handles .crx (Chrome) and .xpi (Firefox)
// ---------------------------------------------------------------------------
export async function runCrxPipeline(job: Job): Promise<void> {
  const jobDir = getJobDir(job.id);
  const extPath = path.join(jobDir, '..', '..', 'uploads', job.filename);
  const isCrx = job.filename.toLowerCase().endsWith('.crx');

  try {
    // =======================================================================
    // Step 1: Extract
    // =======================================================================
    updateJobStatus(job.id, 'extracting');
    const extractDir = path.join(jobDir, 'extracted');

    let zipData: Buffer;
    if (isCrx) {
      // CRX: strip binary header to get ZIP
      zipData = stripCrxHeader(extPath);
    } else {
      // XPI: direct ZIP
      zipData = fs.readFileSync(extPath);
    }

    try {
      const zip = new AdmZip(zipData);
      zip.extractAllTo(extractDir, true);
    } catch (e: any) {
      throw new Error(`Failed to extract extension: ${e.message}`);
    }

    // =======================================================================
    // Step 2: Scan for ad injection patterns
    // =======================================================================
    updateJobStatus(job.id, 'scanning');

    // Read manifest.json
    const manifestPath = path.join(extractDir, 'manifest.json');
    let manifestContent = '';
    if (fileExists(manifestPath)) {
      try {
        manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      } catch {
        // leave empty
      }
    }

    // Collect all JS files
    const jsFiles = findFiles(extractDir, /\.js$/i);
    let allJsContent = '';
    for (const jsFile of jsFiles) {
      try {
        allJsContent += fs.readFileSync(jsFile, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Collect all HTML files
    const htmlFiles = findFiles(extractDir, /\.html?$/i);
    let allHtmlContent = '';
    for (const hf of htmlFiles) {
      try {
        allHtmlContent += fs.readFileSync(hf, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Collect CSS files (sometimes contain ad-related selectors)
    const cssFiles = findFiles(extractDir, /\.css$/i);
    let allCssContent = '';
    for (const cf of cssFiles) {
      try {
        allCssContent += fs.readFileSync(cf, 'utf-8') + '\n';
      } catch {
        // skip
      }
    }

    // Detect browser ad patterns
    const browserDetections = detectBrowserAdPatterns(
      allJsContent + allCssContent,
      manifestContent,
      allHtmlContent
    );

    // Build findings
    const adFindings: AdSdkFinding[] = [];
    for (const det of browserDetections) {
      const sig = det.sig;
      adFindings.push({
        sdkName: sig.name,
        packagePattern: sig.urlPatterns[0] || sig.name,
        detectedIn: jsFiles.concat(htmlFiles).map(f => path.relative(extractDir, f)),
        codeLocations: det.matches.map(m => ({
          file: 'manifest.json / content scripts',
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

    updateJobResults(job.id, { adSdksFound: adFindings });

    // =======================================================================
    // Step 3: AI Analysis
    // =======================================================================
    updateJobStatus(job.id, 'analyzing');
    const aiAnalyses: AiAnalysis[] = [];

    for (const finding of adFindings.slice(0, 5)) {
      const codeContext = allJsContent.slice(0, 6000);
      const manifestCtx = manifestContent.slice(0, 4000);

      try {
        const analysis = await analyzeAdCode(
          finding.sdkName,
          codeContext,
          manifestCtx,
          'browser'
        );
        aiAnalyses.push(analysis);
      } catch (e: any) {
        aiAnalyses.push({
          sdkName: finding.sdkName,
          howItWorks: `The extension uses ${finding.sdkName} patterns to inject or display advertisements in the browser.`,
          initializationFlow: `Patterns detected: ${finding.codeLocations.map(l => l.snippet).join(', ').slice(0, 200)}`,
          displayEntryPoints: ['Content script injection', 'Popup display', 'Page modification'],
          minimalPatch: `Remove or comment out the ${finding.sdkName} initialization code. Remove permission entries for ad domains from manifest.json.`,
          antiTamperConcerns: 'Extension may fail to load if permissions are removed. Verify after patching.',
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

    // Patch manifest.json to remove suspicious permissions
    if (manifestContent && adFindings.length > 0) {
      try {
        let patchedManifest = manifestContent;

        // Collect all ad-related permissions from detections
        const adPermissions = new Set<string>();
        for (const det of browserDetections) {
          for (const perm of det.sig.permissions) {
            adPermissions.add(perm);
          }
        }

        // Remove ad-related URL patterns from host_permissions and permissions
        const adUrlPatterns = [
          'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
          'taboola.com', 'outbrain.com', 'amazon-adsystem.com',
          'popads.net', 'popcash.net', 'propellerads.com', 'adsterra.com',
          'coinhive.com', 'skimlinks.com', 'skimresources.com', 'viglink.com',
        ];

        for (const urlPattern of adUrlPatterns) {
          const escaped = urlPattern.replace(/\./g, '\\.');
          // Remove from host_permissions array entries
          const hostRegex = new RegExp(`"[^"]*\\*?${escaped}[^"]*"\\s*,?`, 'gi');
          patchedManifest = patchedManifest.replace(hostRegex, '/* REMOVED by Demonitize */');
          // Remove from permissions if listed directly
          const permRegex = new RegExp(`"${escaped}"\\s*,?\\s*`, 'gi');
          patchedManifest = patchedManifest.replace(permRegex, '');
        }

        writeTextFile(manifestPath, patchedManifest);
        patchesApplied.push({
          sdkName: 'Browser Ad Patterns',
          filePatched: 'manifest.json',
          change: 'Removed ad-related host permissions and URL patterns from manifest.json',
          success: true,
        });
      } catch (e: any) {
        patchesApplied.push({
          sdkName: 'Browser Ad Patterns',
          filePatched: 'manifest.json',
          change: 'Failed to patch manifest.json',
          success: false,
          error: e.message,
        });
      }
    }

    // Remove/neutralize ad injection JS files
    for (const jsFile of jsFiles) {
      try {
        let content = fs.readFileSync(jsFile, 'utf-8');
        let modified = false;

        // Check for ad injection patterns
        const adPatterns = [
          /document\.createElement\s*\(\s*["']script["']\s*\)/gi,
          /\.src\s*=\s*["'][^"']*?(?:doubleclick|googlesyndication|taboola|outbrain|popads|adserver|ad\.|ads\.|advert|sponsor)[^"']*["']/gi,
          /window\.open\s*\([^)]*?(?:popup|ad|sponsor|promo)[^)]*\)/gi,
          /fetch\s*\(\s*["'][^"']*?(?:adserver|ad\.|ads\.|analytics\.|track\.|pixel\.|beacon)[^"']*["']/gi,
          /XMLHttpRequest[^;]*?\.open\s*\([^,]*?,\s*["'][^"']*?(?:ad|track|pixel|beacon|analytics)[^"']*["']/gi,
        ];

        for (const pattern of adPatterns) {
          if (pattern.test(content)) {
            // Neutralize: wrap in a dead code block
            content = `/* DEMONITIZE: Ad injection neutralized */\n(function(){ return; /*\n${content}\n*/ })();`;
            modified = true;
            break;
          }
        }

        if (modified) {
          writeTextFile(jsFile, content);
          patchesApplied.push({
            sdkName: 'Ad Injection Neutralization',
            filePatched: path.relative(extractDir, jsFile),
            change: 'Neutralized ad injection code by wrapping in dead code block',
            success: true,
          });
        }
      } catch (e: any) {
        // skip unreadable
      }
    }

    updateJobResults(job.id, { patchesApplied });

    // =======================================================================
    // Step 5: Rebuild extension
    // =======================================================================
    updateJobStatus(job.id, 'rebuilding');

    const outputPath = getOutputPath(job.id, job.originalName);
    try {
      const repackagedZip = new AdmZip();

      walkDir(extractDir, (filePath, relativePath) => {
        // Skip macOS metadata
        if (relativePath.startsWith('__MACOSX') || relativePath.includes('/__MACOSX')) return;
        repackagedZip.addLocalFile(filePath, path.dirname(relativePath));
      });

      if (isCrx) {
        // For CRX output, we just write the plain ZIP (re-CRX-ing requires Chrome's private key)
        repackagedZip.writeZip(outputPath);
        patchesApplied.push({
          sdkName: 'CRX Packaging',
          filePatched: 'Extension package',
          change: 'Extension rebuilt as ZIP. NOTE: To load in Chrome, extract the ZIP and load as unpacked extension in Developer Mode, or re-package with your private key.',
          success: true,
        });
      } else {
        // XPI is just a ZIP
        repackagedZip.writeZip(outputPath);
        patchesApplied.push({
          sdkName: 'XPI Packaging',
          filePatched: 'Extension package',
          change: 'Firefox extension rebuilt. To install, go to about:debugging and load as temporary add-on, or re-sign via Mozilla AMO.',
          success: true,
        });
      }

      updateJobResults(job.id, { outputFile: path.basename(outputPath), patchesApplied });
      updateJobStatus(job.id, 'completed');
    } catch (e: any) {
      throw new Error(`Failed to repackage extension: ${e.message}`);
    }
  } catch (error: any) {
    updateJobResults(job.id, { error: error.message });
    updateJobStatus(job.id, 'failed');
    throw error;
  }
}
