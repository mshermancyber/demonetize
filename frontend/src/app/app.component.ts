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
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <a routerLink="/" class="logo">
          <span class="logo-icon">🛡️</span>
          <span class="logo-text">Demonitize</span>
        </a>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Upload</a>
          <a routerLink="/history" routerLinkActive="active">History</a>
        </nav>
      </header>
      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text-primary);
    }
    .logo-icon {
      font-size: 24px;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .nav-links {
      display: flex;
      gap: 24px;
    }
    .nav-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 0;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    .nav-links a:hover, .nav-links a.active {
      color: var(--text-primary);
      border-bottom-color: var(--accent-primary);
    }
    .app-content {
      flex: 1;
      padding: 32px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
    }
    @media (max-width: 768px) {
      .app-header { padding: 12px 16px; }
      .app-content { padding: 16px; }
    }
  `]
})
export class AppComponent {}
