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

export type Platform = 'android' | 'ios' | 'android-bundle' | 'browser' | 'windows' | 'linux';
export type Format = 'apk' | 'ipa' | 'aab' | 'xapk' | 'apks' | 'apkm' | 'crx' | 'xpi' | 'msix' | 'appx' | 'appimage' | 'snap' | 'flatpak';
export type JobStatus = 'uploaded' | 'extracting' | 'scanning' | 'analyzing' | 'patching' | 'rebuilding' | 'completed' | 'failed';

/** Map a file extension to the Format string. */
export function extToFormat(ext: string): Format | null {
  const m: Record<string, Format> = {
    '.apk': 'apk',
    '.ipa': 'ipa',
    '.aab': 'aab',
    '.xapk': 'xapk',
    '.apks': 'apks',
    '.apkm': 'apkm',
    '.crx': 'crx',
    '.xpi': 'xpi',
    '.msix': 'msix',
    '.appx': 'appx',
    '.appimage': 'appimage',
    '.snap': 'snap',
    '.flatpak': 'flatpak',
  };
  return m[ext] || null;
}

/** Map a Format to the Platform category. */
export function formatToPlatform(fmt: Format): Platform {
  switch (fmt) {
    case 'apk':
    case 'aab':
    case 'xapk':
    case 'apks':
    case 'apkm':
      return 'android';
    case 'ipa':
      return 'ios';
    case 'crx':
    case 'xpi':
      return 'browser';
    case 'msix':
    case 'appx':
      return 'windows';
    case 'appimage':
    case 'snap':
    case 'flatpak':
      return 'linux';
  }
}

export interface AdSdkFinding {
  sdkName: string;
  packagePattern: string;
  detectedIn: string[];
  codeLocations: CodeLocation[];
  manifestEntries: ManifestEntry[];
}

export interface CodeLocation {
  file: string;
  line: number;
  snippet: string;
  type: 'initialization' | 'ad-load' | 'ad-display' | 'network-call' | 'callback';
}

export interface ManifestEntry {
  type: 'permission' | 'activity' | 'service' | 'receiver' | 'meta-data';
  name: string;
  line: number;
}

export interface AiAnalysis {
  sdkName: string;
  howItWorks: string;
  initializationFlow: string;
  displayEntryPoints: string[];
  minimalPatch: string;
  antiTamperConcerns: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PatchResult {
  sdkName: string;
  filePatched: string;
  change: string;
  success: boolean;
  error?: string;
}

export interface Job {
  id: string;
  filename: string;
  originalName: string;
  platform: Platform;
  format: Format;
  status: JobStatus;
  fileSize: number;
  adSdksFound: AdSdkFinding[];
  aiAnalyses: AiAnalysis[];
  patchesApplied: PatchResult[];
  outputFile: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
