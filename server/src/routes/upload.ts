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
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Platform, Job, extToFormat, formatToPlatform } from '../types';
import { createJob } from '../database';
import { UPLOADS_DIR, ensureDirectories } from '../services/fileManager';
import { runApkPipeline } from '../pipelines/apkPipeline';
import { runIpaPipeline } from '../pipelines/ipaPipeline';
import { runAabPipeline } from '../pipelines/aabPipeline';
import { runXapkPipeline } from '../pipelines/xapkPipeline';
import { runCrxPipeline } from '../pipelines/crxPipeline';
import { runMsixPipeline } from '../pipelines/msixPipeline';
import { runLinuxPipeline } from '../pipelines/linuxPipeline';

const router = Router();

// All supported extensions
const ALLOWED_EXTENSIONS = [
  '.apk', '.ipa',
  '.aab',
  '.xapk', '.apks', '.apkm',
  '.crx', '.xpi',
  '.msix', '.appx',
  '.appimage', '.snap', '.flatpak',
];

// Configure multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirectories();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const jobId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${jobId}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
});

type PipelineRunner = (job: Job) => Promise<void>;

function routePipeline(job: Job): PipelineRunner {
  const fmt = extToFormat(path.extname(job.filename).toLowerCase());
  switch (fmt) {
    case 'apk':
      return runApkPipeline;
    case 'ipa':
      return runIpaPipeline;
    case 'aab':
      return runAabPipeline;
    case 'xapk':
    case 'apks':
    case 'apkm':
      return runXapkPipeline;
    case 'crx':
    case 'xpi':
      return runCrxPipeline;
    case 'msix':
    case 'appx':
      return runMsixPipeline;
    case 'appimage':
    case 'snap':
    case 'flatpak':
      return runLinuxPipeline;
    default:
      throw new Error(`No pipeline available for format: ${fmt}`);
  }
}

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: 'No file uploaded. Please provide a supported file.',
        supportedFormats: ALLOWED_EXTENSIONS,
      });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fmt = extToFormat(ext);
    if (!fmt) {
      res.status(400).json({ error: `Unsupported format: ${ext}` });
      return;
    }

    const platform: Platform = formatToPlatform(fmt);

    // Extract jobId from filename (it's {jobId}.ext)
    const jobId = path.basename(req.file.filename, ext);

    const job = createJob(
      jobId,
      req.file.filename,
      req.file.originalname,
      platform,
      req.file.size,
      fmt
    );

    // Start pipeline asynchronously
    const pipelineRunner = routePipeline(job);
    pipelineRunner(job).catch(err => {
      console.error(`Pipeline failed for ${jobId} (${fmt}):`, err.message);
    });

    res.status(201).json({
      jobId: job.id,
      filename: job.originalName,
      platform: job.platform,
      format: fmt,
      fileSize: job.fileSize,
      status: job.status,
      message: 'File uploaded successfully. Analysis pipeline started.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

export default router;
