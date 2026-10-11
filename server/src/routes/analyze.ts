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
import { getJob, updateJobStatus } from '../database';
import { extToFormat } from '../types';
import { runApkPipeline } from '../pipelines/apkPipeline';
import { runIpaPipeline } from '../pipelines/ipaPipeline';
import { runAabPipeline } from '../pipelines/aabPipeline';
import { runXapkPipeline } from '../pipelines/xapkPipeline';
import { runCrxPipeline } from '../pipelines/crxPipeline';
import { runMsixPipeline } from '../pipelines/msixPipeline';
import { runLinuxPipeline } from '../pipelines/linuxPipeline';

const router = Router();

type PipelineRunner = (job: any) => Promise<void>;

function routePipelineByFormat(format: string): PipelineRunner {
  switch (format) {
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
      throw new Error(`No pipeline available for format: ${format}`);
  }
}

// Trigger re-analysis
router.post('/:id', async (req: Request, res: Response) => {
  try {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Reset job status and re-run
    updateJobStatus(job.id, 'uploaded');

    const fmt = (job as any).format || extToFormat(path.extname(job.filename).toLowerCase()) || 'apk';
    const pipelineRunner = routePipelineByFormat(fmt);
    pipelineRunner(job).catch(err => {
      console.error(`Re-analysis failed for ${job.id} (${fmt}):`, err.message);
    });

    res.json({
      jobId: job.id,
      message: 'Re-analysis started',
      status: 'uploaded',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
