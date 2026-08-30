<div align="center">

# 🌐 NeXusWeb Browser (V10.0.0)
### **Sovereign Privacy-First Web Infrastructure & Developer Browser**
*Engineered by **Chevron Nexus Software Private Limited** — [www.ChevronNexus.com](https://www.ChevronNexus.com)*

[![Version](https://img.shields.io/badge/version-10.0.0-00d4ff.svg?style=flat-square)](https://github.com/ChevronNexus/NeXusWeb)
[![Electron](https://img.shields.io/badge/Electron-28.3.3-47848F.svg?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.21-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20|%20Linux%20|%20Android-0078D6.svg?style=flat-square)](https://github.com/ChevronNexus/NeXusWeb)
[![License](https://img.shields.io/badge/license-MIT%20%2F%20Proprietary-green.svg?style=flat-square)](LICENSE)

<p align="center">
  <b>NeXusWeb</b> is an ultra-high-performance, sovereign web browser engineered specifically for developers, power users, and privacy purists. Featuring zero corporate telemetry, local-first computing, client-side zero-knowledge synchronization, native Chromium protocol parity, embedded developer workbenches, and hardware-accelerated media infrastructure.
</p>

</div>

---

## 📑 Table of Contents
1. [Core Architectural Philosophy](#-core-architectural-philosophy)
2. [Complete Prototype Evolution Matrix (V1 to V10)](#-complete-prototype-evolution-matrix-v1-to-v10)
3. [Flagship V10.0.0 Feature Highlights](#-flagship-v1000-feature-highlights)
4. [ChevronNexus Sync 1.2.0 Engine](#-chevronnexus-sync-120-engine)
5. [Developer Workbenches & Tooling Suite](#-developer-workbenches--tooling-suite)
6. [Repository Architecture](#-repository-architecture)
7. [Quick Start & Build Instructions](#-quick-start--build-instructions)
8. [Global Keyboard Shortcuts Reference](#-global-keyboard-shortcuts-reference)
9. [Feature Comparison Matrix](#-feature-comparison-matrix)
10. [Privacy, Security & Legal Compliance](#-privacy-security--legal-compliance)

---

## 🏛️ Core Architectural Philosophy

NeXusWeb is founded on the principle of **Digital Sovereignty**:
* **🛡️ Zero Telemetry & Surveillance:** No background analytics, no tracking beacons, no device fingerprinting, and no data broker connections.
* **💾 Local-First Data Residency:** All passwords, browsing histories, bookmarks, and developer notes are stored locally on your device in encrypted format.
* **🔐 Zero-Knowledge Cryptography:** Multi-device synchronization uses client-side AES-256-GCM encryption with PBKDF2 (600,000 rounds) — servers never possess decryption keys.
* **⚡ Native Chromium Parity:** Pure `--disable-blink-features=AutomationControlled` Blink flags and authentic `Sec-CH-UA` Client Hints to pass Cloudflare Turnstile and Google Sign-In with zero false positives.

---

## 📜 Complete Prototype Evolution Matrix (V1 to V10)

Across the repository history, NeXusWeb evolved across **10 major prototype generations** spanning **17 distinct milestone releases**:

| Prototype | Directory | Version | Major Features & Architectural Milestones |
| :--- | :--- | :--- | :--- |
| **Prototype V1** | `prototype V1/` | `v1.0.0` | **The Genesis:** 3-Mode Network Architecture (*Strict Offline*, *Local Network*, *Developer Mode*), embedded PTY Terminal (`@xterm/xterm` + `node-pty`), active localhost port scanner. |
| **Prototype V2** | `prototype V2/` | `v2.0.0` | **Developer Workspace:** ScratchPad markdown notes, Media Panel & HUD, basic side-by-side split view, download progress manager, find bar (`Ctrl+F`). |
| **Prototype V3** | `prototype V3/` | `v3.0.0` | **Network Intelligence:** Command Palette (`Ctrl+K`), live Request Inspector (HTTP logger), `.env` file reader/injector, Reader Mode, persistent Bookmarks bar. |
| **Prototype V4** | `prototype V4/` | `v4.0.0` | **API Workbenches:** REST/GraphQL API Workbench, Chrome Extension Loader (MV2/MV3), Theme Customizer, Resource Monitor, zero-CORS dev mode. |
| **Prototype V5** | `prototype V5/` | `v5.0.0` | **Glassmorphic UI & Sandbox:** Private Den Sandbox (`partition: memory`), QuickTools slide-out drawer, custom glassmorphic context menu, synchronized live viewport resizing. |
| **Stable V6.5** | `Stable V6.5.0/` | `v6.5.0` | **Installer & Split Resizer:** Dynamic proportional split divider (`10%` to `90%`), automated C# WPF setup builder (`SetupInstaller.cs`), delta updater system. |
| **Prototype V7** | `prototype V7/` | `v7.0.0`<br>`v7.1.0`<br>`v7.5.0` | **VPN & Safari Media Engine:** Native Encrypted DNS/VPN Tunnel (`vpnEngine.js`), DNS-over-HTTPS (DoH via Cloudflare/Quad9), multi-region routing (US, NL, SG, UK, DE), Safari-style video player with speed chips & PiP, True HTML5 Fullscreen (0px offset). |
| **Prototype V8** | `prototype V8/`<br>`PrototypeV8.1.0/` | `v8.1.0`<br>`v8.5.0` | **DevStudio & Performance:** AES-256-GCM Password & AutoFill Studio, YouTube Ad Fast-Forwarder (<50ms auto-skip at 16x speed), Browser Task Manager, Media Casting (Chromecast/AirPlay/DLNA), standalone PWA WebApps, Memory Saver tab suspender, Android APK touch UI. |
| **Prototype V9** | `prototype V9/` | `v9.0.1`<br>`v9.1.0`<br>`v9.5.0`<br>`v9.5.1`<br>`v9.6.0` | **Sovereign Sync 1.2.0:** Chromium `/command` Protocol Dispatcher (Dual Protobuf/JSON), 64-bit monotonic sequence counters, real-time WebSocket push broker, BIP39 12-word recovery seed, 2FA TOTP, Google Sign-in hardening, multi-platform packaging (Windows/Linux/Android). |
| **Prototype V10** | `prototype V10/V10.0.0/` | `v10.0.0` | **Flagship Universal Infrastructure:** In-browser Universal File Viewer (PDF, DOCX, XLSX, HEIC, ZIP), Cloudflare Turnstile & Chrome Parity Engine, ChevronNexus Home (Pro) Server, Download Target Controller, complete legal compliance suite. |

---

## 🚀 Flagship V10.0.0 Feature Highlights

### 📁 Universal File Viewer (Zero Cloud Uploads)
View local and downloaded files directly in NeXusWeb without external apps or third-party web servers:
* **Documents:** Word (`.docx` via `mammoth`), Excel spreadsheets (`.xlsx`), Markdown (`.md`), Plaintext (`.txt`, `.json`, `.csv`, `.log`, `.env`).
* **PDFs:** High-resolution in-browser PDF reader with zoom and search.
* **Modern Photos:** High-Efficiency Image Container (`.heic` via `heic2any`), WebP, SVG, PNG, JPEG, GIF.
* **Compressed Archives:** Inspect and extract `.zip` contents directly inside the browser using `adm-zip`.
* **Media:** Native playback for MP4, WebM, MP3, WAV, OGG, FLAC.

### 🛡️ Cloudflare Turnstile & Chrome Parity Engine
* **Clean Prototype Chain:** Utilizes Blink's native `--disable-blink-features=AutomationControlled` switch to keep `Navigator.prototype` 100% authentic.
* **Authentic Client Hints:** Delivers authentic `Sec-CH-UA` and `Sec-CH-UA-Platform` matching vanilla Chrome.
* **Referer Preservation:** Preserves cross-origin referer tokens on `challenges.cloudflare.com` and `recaptcha.net` frames, ensuring Turnstile verification passes seamlessly.

### 🏠 ChevronNexus Home (Pro) Local Network Server
* Transforms your machine into a private home server operating strictly within your local WiFi/LAN network.
* **LAN Media Streaming & Transcoding:** Stream videos and audio to connected household devices with zero cloud routing.
* **WiFi Monitor & Discovery:** Automatic UDP port `45454` broadcast discovery for instant device pairing.

### 🛑 Built-in Ad-Shield & YouTube Fast-Forwarder
* **Network Filter:** Blocks 250+ known tracking, telemetry, cryptomining, and ad domains locally.
* **YouTube Video Ad Fast-Forwarder:** Accelerates video ads to 16x speed + mute, skipping ads in `< 50ms` without black screen freezes.
* **Anti-Adblock Defuser:** Automatically detects and removes "Ad blockers violate YouTube Terms of Service" popups.

### 🔐 Passwords & AutoFill Studio
* Encrypted local credentials vault utilizing **AES-256-GCM** with **PBKDF2** key derivation (600,000 rounds).
* In-page autofill injector, strong password generator with entropy scoring, security auditor, and Chrome/Bitwarden CSV/JSON import/export.

### 📺 Multi-Device Media Casting
* Discovers and casts active tabs, HTML5 media, or entire desktops to **Google Chromecast**, **Apple AirPlay**, and **DLNA Smart TVs** over the local subnet.

### ⚡ Memory Saver & Browser Task Manager
* **Inactive Tab Suspender:** Discards memory from background tabs after a configurable timeout, reducing RAM usage by up to 80%.
* **Process Task Manager (`Shift+Esc`):** Real-time monitoring of Main, GPU, Tab, Extension, and Daemon processes with 1-click process termination.

---

## 🔄 ChevronNexus Sync 1.2.0 Engine

NeXusWeb features a sovereign, self-hostable, zero-knowledge sync engine:
* **Zero-Knowledge Architecture:** Payloads are encrypted on the client device before transmission; the sync server only stores opaque ciphertext blobs.
* **Chromium `/command` Protocol Dispatcher:** Supports binary Protocol Buffers (`application/x-protobuf`) and JSON envelopes (`application/json`).
* **64-bit Monotonic Sequence Counters:** Strictly incrementing sequence counters eliminate clock drift and timestamp skew across devices.
* **Sub-50ms WebSocket Push Broker:** Instant push notifications trigger immediate multi-device tab forwarding and delta syncing.
* **Cold Storage Emergency Recovery:** 12-word BIP39 mnemonic seed phrase backup + RFC 6238 TOTP two-factor authentication.

---

## 🛠️ Developer Workbenches & Tooling Suite

NeXusWeb integrates dedicated tooling directly into the browser shell:
* **⚡ REST & GraphQL API Workbench:** Test endpoints, customize headers, pass auth tokens, and format JSON payloads.
* **🔌 Port Manager & Localhost Scanner:** Auto-detects local development servers (Vite, Next.js, Django, Express) with 1-click PID termination.
* **🔍 Request Inspector:** Live network traffic logger capturing request status, duration, and response headers.
* **📝 ScratchPad:** Multi-tab markdown workspace with live preview, split view, code syntax highlighting, and JSON beautifier.
* **💻 Embedded Terminal:** Multi-tab PTY terminal session powered by `@xterm/xterm` with persistent shell state.
* **🧩 Chrome Web Extensions:** Direct installation of extensions from the Chrome Web Store or local unpacked directories.

---

## 📂 Repository Architecture

```text
F:\NeXusWeb\
├── prototype V10\                  # 🚀 Active Flagship Codebase (v10.0.0)
│   ├── V10.0.0/                    # Full Source Code (Electron 28 + React 18 + Vite 5)
│   │   ├── electron/               # Main process, tab preload, network filter, storage
│   │   ├── src/                    # 50 React UI components, design tokens, hooks
│   │   ├── scripts/                # Setup & cross-platform build pipelines
│   │   └── package.json            # Dependencies & build scripts
│   ├── ChevronNexus Sync System/   # Standalone Zero-Knowledge E2EE Sync Server v1.2.0
│   ├── Privacy Policy.txt          # Comprehensive Privacy Policy (DPDP Act & GDPR compliant)
│   └── Terms&Conditions.txt        # Legal Terms & Conditions of Use
├── prototype V9\                    # Prototype V9 Series (v9.0.1, v9.1.0, v9.5.0, v9.5.1, v9.6.0)
├── prototype V8\                    # Prototype V8 Series (v8.1.0, v8.5.0)
├── prototype V7\                    # Prototype V7 Series (v7.0.0, v7.1.0, v7.5.0)
├── Stable V6.5.0\                  # Stable V6.5.0 Production Release
├── prototype V5\                    # Prototype V5 (Glass UI & Private Den)
├── prototype V4\                    # Prototype V4 (API Workbench & Extensions)
├── prototype V3\                    # Prototype V3 (Command Palette & Request Inspector)
├── prototype V2\                    # Prototype V2 (ScratchPad & Developer Workspace)
├── prototype V1\                    # Prototype V1 (Initial 3-Mode Genesis)
├── ChevronNexus Sync 1.2.0\        # Standalone Sync Server Distribution
└── README.md                       # Master Documentation
```

---

## 🚀 Quick Start & Build Instructions

### Prerequisites
* [Node.js](https://nodejs.org/) v18.0+ or v20.0+
* [Git](https://git-scm.com/)
* Windows 10/11 (with .NET Framework 4.5+ for C# installer builds) or Linux x64

### 1. Installation & Local Development
```bash
# Navigate to active V10.0.0 codebase
cd "prototype V10/V10.0.0"

# Install dependencies
npm install

# Run in live developer mode (Vite HMR + Electron)
npm run dev
```

### 2. Build Production Desktop Application
```bash
# Build Vite frontend bundle
npm run build:vite

# Package standalone Windows x64 application
npm run package
```

### 3. Build Self-Extracting Windows Setup (`.exe`)
```bash
npm run build:setup
```
*Outputs: `dist-electron/NeXusWeb-Setup-v10.0.0.exe` (Self-extracting C# installer with LZMA compression and desktop shortcuts).*

### 4. Build Linux Standalone Package
```bash
npm run build:linux
```
*Outputs: `dist-linux/NeXusWeb-v10.0.0-linux-x64.zip` (Portable Linux distribution with `.desktop` launcher and `install.sh`).*

---

## ⌨️ Global Keyboard Shortcuts Reference

| Shortcut | Action Description |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | Open New Tab |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close Active Tab |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | Reopen Last Closed Tab |
| <kbd>Ctrl</kbd> + <kbd>Tab</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd> | Switch to Next / Previous Tab |
| <kbd>Ctrl</kbd> + <kbd>1..9</kbd> | Jump Directly to Tab (1 to 9) |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> / <kbd>Alt</kbd> + <kbd>D</kbd> | Focus Omnibox / Address Bar |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Command Palette & Quick Switcher |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> | Open **Private Den** Sovereign Sandbox |
| <kbd>Ctrl</kbd> + <kbd>\\</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Toggle Side-by-Side Split View |
| <kbd>Ctrl</kbd> + <kbd>\`</kbd> | Toggle Integrated Developer Terminal |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Open Password & AutoFill Studio |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | Open Extensions Management Center |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> | Open Performance & Memory Saver |
| <kbd>Shift</kbd> + <kbd>Esc</kbd> | Open Browser Task Manager |
| <kbd>Ctrl</kbd> + <kbd>J</kbd> | Open Downloads Manager |
| <kbd>Ctrl</kbd> + <kbd>H</kbd> | Open History Panel |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> | Toggle Bookmarks Bar |
| <kbd>F11</kbd> | Toggle True HTML5 Fullscreen |
| <kbd>F12</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd> | Open Chromium Developer Tools |

---

## 📊 Feature Comparison Matrix

| Feature Capability | ChevronNexus NeXusWeb (V10) | Google Chrome | Brave Browser | Microsoft Edge |
| :--- | :---: | :---: | :---: | :---: |
| **Default Zero-Telemetry** | ✅ **100% Sovereign** | ❌ Involuntary Analytics | ⚠️ Basic Shield | ❌ Telemetry Ingestion |
| **Zero-Knowledge E2EE Sync** | ✅ **PBKDF2 + AES-GCM** | ❌ Cloud Keys | ⚠️ Chain-based | ❌ Cloud Keys |
| **Chromium `/command` Protocol** | ✅ **Dual Protobuf/JSON** | ✅ Native | ❌ Custom | ❌ Custom |
| **In-Browser File Viewer (PDF/DOCX/HEIC/ZIP)** | ✅ **Native Local Engine** | ⚠️ PDF Only | ⚠️ PDF Only | ⚠️ PDF/Office Web |
| **YouTube Ad Fast-Forwarder (<50ms)** | ✅ **16x Speed Auto-Skip** | ❌ None | ⚠️ Basic Blocker | ❌ None |
| **Anti-Adblock Popup Defuser** | ✅ **Auto-Bypass** | ❌ None | ❌ None | ❌ None |
| **Local Intranet Home Pro Server** | ✅ **Built-in LAN Hub** | ❌ None | ❌ None | ❌ None |
| **Integrated Developer Terminal** | ✅ **Multi-tab PTY Terminal** | ❌ None | ❌ None | ❌ None |
| **REST & GraphQL API Workbench** | ✅ **Built-in Client** | ❌ None | ❌ None | ❌ None |
| **Localhost Port Scanner & Killer** | ✅ **Background Daemon** | ❌ None | ❌ None | ❌ None |
| **Proportional Split View (10%-90%)** | ✅ **Custom Splitter** | ❌ None | ⚠️ Side-Panel | ⚠️ Split Tab (50/50) |
| **Media Casting (Cast/AirPlay/DLNA)** | ✅ **All 3 Protocols** | ⚠️ Cast Only | ⚠️ Cast Only | ⚠️ DLNA Only |
| **Process Task Manager** | ✅ **Real-Time Gauges** | ✅ Basic List | ✅ Basic List | ✅ Basic List |
| **Multi-Threaded Downloader** | ✅ **16 Range Streams** | ❌ Single Stream | ❌ Single Stream | ❌ Single Stream |

---

## ⚖️ Privacy, Security & Legal Compliance

NeXusWeb is engineered and distributed in full accordance with statutory privacy frameworks:
* **Indian Digital Personal Data Protection Act, 2023 (DPDP Act):** Strict compliance with Data Fiduciary duties, zero unsolicited processing, and absolute user data sovereignty.
* **Information Technology Act, 2000 (Section 79 Safe Harbor):** Neutral client-side intermediary platform protections.
* **EU GDPR & California CCPA/CPRA:** Full privacy-by-design architecture, zero unauthorized international transfers, and local data residency.
* **Legal Documentation:**
  * View our complete [Privacy Policy](file:///F:/NeXusWeb/prototype%20V10/Privacy%20Policy.txt).
  * View our complete [Terms & Conditions](file:///F:/NeXusWeb/prototype%20V10/Terms&Conditions.txt).

---

<div align="center">

**Chevron Nexus Software Private Limited**  
*Mumbai, Maharashtra, India*  
[www.ChevronNexus.com](https://www.ChevronNexus.com) • [privacy@chevronnexus.com](mailto:privacy@chevronnexus.com) • [legal@chevronnexus.com](mailto:legal@chevronnexus.com)

© 2026 Chevron Nexus Software Private Limited. All Rights Reserved.

</div>
