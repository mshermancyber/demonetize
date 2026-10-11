# Demonitize — Project Documentation

Version 0.1.0 · Licensed under the GNU GPL v3.0 or later (see `LICENSE`).

## Overview

**Demonitize** is a web application that detects and surgically removes advertising SDKs from software packages. Users upload an application file (Android APK, iOS IPA, browser extension, Windows Store app, Linux package, etc.), and the tool analyzes it through a multi-stage pipeline — extraction, scanning, AI-powered analysis, patching, and ultimately rebuilding an ad-free version of the app.

The name "Demonitize" is a play on "demonetize" — the project's goal is to strip monetization (advertising) code while preserving the app's core functionality.

---

## Tech Stack

### Frontend
- **Framework**: Angular 18 (standalone components)
- **Language**: TypeScript (~5.5.4)
- **Key Libraries**: RxJS 7.8, Angular Router, Angular HTTP Client
- **Dev Server**: `ng serve` (Angular CLI default port), proxying `/api` to the API server via `proxy.conf.js`
- **API Base URL**: `/api` on the serving origin, configured in `src/environments/environment.ts`

### Backend
- **Runtime**: Node.js
- **Framework**: Express 4.21
- **Language**: TypeScript (ES2022 target, CommonJS modules)
- **Database**: SQLite via `better-sqlite3` (WAL mode, stored at `server/data/demonitize.db`)
- **Key Libraries**:
  - `adm-zip` — extracting ZIP-based package formats
  - `axml2xml` — converting Android binary XML to readable XML
  - `multer` — handling multipart file uploads
  - `openai` — AI-powered ad code analysis (OpenAI-compatible API)
  - `uuid` — generating unique job IDs
- **External Tools**: `apktool.jar` plus a JRE for APK decompilation — not distributed with the project; discovered at runtime (see *External Tooling* below)
- **Networking**: host, port and allowed CORS origins all come from the environment (`HOST`, `PORT`, `CORS_ORIGINS`); no address or port is baked into the source

---

## Project Structure

```
demonetize/
├── package.json                    # Root workspace scripts (install, build, start)
├── .env.example                    # Template for local config (copy to .env; .env is git-ignored)
├── LICENSE                         # GNU GPL v3.0
├── README.md                       # Overview, quick start, configuration
├── CHANGELOG.md                    # Release history
├── DOCS.md                         # This file
│
├── frontend/                       # Angular 18 SPA
│   ├── angular.json                # Angular CLI config
│   ├── proxy.conf.js               # Dev-server /api proxy (target read from env)
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── tsconfig.app.json            # App-specific TS config
│   └── src/
│       ├── index.html               # SPA entry HTML
│       ├── main.ts                  # Angular bootstrap
│       ├── styles.css                # Global styles
│       ├── environments/
│       │   └── environment.ts       # API base URL (relative by default)
│       ├── app/
│          ├── app.component.ts     # Root component (header, nav, router-outlet)
│          ├── app.config.ts         # App config (providers: router, HTTP, zone)
│          ├── app.routes.ts         # Route definitions
│          ├── models/
│          │   └── job.model.ts      # TypeScript interfaces (Job, AdSdkFinding, etc.)
│          ├── pages/
│          │   ├── upload/         # File upload page (home)
│          │   ├── dashboard/      # Live pipeline progress dashboard
│          │   ├── results/        # Detailed scan results + AI analysis
│          │   ├── download/       # Download rebuilt ad-free app
│          │   ├── history/        # All past jobs list
│          ├── services/
│              └── api.service.ts  # HTTP client for backend API
│
├── server/                         # Express API server
│   ├── package.json                # Server dependencies
│   ├── tsconfig.json                # TypeScript config (ES2022, CommonJS)
│   ├── tools/                      # (git-ignored) optional apktool.jar + JRE
│   └── src/
│       ├── index.ts                # Server entry point (Express app setup)
│       ├── version.ts              # Version reported by the API
│       ├── types.ts                # Shared types, interfaces, format/platform mapping
│       ├── database.ts             # SQLite database layer (CRUD for jobs)
│       ├── routes/
│       │   ├── health.ts           # GET /api/health — health check
│       │   ├── upload.ts           # POST /api/upload — file upload + pipeline trigger
│       │   ├── jobs.ts             # GET/DELETE /api/jobs[/:id] — job CRUD + download
│       │   ├── analyze.ts          # POST /api/analyze/:id — re-trigger analysis
│       ├── pipelines/
│       │   ├── apkPipeline.ts      # APK analysis pipeline (uses apktool)
│       │   ├── ipaPipeline.ts      #  iOS IPA analysis pipeline
│       │   ├── aabPipeline.ts      # Android App Bundle pipeline
│       │   ├── xapkPipeline.ts     # XAPK/APKS/APKM split APK pipeline
│       │   ├── crxPipeline.ts      # Chrome/Firefox extension pipeline
│       │   ├── msixPipeline.ts     # Windows MSIX/APPX pipeline
│       │   ├── linuxPipeline.ts    # Linux AppImage/Snap/Flatpak pipeline
│       ├── services/
│          ├── adSdkDatabase.ts    # Known ad SDK signatures database
│          ├── aiAnalysis.ts       # OpenAI-powered ad code analysis
│          ├── fileManager.ts      # File I/O, directory management, cleanup
│
└── test-samples/                   # (git-ignored) local packages for testing
```

