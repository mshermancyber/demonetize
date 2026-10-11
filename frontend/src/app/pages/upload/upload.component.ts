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

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

interface FormatInfo {
  ext: string;
  display: string;
  icon: string;
  platform: string;
}

const SUPPORTED_FORMATS: FormatInfo[] = [
  { ext: '.apk', display: 'APK', icon: '🤖', platform: 'Android' },
  { ext: '.ipa', display: 'IPA', icon: '🍎', platform: 'iOS' },
  { ext: '.aab', display: 'AAB', icon: '📦', platform: 'Android Bundle' },
  { ext: '.xapk', display: 'XAPK', icon: '📦', platform: 'Android Split' },
  { ext: '.apks', display: 'APKS', icon: '📦', platform: 'Android Split' },
  { ext: '.apkm', display: 'APKM', icon: '📦', platform: 'Android Split' },
  { ext: '.crx', display: 'CRX', icon: '🌐', platform: 'Chrome Extension' },
  { ext: '.xpi', display: 'XPI', icon: '🦊', platform: 'Firefox Extension' },
  { ext: '.msix', display: 'MSIX', icon: '🪟', platform: 'Windows Store' },
  { ext: '.appx', display: 'APPX', icon: '🪟', platform: 'Windows Store' },
  { ext: '.appimage', display: 'AppImage', icon: '🐧', platform: 'Linux' },
  { ext: '.snap', display: 'Snap', icon: '🐧', platform: 'Linux' },
  { ext: '.flatpak', display: 'Flatpak', icon: '🐧', platform: 'Linux' },
];

const ALLOWED_EXTS: string[] = SUPPORTED_FORMATS.map(f => f.ext);

