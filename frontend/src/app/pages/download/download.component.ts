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
import { Job } from '../../models/job.model';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="download-page fade-in" *ngIf="job">
      <div class="download-header">
        <button class="btn btn-secondary btn-sm" (click)="router.navigate(['/results', job.id])">← Results</button>
      </div>

      <div class="download-card card">
        <div class="success-icon">🎉</div>
        <h2>Your Ad-Free App is Ready!</h2>
        
        <div class="app-info">
          <div class="info-row">
            <span>Original File</span>
            <strong>{{ job.originalName }}</strong>
          </div>
          <div class="info-row">
            <span>Platform</span>
            <strong>{{ getPlatformDisplay(job.platform) }}</strong>
          </div>
          <div class="info-row">
            <span>Ad SDKs Removed</span>
            <strong>{{ job.adSdksFound.length || 0 }}</strong>
          </div>
          <div class="info-row">
            <span>Patches Applied</span>
            <strong>{{ job.patchesApplied.length || 0 }}</strong>
          </div>
          <div class="info-row">
            <span>Output File</span>
            <strong class="mono">{{ job.outputFile || 'N/A' }}</strong>
          </div>
        </div>

        <div class="download-actions">
          <a class="btn btn-primary btn-lg" [href]="api.getDownloadUrl(job.id)" download>
            ⬇️ Download Ad-Free App
          </a>
        </div>

        <div class="re-sign-note" *ngIf="job.platform === 'ios'">
          <p>⚠️ <strong>iOS Users:</strong> This IPA has been re-packaged but will need to be re-signed with your own provisioning profile before installation. Use tools like iOS App Signer, AltStore, or Sideloadly to re-sign and install.</p>
        </div>

        <div class="re-sign-note" *ngIf="job.platform === 'android' || job.platform === 'android-bundle'">
          <p>ℹ️ <strong>Android Users:</strong> This package has been rebuilt without signing. You may need to re-sign it before installing. For APK: enable "Install from Unknown Sources". For AAB: re-sign before uploading to Play Console.</p>
        </div>

        <div class="re-sign-note" *ngIf="job.platform === 'browser'">
          <p>ℹ️ <strong>Browser Extension:</strong> This extension has been repackaged. For Chrome: load as unpacked extension in Developer Mode. For Firefox: load temporarily in about:debugging or submit to AMO for signing.</p>
        </div>

        <div class="re-sign-note" *ngIf="job.platform === 'windows'">
          <p>⚠️ <strong>Windows Users:</strong> This MSIX/APPX package must be re-signed with your own code signing certificate before installation. Use SignTool or the Windows App Certification Kit.</p>
        </div>

        <div class="re-sign-note" *ngIf="job.platform === 'linux'">
          <p>ℹ️ <strong>Linux Users:</strong> The package content has been extracted. For AppImage: re-package with appimagetool. For Snap: use snapcraft. For Flatpak: use flatpak-builder.</p>
        </div>
      </div>

      <div class="other-actions">
        <button class="btn btn-secondary" (click)="router.navigate(['/results', job.id])">📊 View Detailed Results</button>
        <button class="btn btn-secondary" (click)="router.navigate(['/'])">📤 Process Another App</button>
      </div>
    </div>
  `,
  styles: [`
    .download-page { max-width: 600px; margin: 0 auto; }
    .download-header { margin-bottom: 24px; }
    .download-card { text-align: center; padding: 40px; }
    .success-icon { font-size: 64px; margin-bottom: 16px; }
    .download-card h2 { font-size: 24px; margin-bottom: 24px; }
    .app-info {
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 32px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 14px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-row span { color: var(--text-muted); }
    .download-actions { margin-bottom: 24px; }
    .btn-lg { padding: 16px 40px; font-size: 16px; }
    .re-sign-note {
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      padding: 16px;
      text-align: left;
      margin-top: 16px;
    }
    .re-sign-note p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
    .other-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
    }
  `]
})
export class DownloadComponent implements OnInit {
  job: Job | null = null;

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    public api: ApiService
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
}
