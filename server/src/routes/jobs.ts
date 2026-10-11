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

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getJob, getAllJobs, deleteJob as deleteJobFromDb } from '../database';
import { OUTPUT_DIR, cleanupJobFiles } from '../services/fileManager';

const router = Router();

// Get all jobs
router.get('/', (_req: Request, res: Response) => {
  try {
    const jobs = getAllJobs();
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single job
router.get('/:id', (req: Request, res: Response) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete job
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    // Clean up files
    cleanupJobFiles(job.id);
    
    // Delete from DB
    const deleted = deleteJobFromDb(req.params.id);
    
    res.json({ success: deleted, message: 'Job deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Download rebuilt app
router.get('/:id/download', (req: Request, res: Response) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.status !== 'completed') {
      res.status(400).json({ error: 'Job not yet completed. Current status: ' + job.status });
      return;
    }

    if (!job.outputFile) {
      res.status(404).json({ error: 'No output file available for this job' });
      return;
    }

    const outputPath = path.join(OUTPUT_DIR, job.outputFile);
    if (!fs.existsSync(outputPath)) {
      res.status(404).json({ error: 'Output file not found on disk. It may have been cleaned up.' });
      return;
    }

    const ext = path.extname(job.originalName);
    const baseName = path.basename(job.originalName, ext);
    const downloadName = `${baseName}_adfree${ext}`;

    // Content type map
    const contentTypeMap: Record<string, string> = {
      '.apk': 'application/vnd.android.package-archive',
      '.aab': 'application/octet-stream',
      '.xapk': 'application/octet-stream',
      '.apks': 'application/octet-stream',
      '.apkm': 'application/octet-stream',
      '.ipa': 'application/octet-stream',
      '.crx': 'application/x-chrome-extension',
      '.xpi': 'application/x-xpinstall',
      '.msix': 'application/octet-stream',
      '.appx': 'application/octet-stream',
      '.appimage': 'application/octet-stream',
      '.snap': 'application/octet-stream',
      '.flatpak': 'application/octet-stream',
    };

    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
    
    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