Runtime directories — `server/uploads/`, `server/working/`, `server/output/`,
`server/data/` — are created on first run and are git-ignored.

---

## Supported File Formats

| Extension | Format | Platform | Description |
|-----------|--------|----------|--------------|
| `.apk` | APK | Android | Standard Android package |
| `.ipa` | IPA | iOS | iOS app package |
| `.aab` | AAB | Android Bundle | Android App Bundle |
| `.xapk` | XAPK | Android | Split APK (XAPK) |
| `.apks` | APKS | Android | Split APK bundle |
| `.apkm` | APKM | Android | Split APK (APKM) |
| `.crx` | CRX | Browser Extension | Chrome extension |
| `.xpi` | XPI | Browser Extension | Firefox extension |
| `.msix` | MSIX | Windows | Windows Store package |
| `.appx` | APPX | Windows | Legacy Windows Store package |
| `.appimage` | AppImage | Linux | Linux AppImage |
| `.snap` | Snap | Linux | Snap package |
| `.flatpak` | Flatpak | Linux | Flatpak package |

---

## Pipeline Stages

Every uploaded file goes through these stages:

1. **Uploaded** — File received and stored on disk
2. **Extracting** — Package is decompressed (ZIP-based for most formats; CRX headers stripped; APK goes through apktool)
3. **Scanning** — Binary strings, manifest files, and code are scanned for known ad SDK signatures
4. **Analyzing** — OpenAI API is called to deeply analyze detected ad code (initialization flow, display entry points, anti-tamper mechanisms)
5. **Patching** — Ad SDK integration points are surgically neutralized (smali code patching for APK binary patching for IPA, etc.)
6. **Rebuilding** — The modified package is reassembled into its original format
7. **Completed** (or **Failed**) — Final state

---

## Ad SDK Detection

The detection system uses multiple complementary strategies:

### Signature-Based Detection
The `adSdkDatabase.ts` file contains a comprehensive database of known ad SDK signatures including:
- **Package patterns** (e.g., `com.google.android.gms.ads`)
- **Class patterns** (e.g., `com/google/android/gms/ads/AdView`)
- **Method patterns** (e.g., `MobileAds/initialize`, `loadAd`)
- **Manifest patterns** (e.g., Android manifest entries)
- **URL patterns** (e.g., `doubleclick.net`, `googlesyndication.com`)

### Supported Ad SDKs (partial list)
- Google AdMob
- Facebook Audience Network
- Unity Ads
- AppLovin
- IronSource
- Vungle
- AdColony
- Chartboost
- InMobi
- MoPub (AdMob Mediation)
- StartApp
-  Tapjoy
- Mintegral
- Fyber / Digital Turbine
- And more...

### Platform-Specific Detection
- **Android**: smali code analysis via apktool decompilation, AndroidManifest.xml scanning
- **iOS**: binary string extraction, Info.plist scanning, framework name matching
- **Browser Extensions**: JavaScript pattern matching for ad networks, manifest.json scanning
- **Windows**: DLL name matching, AppxManifest.xml parsing
- **Linux**: binary string extraction, HTML/JS pattern matching for embedded web content

---

## AI Analysis

When ad SDKs are detected, the system calls the OpenAI API (configurable via `OPENAI_API_KEY` in `.env`) with structured prompts asking the AI to:

1. Explain **how the ad SDK works** and integrates
2. Trace the **initialization flow** (entry point + call chain)
3. Identify **display entry points** for ad content
4. Suggest a **minimal surgical patch** to disable ads
5. Flag **anti-tamper concerns** (code that might detect or resist patching)
6. Assign a **confidence level** (high/medium/low)

This analysis is shown to users in the Results page and guides the patching step.

---

## API Endpoints

| Method | Path | Description |
|-------|------|-------------|
| `GET` | `/api/health` | Health check (returns service name, version, timestamp) |
| `POST` | `/api/upload` | Upload a file (multipart/form-data). Triggers the appropriate pipeline. |
| `GET` | `/api/jobs` | List all jobs (newest first) |
| `GET` | `/api/jobs/:id` | Get a single job by ID |
| `DELETE` | `/api/jobs/:id` | Delete a job and its associated files |
| `GET` | `/api/jobs/:id/download` | Download the rebuilt ad-free output file |
| `POST` | `/api/analyze/:id` | Re-trigger analysis on an existing job |

