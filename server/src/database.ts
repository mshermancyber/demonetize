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

import Database from 'better-sqlite3';
import path from 'path';
import { Job, JobStatus, Platform } from './types';

const DB_PATH = path.join(__dirname, '..', 'data', 'demonitize.db');

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const database = db;
  
  // Add format column if it doesn't exist (migration from v1)
  try {
    database.exec(`ALTER TABLE jobs ADD COLUMN format TEXT NOT NULL DEFAULT 'apk'`);
  } catch {
    // column already exists, ignore
  }
  
  // Recreate the jobs table with wider platform constraint if needed
  // (SQLite doesn't support ALTER CHECK, so we'll just ensure the column exists)
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      platform TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'apk',
      status TEXT NOT NULL DEFAULT 'uploaded',
      fileSize INTEGER NOT NULL DEFAULT 0,
      adSdksFound TEXT NOT NULL DEFAULT '[]',
      aiAnalyses TEXT NOT NULL DEFAULT '[]',
      patchesApplied TEXT NOT NULL DEFAULT '[]',
      outputFile TEXT,
      error TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      completedAt TEXT
    )
  `);
}

export function createJob(id: string, filename: string, originalName: string, platform: Platform, fileSize: number, format?: string): Job {
  const database = getDatabase();
  const fmt = format || 'apk';
  const stmt = database.prepare(`
    INSERT INTO jobs (id, filename, originalName, platform, format, status, fileSize)
    VALUES (?, ?, ?, ?, ?, 'uploaded', ?)
  `);
  stmt.run(id, filename, originalName, platform, fmt, fileSize);
  return getJob(id)!;
}

export function getJob(id: string): Job | undefined {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return deserializeJob(row);
}

export function getAllJobs(): Job[] {
  const database = getDatabase();
  const rows = database.prepare('SELECT * FROM jobs ORDER BY createdAt DESC').all() as any[];
  return rows.map(deserializeJob);
}

export function updateJobStatus(id: string, status: JobStatus): void {
  const database = getDatabase();
  const updates: any = { status };
  if (status === 'completed' || status === 'failed') {
    updates.completedAt = new Date().toISOString();
  }
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  database.prepare(`UPDATE jobs SET ${fields} WHERE id = ?`).run(...values, id);
}

export function updateJobResults(id: string, updates: {
  adSdksFound?: any[];
  aiAnalyses?: any[];
  patchesApplied?: any[];
  outputFile?: string;
  error?: string;
}): void {
  const database = getDatabase();
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.adSdksFound !== undefined) {
    setClauses.push('adSdksFound = ?');
    values.push(JSON.stringify(updates.adSdksFound));
  }
  if (updates.aiAnalyses !== undefined) {
    setClauses.push('aiAnalyses = ?');
    values.push(JSON.stringify(updates.aiAnalyses));
  }
  if (updates.patchesApplied !== undefined) {
    setClauses.push('patchesApplied = ?');
    values.push(JSON.stringify(updates.patchesApplied));
  }
  if (updates.outputFile !== undefined) {
    setClauses.push('outputFile = ?');
    values.push(updates.outputFile);
  }
  if (updates.error !== undefined) {
    setClauses.push('error = ?');
    values.push(updates.error);
  }

  if (setClauses.length > 0) {
    values.push(id);
    database.prepare(`UPDATE jobs SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function deleteJob(id: string): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return result.changes > 0;
}

function deserializeJob(row: any): Job {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    platform: row.platform as Platform,
    format: row.format || 'apk',
    status: row.status as JobStatus,
    fileSize: row.fileSize,
    adSdksFound: JSON.parse(row.adSdksFound || '[]'),
    aiAnalyses: JSON.parse(row.aiAnalyses || '[]'),
    patchesApplied: JSON.parse(row.patchesApplied || '[]'),
    outputFile: row.outputFile || null,
    error: row.error || null,
    createdAt: row.createdAt,
    completedAt: row.completedAt || null,
  };
}