function getFormatInfo(ext: string): FormatInfo | undefined {
  return SUPPORTED_FORMATS.find(f => f.ext === ext.toLowerCase());
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="upload-page fade-in">
      <div class="hero">
        <h1>Remove Ads from Any App or Extension</h1>
        <p>Surgically disable advertising SDKs across mobile apps, browser extensions, Windows Store apps, and Linux packages — while preserving functionality.</p>
      </div>

      <div class="upload-zone" 
           [class.drag-over]="isDragOver"
           (dragover)="onDragOver($event)"
           (dragleave)="onDragLeave($event)"
           (drop)="onDrop($event)">
        <input type="file" #fileInput (change)="onFileSelected($event)" [accept]="allowedExtsStr" style="display:none" />

        <div class="upload-content" *ngIf="!selectedFile">
          <div class="upload-icon">🛡️</div>
          <h3>Drop any supported file here</h3>
          <p>or</p>
          <button class="btn btn-primary" (click)="fileInput.click()">
            Browse Files
          </button>
          <p class="upload-hint">Supports APK, IPA, AAB, XAPK, CRX, XPI, MSIX, AppImage, and more — up to 500MB</p>
        </div>

        <div class="file-info" *ngIf="selectedFile && !uploading">
          <div class="file-icon">{{ formatIcon }}</div>
          <div class="file-details">
            <h4>{{ selectedFile.name }}</h4>
            <p>{{ formatFileSize(selectedFile.size) }}</p>
            <p class="platform-badge">{{ formatLabel }}</p>
          </div>
          <button class="btn btn-secondary btn-sm" (click)="clearFile()">Remove</button>
        </div>
      </div>

      <div class="upload-actions" *ngIf="selectedFile && !uploading">
        <button class="btn btn-primary btn-lg" (click)="uploadFile()">
          ⚡ Start Analysis
        </button>
      </div>

      <div class="uploading-state" *ngIf="uploading">
        <div class="progress-bar">
          <div class="progress-bar-fill progress-bar-indeterminate"></div>
        </div>
        <p>Uploading and starting analysis...</p>
      </div>

      <div class="error-message" *ngIf="error">
        <p>❌ {{ error }}</p>
      </div>

      <div class="supported-formats">
        <h3>All Supported Formats</h3>
        <div class="format-grid">
          <div class="format-category" *ngFor="let group of formatGroups">
            <div class="category-label">{{ group.label }}</div>
            <div class="category-items">
              <span class="format-tag" *ngFor="let f of group.formats">{{ f.icon }} {{ f.display }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .upload-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    .hero {
      text-align: center;
      max-width: 600px;
      margin-bottom: 16px;
    }
    .hero h1 {
      font-size: 32px;
      font-weight: 700;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .hero p {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.6;
    }
    .upload-zone {
      width: 100%;
      max-width: 520px;
      min-height: 260px;
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      cursor: pointer;
      background: var(--bg-card);
    }
    .upload-zone:hover, .upload-zone.drag-over {
      border-color: var(--accent-primary);
      background: rgba(124, 58, 237, 0.05);
      box-shadow: 0 0 32px var(--accent-glow);
    }
    .upload-content {
      text-align: center;
      padding: 40px;
    }
    .upload-icon {
      font-size: 56px;
      margin-bottom: 16px;
    }
    .upload-content h3 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    .upload-content p {
      color: var(--text-muted);
      font-size: 14px;
      margin: 8px 0;
    }
    .upload-hint {
      font-size: 12px !important;
      color: var(--text-muted) !important;
    }
    .file-info {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      width: 100%;
    }
    .file-icon { font-size: 40px; }
    .file-details { flex: 1; }
    .file-details h4 { font-size: 16px; word-break: break-all; }
    .file-details p { color: var(--text-secondary); font-size: 13px; }
    .platform-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--bg-tertiary);
      font-size: 11px !important;
      color: var(--accent-secondary) !important;
      margin-top: 4px;
    }
    .upload-actions { margin-top: 8px; }
    .btn-lg { padding: 14px 36px; font-size: 16px; }
    .uploading-state { text-align: center; width: 100%; max-width: 520px; }
    .uploading-state p { margin-top: 12px; color: var(--text-secondary); }
    .error-message { 
      background: rgba(239, 68, 68, 0.1); 
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      color: var(--danger);
      max-width: 520px;
      width: 100%;
    }
    .supported-formats {
      max-width: 520px;
      width: 100%;
      margin-top: 16px;
      padding: 20px;
      background: var(--bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-color);
    }
    .supported-formats h3 {
      font-size: 14px;
      margin-bottom: 12px;
      color: var(--text-secondary);
    }
    .format-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .format-category {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .category-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }
    .category-items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .format-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 14px;
      background: var(--bg-tertiary);
      font-size: 12px;
      color: var(--text-secondary);
    }
  `]
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploading = false;
  isDragOver = false;
  error: string | null = null;

  allowedExtsStr = ALLOWED_EXTS.join(',');

  formatGroups = [
    {
      label: 'Mobile Apps',
      formats: [
        { ext: '.apk', display: 'APK', icon: '🤖' },
        { ext: '.ipa', display: 'IPA', icon: '🍎' },
        { ext: '.aab', display: 'AAB', icon: '📦' },
        { ext: '.xapk', display: 'XAPK', icon: '📦' },
        { ext: '.apks', display: 'APKS', icon: '📦' },
        { ext: '.apkm', display: 'APKM', icon: '📦' },
      ],
    },
    {
      label: 'Browser Extensions',
      formats: [
        { ext: '.crx', display: 'CRX', icon: '🌐' },
        { ext: '.xpi', display: 'XPI', icon: '🦊' },
      ],
    },
    {
      label: 'Windows Store Apps',
      formats: [
        { ext: '.msix', display: 'MSIX', icon: '🪟' },
        { ext: '.appx', display: 'APPX', icon: '🪟' },
      ],
    },
    {
      label: 'Linux Packages',
      formats: [
        { ext: '.appimage', display: 'AppImage', icon: '🐧' },
        { ext: '.snap', display: 'Snap', icon: '🐧' },
        { ext: '.flatpak', display: 'Flatpak', icon: '🐧' },
      ],
    },
  ];

  get formatIcon(): string {
    if (!this.selectedFile) return '📱';
    const ext = '.' + (this.selectedFile.name.split('.').pop()?.toLowerCase() || '');
    return getFormatInfo(ext)?.icon || '📱';
  }

  get formatLabel(): string {
    if (!this.selectedFile) return '';
    const ext = '.' + (this.selectedFile.name.split('.').pop()?.toLowerCase() || '');
    const info = getFormatInfo(ext);
    return info ? `${info.platform} (${info.display})` : 'Unknown';
  }

  constructor(private api: ApiService, private router: Router) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.validateAndSetFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSetFile(input.files[0]);
    }
  }

  private getFileExt(file: File): string {
    const name = file.name.toLowerCase();
    for (const ext of ALLOWED_EXTS) {
      if (name.endsWith(ext)) return ext;
    }
    return '';
  }

  validateAndSetFile(file: File): void {
    this.error = null;
    const ext = this.getFileExt(file);
    if (!ext) {
      this.error = `Unsupported format. Supported: ${ALLOWED_EXTS.join(', ')}`;
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      this.error = 'File size exceeds 500MB limit.';
      return;
    }
    this.selectedFile = file;
  }

  clearFile(): void {
    this.selectedFile = null;
    this.error = null;
  }

  uploadFile(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.error = null;

    this.api.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        this.uploading = false;
        this.router.navigate(['/dashboard', response.jobId]);
      },
      error: (err) => {
        this.uploading = false;
        this.error = err.error?.error || err.message || 'Upload failed. Please try again.';
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
