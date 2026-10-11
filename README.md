# Demonetize

**Demonetize** detects and surgically removes advertising SDKs from application
packages. You hand it an app file — an Android APK, an iOS IPA, a browser
extension, a Windows Store package, a Linux bundle — and it runs the package
through extraction, signature-based ad SDK scanning, AI-assisted analysis,
targeted patching and a rebuild, then hands back an ad-free build.

The name is a play on "demonetize": the goal is to strip the monetization
(advertising) code while leaving the app's own functionality intact. The
repository is `demonetize`; the program keeps the punned spelling.

- **Version:** 0.1.0 — first public release
- **License:** [GNU General Public License v3.0 or later](LICENSE)
- **Architecture and internals:** [DOCS.md](DOCS.md)

---

## Features

- **13 package formats** across Android, iOS, browser extensions, Windows and
  Linux: `.apk`, `.ipa`, `.aab`, `.xapk`, `.apks`, `.apkm`, `.crx`, `.xpi`,
  `.msix`, `.appx`, `.appimage`, `.snap`, `.flatpak`.
- **Signature-based detection** of widely deployed ad SDKs — AdMob, Facebook
  Audience Network, Unity Ads, AppLovin, IronSource, Vungle, AdColony,
  Chartboost, InMobi, Mintegral, Tapjoy, Fyber and more — by package, class,
  method, manifest and URL patterns.
- **AI-assisted analysis** of each finding: how the SDK initializes, where it
  displays ads, a minimal surgical patch, and anti-tamper concerns. Falls back
  to a heuristic analyzer when no API key is configured.
- **Surgical patching** that neutralizes ad initialization and display calls
  rather than deleting SDK code wholesale, which tends to crash apps.
- **Live pipeline UI**: upload, a real-time progress dashboard, detailed
  results, download, and job history.

## Requirements

- Node.js 18 or newer
- For APK smali patching: a Java runtime and `apktool.jar` (see
  [Android tooling](#android-tooling)). Without them, APKs are still scanned
  and reported; they are repackaged without smali-level patching.
- Optional: a key for an OpenAI-compatible API, for the AI analysis stage.

## Quick start

```bash
git clone https://github.com/mshermancyber/demonetize.git
cd demonetize

npm run install:all          # install server + front-end dependencies
cp .env.example .env         # then edit .env

npm run build                # compile the server and build the front end
npm run start:server         # serves the API and the built front end
```

Open the address the server prints on startup.

### Development

```bash
npm run dev:server           # API server via ts-node
npm run start:frontend       # Angular dev server, proxying /api to the API server
```

The dev server proxies `/api` using `frontend/proxy.conf.js`, which reads its
target from `API_PROXY_TARGET` (or `API_PROXY_HOST` / `API_PROXY_PORT`). The
front end never hard-codes a host or a port: it calls `/api` on its own origin.

## Configuration

All configuration is environment-based; see [`.env.example`](.env.example) for
the full list with comments.

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | Address the API server binds to |
| `PORT` | `3000` | Port the API server binds to |
| `CORS_ORIGINS` | *(empty)* | Comma-separated allowed browser origins; empty means same-origin only |
| `OPENAI_API_KEY` | *(empty)* | Key for the AI analysis stage; empty uses the heuristic fallback |
| `APKTOOL_JAR` | `server/tools/apktool.jar` | Path to `apktool.jar` |
| `JAVA_BIN` | auto-detected | Path to a `java` executable |
| `TOOLS_DIR` | `server/tools/` | Where to look for a bundled JRE and apktool |
| `KEYSTORE_DIR` | `server/data/` | Where the generated debug keystore is written |

### Android tooling

`apktool` and a JRE are **not** distributed with this repository. To enable
smali-level patching for APKs, either install a JRE and put `apktool.jar`
anywhere you like and point `JAVA_BIN` / `APKTOOL_JAR` at them, or drop both
into `server/tools/`:

```
server/tools/
├── apktool.jar
└── <any-jre>/bin/java
```

The server discovers a JRE under `server/tools/` automatically, and otherwise
falls back to `java` on `PATH`.

## Intended use

Use this on packages you own or are otherwise authorized to modify — your own
builds, your own devices, security research and interoperability work. Rebuilt
Android packages are unsigned and must be re-signed before they will install.
Modifying and redistributing software you do not have the rights to is your
responsibility, not the tool's.

## Contributing

Issues and pull requests are welcome at
<https://github.com/mshermancyber/demonetize>. New source files should carry the
GPL notice used by the existing ones (`SPDX-License-Identifier:
GPL-3.0-or-later`).

## License

Copyright (C) 2026 Mark Sherman

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See [LICENSE](LICENSE) for the full text.
