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
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Job, AiAnalysis, AdSdkFinding, PatchResult } from '../../models/job.model';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="results-page fade-in" *ngIf="job">
      <div class="results-header">
        <button class="btn btn-secondary btn-sm" (click)="router.navigate(['/dashboard', job.id])">← Dashboard</button>
        <div>
          <h2>Analysis Results</h2>
          <p class="subtitle">{{ job.originalName }}</p>
        </div>
        <button class="btn btn-primary btn-sm" (click)="router.navigate(['/download', job.id])">⬇️ Download</button>
      </div>

      <!-- Detected Ad SDKs -->
      <section class="section card">
        <h3>🔍 Detected Ad SDKs ({{ job.adSdksFound.length || 0 }})</h3>
        <div class="sdk-list" *ngIf="job.adSdksFound?.length; else noSdks">
          <div class="sdk-item" *ngFor="let finding of job.adSdksFound">
            <div class="sdk-header">
              <span class="sdk-name">{{ finding.sdkName }}</span>
              <span class="badge badge-purple">{{ finding.packagePattern }}</span>
            </div>
            <div class="sdk-details">
              <div class="detail-row" *ngIf="finding.codeLocations?.length">
                <span class="detail-label">Code Locations:</span>
                <div class="code-locations">
                  <div class="code-loc" *ngFor="let loc of finding.codeLocations.slice(0, 10)">
                    <code>{{ loc.file }}</code>
                    <span class="badge badge-info">{{ loc.type }}</span>
                    <span class="snippet">{{ loc.snippet }}</span>
                  </div>
                  <p class="more-hint" *ngIf="finding.codeLocations.length > 10">
                    ...and {{ finding.codeLocations.length - 10 }} more locations
                  </p>
                </div>
              </div>
              <div class="detail-row" *ngIf="finding.manifestEntries?.length">
                <span class="detail-label">Manifest Entries:</span>
                <div class="manifest-entries">
                  <span class="badge badge-warning" *ngFor="let entry of finding.manifestEntries">
                    {{ entry.type }}: {{ entry.name }}
                  </span>
                </div>
              </div>
              <div class="detail-row" *ngIf="finding.detectedIn?.length">
                <span class="detail-label">Detected in files:</span>
                <div class="detected-files">
                  <code *ngFor="let f of finding.detectedIn.slice(0, 5)">{{ f }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ng-template #noSdks>
          <p class="empty-state">No ad SDKs detected. 🎉</p>
        </ng-template>
      </section>

      <!-- AI Analysis -->
      <section class="section card" *ngIf="job.aiAnalyses?.length">
        <h3>🧠 AI Analysis</h3>
        <div class="ai-analysis" *ngFor="let analysis of job.aiAnalyses">
          <div class="ai-header">
            <h4>{{ analysis.sdkName }}</h4>
            <span class="badge" [ngClass]="getConfidenceBadge(analysis.confidence)">
              {{ analysis.confidence }} confidence
            </span>
          </div>
          <div class="ai-section">
            <h5>How It Works</h5>
            <p>{{ analysis.howItWorks }}</p>
          </div>
          <div class="ai-section">
            <h5>Initialization Flow</h5>
            <p>{{ analysis.initializationFlow }}</p>
          </div>
          <div class="ai-section" *ngIf="analysis.displayEntryPoints?.length">
            <h5>Display Entry Points</h5>
            <ul>
              <li *ngFor="let ep of analysis.displayEntryPoints">{{ ep }}</li>
            </ul>
          </div>
          <div class="ai-section patch">
            <h5>🔧 Minimal Patch Applied</h5>
            <pre>{{ analysis.minimalPatch }}</pre>
          </div>
          <div class="ai-section warning" *ngIf="analysis.antiTamperConcerns">
            <h5>⚠️ Anti-Tamper Concerns</h5>
            <p>{{ analysis.antiTamperConcerns }}</p>
          </div>
        </div>
      </section>

      <!-- Patches Applied -->
      <section class="section card" *ngIf="job.patchesApplied?.length">
        <h3>🔧 Patches Applied ({{ job.patchesApplied.length }})</h3>
        <div class="patch-list">
          <div class="patch-item" *ngFor="let patch of job.patchesApplied" [class.patch-failed]="!patch.success">
            <div class="patch-status">{{ patch.success ? '✅' : '❌' }}</div>
            <div class="patch-details">
              <div class="patch-sdk">{{ patch.sdkName }}</div>
              <div class="patch-file"><code>{{ patch.filePatched }}</code></div>
              <div class="patch-change">{{ patch.change }}</div>
              <div class="patch-error" *ngIf="patch.error">{{ patch.error }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .results-page { max-width: 900px; margin: 0 auto; }
    .results-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 32px;
    }
    .results-header > div { flex: 1; }
    .results-header h2 { font-size: 24px; }
    .subtitle { color: var(--text-muted); font-size: 13px; }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 18px; margin-bottom: 16px; }
    .sdk-list { display: flex; flex-direction: column; gap: 16px; }
    .sdk-item {
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 16px;
      background: var(--bg-secondary);
    }
    .sdk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .sdk-name { font-weight: 600; font-size: 16px; }
    .detail-row { margin-bottom: 8px; }
    .detail-label { color: var(--text-muted); font-size: 12px; display: block; margin-bottom: 4px; }
    .code-locations { display: flex; flex-direction: column; gap: 6px; }
    .code-loc {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .code-loc code { 
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .snippet { color: var(--text-muted); font-size: 11px; }
    .manifest-entries, .detected-files { display: flex; flex-wrap: wrap; gap: 6px; }
    .detected-files code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    .more-hint { color: var(--text-muted); font-size: 12px; margin-top: 4px; }
    .empty-state { text-align: center; padding: 24px; color: var(--text-muted); }
    .ai-analysis {
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 20px;
      background: var(--bg-secondary);
      margin-bottom: 16px;
    }
    .ai-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .ai-header h4 { font-size: 16px; }
    .ai-section { margin-bottom: 16px; }
    .ai-section h5 { font-size: 13px; color: var(--accent-secondary); margin-bottom: 6px; }
    .ai-section p, .ai-section li { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
    .ai-section ul { padding-left: 20px; }
    .ai-section.patch { 
      background: rgba(124, 58, 237, 0.08);
      border: 1px solid rgba(124, 58, 237, 0.2);
      border-radius: var(--radius-sm);
      padding: 12px;
    }
    .ai-section.patch pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .ai-section.warning {
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: var(--radius-sm);
      padding: 12px;
    }
    .patch-list { display: flex; flex-direction: column; gap: 8px; }
    .patch-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: var(--radius-sm);
      background: var(--bg-secondary);
      border-left: 3px solid var(--success);
    }
    .patch-item.patch-failed { border-left-color: var(--danger); }
    .patch-status { font-size: 18px; flex-shrink: 0; }
    .patch-details { flex: 1; }
    .patch-sdk { font-weight: 600; font-size: 14px; }
    .patch-file { margin: 2px 0; }
    .patch-file code { font-size: 12px; background: var(--bg-tertiary); padding: 1px 6px; border-radius: 3px; }
    .patch-change { font-size: 13px; color: var(--text-secondary); }
    .patch-error { font-size: 12px; color: var(--danger); margin-top: 4px; }
  `]
})
export class ResultsComponent implements OnInit {
  job: Job | null = null;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getJob(id).subscribe({
        next: (job) => { this.job = job; },
        error: () => {},
      });
    }
  }

  getConfidenceBadge(confidence: string): string {
    switch (confidence) {
      case 'high': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'low': return 'badge-danger';
      default: return 'badge-info';
    }
  }
}
