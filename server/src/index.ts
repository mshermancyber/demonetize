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

import dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });

import express from 'express';
import cors from 'cors';
import path from 'path';
import { ensureDirectories } from './services/fileManager';
import { VERSION } from './version';
import healthRouter from './routes/health';
import uploadRouter from './routes/upload';
import jobsRouter from './routes/jobs';
import analyzeRouter from './routes/analyze';

const app = express();

// All network settings come from the environment so that no host, address or
// port is baked into the source. See .env.example for the available keys.
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

// Comma-separated list of allowed browser origins. When empty, no CORS headers
// are emitted and the API is same-origin only, which is what both the bundled
// production build and the dev-server proxy need.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Ensure required directories exist
ensureDirectories();

// Middleware
app.use(cors({
  origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : false,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Serve static frontend if built
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
app.use(express.static(frontendDist));

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/analyze', analyzeRouter);

// Fallback to frontend for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({
      message: 'Demonitize API Server',
      version: VERSION,
      endpoints: {
        health: '/api/health',
        upload: '/api/upload',
        jobs: '/api/jobs',
        jobsById: '/api/jobs/:id',
        download: '/api/jobs/:id/download',
        delete: '/api/jobs/:id (DELETE)',
        analyze: '/api/analyze/:id',
      },
    });
  }
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Demonitize API server v${VERSION} listening on ${HOST}:${PORT}`);
  console.log(`Health check: GET /api/health`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set — the AI analysis stage will use its heuristic fallback.');
  }
});

export default app;
