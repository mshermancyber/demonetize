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

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Job, JobStatus } from '../../models/job.model';

const STATUS_STEPS: { status: JobStatus; label: string; icon: string }[] = [
  { status: 'uploaded', label: 'Uploaded', icon: '📤' },
  { status: 'extracting', label: 'Extracting', icon: '📦' },
  { status: 'scanning', label: 'Scanning for Ad SDKs', icon: '🔍' },
  { status: 'analyzing', label: 'AI Analysis', icon: '🧠' },
  { status: 'patching', label: 'Applying Patches', icon: '🔧' },
  { status: 'rebuilding', label: 'Rebuilding App', icon: '🏗️' },
  { status: 'completed', label: 'Complete', icon: '✅' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard fade-in">
      <div class="dashboard-header">
        <button class="btn btn-secondary btn-sm" (click)="router.navigate(['/history'])">← Back to History</button>
        <h2>Analysis Dashboard</h2>
      </div>

      <div class="job-meta card" *ngIf="job">
        <div class="meta-row">
          <span class="meta-label">File</span>
          <span class="meta-value">{{ job.originalName }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Platform</span>
          <span class="meta-value">{{ getPlatformDisplay(job.platform) }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status</span>
          <span class="meta-value">
            <span class="badge" [ngClass]="getStatusBadgeClass(job.status)">{{ job.status }}</span>
          </span>
        </div>
      </div>

      <!-- Pipeline Steps -->
      <div class="pipeline-steps">
        <div class="step" *ngFor="let step of statusSteps; let i = index" 
             [class.active]="isStepActive(step.status)"
             [class.done]="isStepDone(step.status)">
          <div class="step-indicator">
            <span class="step-icon">{{ isStepDone(step.status) ? '✅' : step.icon }}</span>
            <div class="step-line" *ngIf="i < statusSteps.length - 1" 
                 [class.filled]="isStepDone(step.status)"></div>
          </div>
          <div class="step-label">{{ step.label }}</div>
          <div class="step-status" *ngIf="isStepActive(step.status) && job?.status === step.status" 
               [class.status-pulse]="job?.status !== 'completed' && job?.status !== 'failed'">
            {{ job?.status === 'completed' ? 'Done' : 'In progress...' }}
          </div>
        </div>
      </div>

      <div class="progress-bar" *ngIf="job && job.status !== 'completed' && job.status !== 'failed'">
        <div class="progress-bar-fill progress-bar-indeterminate"></div>
      </div>

      <!-- Error State -->
      <div class="error-card card" *ngIf="job?.status === 'failed'">
        <h3>❌ Analysis Failed</h3>
        <p>{{ job?.error || 'An unknown error occurred.' }}</p>
        <div class="error-actions">
          <button class="btn btn-primary" (click)="reAnalyze()">🔄 Re-analyze</button>
          <button class="btn btn-secondary btn-sm" (click)="router.navigate(['/history'])">View History</button>
        </div>
      </div>

      <!-- Completed -->
      <div class="completed-card card" *ngIf="job?.status === 'completed'">
        <h3>✅ Analysis Complete!</h3>
        <p>
          Found <strong>{{ job?.adSdksFound?.length || 0 }} ad SDK(s)</strong>.
          Applied <strong>{{ job?.patchesApplied?.length || 0 }} patch(es)</strong>.
        </p>
        <div class="completed-actions">
          <button class="btn btn-primary" (click)="router.navigate(['/results', job?.id])">📊 View Results</button>
          <button class="btn btn-secondary" (click)="router.navigate(['/download', job?.id])">⬇️ Download Ad-Free App</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 700px; margin: 0 auto; }
    .dashboard-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .dashboard-header h2 { font-size: 24px; }
    .job-meta { margin-bottom: 32px; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: var(--text-muted); font-size: 13px; font-weight: 500; }
    .meta-value { font-size: 14px; font-weight: 500; }
    .pipeline-steps {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      overflow-x: auto;
      padding: 16px 0;
    }
    .step {
      flex: 1;
      min-width: 80px;
      text-align: center;
      opacity: 0.4;
      transition: opacity 0.3s ease;
    }
    .step.active, .step.done { opacity: 1; }
    .step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin-bottom: 8px;
    }
    .step-icon { font-size: 24px; }
    .step-line {
      flex: 1;
      height: 2px;
      background: var(--border-color);
      margin: 0 8px;
      min-width: 20px;
    }
    .step-line.filled { background: var(--accent-primary); }
    .step-label { font-size: 11px; font-weight: 500; color: var(--text-secondary); }
    .step-status { font-size: 10px; color: var(--accent-secondary); margin-top: 4px; }
    .error-card { margin-top: 24px; text-align: center; }
    .error-card h3 { margin-bottom: 12px; }
    .error-card p { color: var(--text-secondary); margin-bottom: 20px; }
    .error-actions, .completed-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .completed-card { margin-top: 24px; text-align: center; }
    .completed-card h3 { margin-bottom: 12px; }
    .completed-card p { color: var(--text-secondary); margin-bottom: 20px; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  job: Job | null = null;
  statusSteps = STATUS_STEPS;
  private pollInterval: any = null;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.startPolling(id);
    }
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  startPolling(id: string): void {
    this.fetchJob(id);
    this.pollInterval = setInterval(() => {
      this.fetchJob(id);
    }, 2000);
  }

  fetchJob(id: string): void {
    this.api.getJob(id).subscribe({
      next: (job) => {
        this.job = job;
        if (job.status === 'completed' || job.status === 'failed') {
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
        }
      },
      error: () => {},
    });
  }

  isStepActive(stepStatus: JobStatus): boolean {
    if (!this.job) return false;
    const currentIdx = this.getStatusIndex(this.job.status);
    const stepIdx = this.getStatusIndex(stepStatus);
    return stepIdx <= currentIdx;
  }

  isStepDone(stepStatus: JobStatus): boolean {
    if (!this.job) return false;
    const currentIdx = this.getStatusIndex(this.job.status);
    const stepIdx = this.getStatusIndex(stepStatus);
    return stepIdx < currentIdx || (stepIdx === currentIdx && this.job.status === 'completed');
  }

  getStatusIndex(status: JobStatus): number {
    return STATUS_STEPS.findIndex(s => s.status === status);
  }

  getStatusBadgeClass(status: JobStatus): string {
    switch (status) {
      case 'completed': return 'badge-success';
      case 'failed': return 'badge-danger';
      case 'analyzing':
      case 'patching': return 'badge-purple';
      default: return 'badge-info';
    }
  }

  getPlatformDisplay(platform: string): string {
    switch (platform) {
      case 'android': return '🤖 Android';
      case 'ios': return '🍎 iOS';
      case 'android-bundle': return '📦 Android Bundle';
      case 'browser': return '🌐 Browser Extension';
      case 'windows': return '🪟 Windows';
      case 'linux': return '🐧 Linux';
      default: return platform;
    }
  }

  reAnalyze(): void {
    if (!this.job) return;
    this.api.reAnalyze(this.job.id).subscribe({
      next: () => {
        this.startPolling(this.job!.id);
      },
      error: (err) => console.error('Re-analysis failed:', err),
    });
  }
}