---

## Frontend Pages

| Route | Component | Description |
|-------|------------|-------------|
| `/` | UploadComponent | Home page — drag-and-drop file upload, supported format badges |
| `/dashboard/:id` | DashboardComponent | Real-time pipeline progress tracker with step indicators |
| `/results/:id` | ResultsComponent | Detailed findings: detected SDKs, code locations, AI analysis, patches |
| `/download/:id` | DownloadComponent | Download link for rebuilt ad-free app |
| `/history` | HistoryComponent | List of all processed apps with status, stats, and actions |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Java runtime and `apktool.jar`, for APK smali patching (optional; see *External Tooling*)
- OpenAI API key (for AI analysis feature)

### Installation
```bash
git clone https://github.com/mshermancyber/demonetize.git
cd demonetize
npm run install:all        # Install server + frontend dependencies
```

### Configuration
Copy `.env.example` to `.env` at the project root and edit it. Every key is
optional and documented in that file; the defaults bind the API server to the
loopback address, allow no cross-origin callers, and run AI analysis in
heuristic fallback mode.

### Build
```bash
npm run build:server       # Compile TypeScript server to dist/
npm run build:frontend     # Build Angular app to frontend/dist/
```

### Run (Development)
```bash
npm run dev:server         # Start server with ts-node (auto-reload)
npm run start:frontend     # Start Angular dev server (proxies /api to the API server)
```

### Run (Production)
```bash
npm run start:server       # Start compiled server (serves frontend from dist/)
```

---

## Database

- **Engine**: SQLite via `better-sqlite3`
- **Location**: `server/data/demonitize.db`
- **WAL Mode**: Enabled for better concurrent read performance
- **Schema**: Single `jobs` table with columns for id, filename, originalName, platform, format, status, fileSize, adSdksFound (JSON), aiAnalyses (JSON), patchesApplied (JSON), outputFile, error, createdAt, completedAt

---

## Key Design Decisions

1. **Monorepo with separate packages**: Frontend and server are separate npm packages under one root, allowing independent builds and deployments.
2. **Runtime-discovered Android tooling**: `apktool.jar` and a JRE are not distributed with the project, for size and licensing reasons. They are resolved at runtime from `JAVA_BIN` / `APKTOOL_JAR`, then a JRE unpacked under `server/tools/`, then `java` on `PATH`. When none is found, APKs are still scanned and reported and the pipeline degrades to repackaging without smali patching.
3. **JSON-in-SQLite**: Complex nested data (ad SDK findings, AI analyses, patches) is stored as JSON strings in SQLite, balancing simplicity with queryability.
4. **Pipeline-per-format architecture**: Each file format has its own pipeline module (apkPipeline, ipaPipeline, etc.), dispatched via a router function. This keeps format-specific logic isolated.
5. **Surgical patching over wholesale removal**: Rather than deleting ad SDK files entirely (which can crash apps), the tool aims to neutralize ad initialization and display calls while preserving the code structure.
6. **No network details in source**: host, port, CORS origins and tool paths come from the environment, and the front end calls `/api` on its own origin. This keeps deployment-specific values out of version control.
7. **SPA-served backend**: In production, the Express server serves the compiled Angular frontend from `frontend/dist/frontend/browser/`, making it a single-deployment service.

---

## External Tooling

APK smali patching needs a Java runtime and `apktool.jar`, neither of which is
part of this repository. Resolution order, implemented in
`server/src/pipelines/apkPipeline.ts`:

1. `JAVA_BIN` and `APKTOOL_JAR`, if set.
2. `<TOOLS_DIR>/<any-jre>/bin/java` and `<TOOLS_DIR>/apktool.jar`, where
   `TOOLS_DIR` defaults to `server/tools/`.
3. `java` on `PATH`.

If apktool or Java is unavailable, the APK pipeline still extracts, scans and
reports findings, and the rebuild step repackages the original archive without
smali-level patches. The AAB and XAPK pipelines behave the same way and say so
in their patch notes.

Rebuilt Android packages are **unsigned**. A debug keystore is generated under
`KEYSTORE_DIR` (default `server/data/`) when `keytool` is available, but outputs
must be re-signed before they will install.

---

## License

Demonitize is free software, released under the **GNU General Public License,
version 3 or later**. Copyright (C) 2026 Mark Sherman. The full text is in
`LICENSE`; every source file carries an `SPDX-License-Identifier:
GPL-3.0-or-later` notice.
