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

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Job } from '../../models/job.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-page fade-in">
      <div class="history-header">
        <h2>📋 Processing History</h2>
        <button class="btn btn-primary" (click)="router.navigate(['/'])">📤 Upload New App</button>
      </div>

      <div class="refresh-row">
        <button class="btn btn-secondary btn-sm" (click)="loadJobs()">🔄 Refresh</button>
        <span class="job-count" *ngIf="jobs.length">{{ jobs.length }} job(s)</span>
      </div>

      <div class="empty-state" *ngIf="!loading && jobs.length === 0">
        <div class="empty-icon">📭</div>
        <h3>No apps processed yet</h3>
        <p>Upload an APK or IPA to get started!</p>
        <button class="btn btn-primary" (click)="router.navigate(['/'])">Upload App</button>
      </div>

      <div class="jobs-list" *ngIf="jobs.length > 0">
        <div class="job-card card" *ngFor="let job of jobs">
          <div class="job-main">
            <div class="job-icon">{{ getPlatformIcon(job.platform) }}</div>
            <div class="job-info">
              <h4>{{ job.originalName }}</h4>
              <div class="job-meta">
                <span>{{ job.platform }}</span>
                <span>•</span>
                <span>{{ formatFileSize(job.fileSize) }}</span>
                <span>•</span>
                <span class="badge" [ngClass]="getStatusBadge(job.status)">{{ job.status }}</span>
              </div>
              <div class="job-time">
                {{ formatDate(job.createdAt) }}
                <span *ngIf="job.completedAt"> → {{ formatDate(job.completedAt) }}</span>
              </div>
            </div>
            <div class="job-stats" *ngIf="job.status === 'completed'">
              <div class="stat">
                <span class="stat-value">{{ job.adSdksFound.length || 0 }}</span>
                <span class="stat-label">SDKs</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ countSuccessfulPatches(job) }}</span>
                <span class="stat-label">Patches</span>
              </div>
            </div>
          </div>
          <div class="job-actions">
            <button class="btn btn-secondary btn-sm" 
                    *ngIf="job.status === 'completed' || job.status === 'failed'"
                    (click)="router.navigate(['/dashboard', job.id])">
              Dashboard
            </button>
            <button class="btn btn-secondary btn-sm" 
                    *ngIf="job.status === 'completed'"
                    (click)="router.navigate(['/results', job.id])">
              Results
            </button>
            <a class="btn btn-primary btn-sm" 
               *ngIf="job.status === 'completed'"
               [href]="api.getDownloadUrl(job.id)">
              ⬇️ Download
            </a>
            <button class="btn btn-secondary btn-sm" 
                    *ngIf="job.status === 'uploaded' || job.status === 'extracting' || job.status === 'scanning' || job.status === 'analyzing' || job.status === 'patching' || job.status === 'rebuilding'"
                    (click)="router.navigate(['/dashboard', job.id])">
              View Progress
            </button>
            <button class="btn btn-danger btn-sm" (click)="deleteJob(job)">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .history-page { max-width: 900px; margin: 0 auto; }
    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .history-header h2 { font-size: 24px; }
    .refresh-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .job-count { color: var(--text-muted); font-size: 13px; }
    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 56px; margin-bottom: 16px; }
    .empty-state h3 { font-size: 20px; margin-bottom: 8px; }
    .empty-state p { color: var(--text-secondary); margin-bottom: 20px; }
    .jobs-list { display: flex; flex-direction: column; gap: 12px; }
    .job-card { padding: 16px 20px; }
    .job-main { display: flex; align-items: center; gap: 16px; }
    .job-icon { font-size: 32px; flex-shrink: 0; }
    .job-info { flex: 1; min-width: 0; }
    .job-info h4 { 
      font-size: 14px; 
      white-space: nowrap; 
      overflow: hidden; 
      text-overflow: ellipsis; 
      margin-bottom: 4px;
    }
    .job-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .job-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .job-stats {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
    }
    .stat {
      text-align: center;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border-radius: var(--radius-sm);
    }
    .stat-value { display: block; font-size: 20px; font-weight: 700; color: var(--accent-secondary); }
    .stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .job-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }
  `]
})
export class HistoryComponent implements OnInit {
  jobs: Job[] = [];
  loading = true;

  constructor(public router: Router, public api: ApiService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading = true;
    this.api.getAllJobs().subscribe({
      next: (jobs) => {
        this.jobs = jobs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  deleteJob(job: Job): void {
    if (confirm(`Delete analysis for "${job.originalName}"? This will remove all files and results.`)) {
      this.api.deleteJob(job.id).subscribe({
        next: () => {
          this.jobs = this.jobs.filter(j => j.id !== job.id);
        },
        error: (err) => {
          console.error('Delete failed:', err);
        },
      });
    }
  }

  countSuccessfulPatches(job: Job): number {
    return (job.patchesApplied || []).filter(p => p.success).length;
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'completed': return 'badge-success';
      case 'failed': return 'badge-danger';
      case 'analyzing':
      case 'patching': return 'badge-purple';
      default: return 'badge-info';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'android': return '🤖';
      case 'ios': return '🍎';
      case 'android-bundle': return '📦';
      case 'browser': return '🌐';
      case 'windows': return '🪟';
      case 'linux': return '🐧';
      default: return '📱';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
