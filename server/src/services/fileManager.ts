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

import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
export const UPLOADS_DIR = path.join(ROOT, 'uploads');
export const WORKING_DIR = path.join(ROOT, 'working');
export const OUTPUT_DIR = path.join(ROOT, 'output');

export function ensureDirectories(): void {
  [UPLOADS_DIR, WORKING_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function getJobDir(jobId: string): string {
  const dir = path.join(WORKING_DIR, jobId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Preserve the original extension for the output file. Sanitizes originalName to prevent path traversal and command injection. */
export function getOutputPath(jobId: string, originalName: string): string {
  const baseName = path.basename(originalName, path.extname(originalName));
  const ext = path.extname(originalName);
  // Sanitize: strip shell metacharacters, path separators, and control characters.
  // Only allow alphanumeric, dot, hyphen, and underscore.
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'file';
  return path.join(OUTPUT_DIR, `${jobId}_${safeBaseName}_adfree${ext}`);
}

export function cleanupJobFiles(jobId: string): void {
  const jobDir = path.join(WORKING_DIR, jobId);
  if (fs.existsSync(jobDir)) {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
  // Clean up upload
  const uploads = fs.readdirSync(UPLOADS_DIR);
  for (const file of uploads) {
    if (file.startsWith(jobId)) {
      fs.unlinkSync(path.join(UPLOADS_DIR, file));
    }
  }
  // Clean up output
  const outputs = fs.readdirSync(OUTPUT_DIR);
  for (const file of outputs) {
    if (file.startsWith(jobId)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeTextFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Find all files in a directory recursively matching a regex path pattern. */
export function findFilesByPathPattern(dir: string, pathPattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesByPathPattern(fullPath, pathPattern));
    } else if (pathPattern.test(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

export function listDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

/**
 * Walk a directory recursively calling a callback for each file.
 */
export function walkDir(dir: string, cb: (filePath: string, relativePath: string) => void): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, cb);
    } else {
      cb(fullPath, path.relative(dir, fullPath));
    }
  }
}
