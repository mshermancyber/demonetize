# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-10-11

First public release.

### Added

- Upload-to-download pipeline for 13 package formats across Android, iOS,
  browser extensions, Windows and Linux: extraction, signature-based ad SDK
  scanning, AI-assisted analysis, surgical patching and rebuild.
- Signature database covering widely deployed ad SDKs, matched on package,
  class, method, manifest and URL patterns.
- Per-format pipelines: APK, IPA, AAB, XAPK/APKS/APKM, CRX/XPI, MSIX/APPX and
  AppImage/Snap/Flatpak.
- AI analysis of each finding — initialization flow, display entry points,
  minimal patch and anti-tamper concerns — with a heuristic fallback when no
  API key is configured.
- Express/TypeScript API with SQLite job storage, and an Angular single-page
  front end: upload, live dashboard, results, download and job history.
- Environment-based configuration for host, port, CORS origins, API key and
  Android tool locations; nothing network-specific is baked into the source.
- Runtime discovery of `apktool` and a JRE, with a documented repackage-only
  fallback when neither is present.
- Released under the GNU General Public License v3.0 or later.
