================================================================================
   CHEVRON NEXUS SOFTWARE — NEXUSWEB V7.1.0 PRODUCTION RELEASE
   COMPLETE UPDATE & UPGRADE SPECIFICATION (INFO.TXT)
================================================================================
Release Version : NeXusWeb v7.1.0 (Core Engine v7.1.1)
Platform Support: Windows 10/11 (x64) & Linux (x64)
Architecture    : Local-First Decentralized Web Infrastructure & Developer Browser
Publisher       : Chevron Nexus Software (Authenticode Signed & RFC 3161 Timestamped)
Website         : https://www.ChevronNexus.com
Design Standard : Pure Vector Icon System (Lucide React) — Zero Emojis as UI Icons
================================================================================

--------------------------------------------------------------------------------
1. UPGRADE UI & DESIGN — APPLICATION DESIGN UPGRADED
--------------------------------------------------------------------------------
• Pure Vector Iconography Standard:
  - 100% elimination of emoji characters as UI icons across the entire browser.
  - Replaced with precision SVG Lucide React vector icons with subtle theme color accents.
• Redesigned Frosted Glass 3-Dot Menu:
  - Deep glassmorphic blur shaders (backdrop-filter: blur(28px) saturate(190%)).
  - Top Header with NeXusWeb branding and live Mode Indicator Pill (Normal, LAN, Strict, Dev, Private Den).
  - 3-Tile Quick Action Grid: [+ New Tab] (Ctrl+T), [New Window] (Ctrl+N), [Private Den] (Ctrl+Shift+P).
  - Card-Grouped Organization: Browsing & Tools, Page Operations & Zoom, Settings & Developer Tools.
  - Ergonomic Zoom Control Capsule: [-] [100%] [+] [Fullscreen].
  - Interactive Submenu Accordions: Smooth inline accordion expansion with rotating chevrons for Developer Tools, Help & About, Bookmarks, and History.
  - Bounded Flexbox Scrolling: Engineered with 'flex: 1 1 auto; min-height: 0; overflow-y: auto;' and custom thin scrollbar for smooth scrolling on any screen resolution.
  - High-Visibility Crimson Exit Card: One-click exit with 'Ctrl+Shift+Q'.
• Dynamic Viewport & Side Drawer Scaling:
  - Dual Split View: Run two webpages side-by-side with draggable center splitter (10% to 90%), percentage badge, and double-click 50/50 reset.
  - Dynamic Drawers: Drag drawer left border (115px to 880px) while the live web viewport automatically resizes simultaneously with zero gap.
• Unified Version Synchronization:
  - Corrected window title in 'index.html' to 'NeXusWeb v7.1.0'.
  - Updated Top TitleBar badge to 'v7.1.0' with pure vector Lucide icon.
  - Updated Bottom StatusBar badge to 'NeXusWeb v7.1.0'.
• Interactive Mode Information (i) Button:
  - Made the (i) badge on the Network Mode pill interactive, launching the Help Center guide directly on click.

--------------------------------------------------------------------------------
2. REDESIGNED SETTINGS PAGE (SETTINGS PANEL) ACCORDING TO UI
--------------------------------------------------------------------------------
• Modern Frosted Glass Layout:
  - Responsive two-column configuration with sidebar navigation and card container.
  - Full theme adaptability using dynamic design tokens (var(--bg-base), var(--glass-bg-card), var(--glass-border), var(--text-primary), var(--text-secondary)).
• Searchable Settings Omnibox:
  - Real-time search filter bar to instantly locate any setting or configuration flag.
• Categorized Sections:
  - Privacy and Security
  - Performance & Tab Suspender
  - Appearance & Themes (8 Frosted Glass presets)
  - Search Engine Manager
  - NeXusApp & Localhost Engine
  - On Startup Configuration
  - Downloads & Acceleration (Speed Limiter, Dynamic Multi-Part, Folder Picker)
  - Accessibility (Expanded)
  - System (Expanded)
  - Reset Settings & Data Purge

--------------------------------------------------------------------------------
3. REDESIGNED ABOUT PAGE (ABOUT PANEL) ACCORDING TO UI
--------------------------------------------------------------------------------
• High-Definition Glass Showcase:
  - Dual Emblem Brand Identity: Chevron Nexus Emblem + NeXusWeb Emblem.
  - Dynamic Version & Status Badges: 'v7.1.0 Stable' and verified production channels.
  - Direct Links to official infrastructure portal: https://www.ChevronNexus.com.
• Core Philosophy Cards:
  - Local-First Architecture: Runs on local hardware and subnets, fully operational offline.
  - True Privacy: End-to-end device security with zero telemetry or data harvesting.
  - One-Time Buy Ownership: No subscriptions; perpetual major version license.
• Complete Key Feature Highlights Matrix:
  - Multi-Engine Network Modes (Normal, LAN, Strict, Dev).
  - Private Den Ephemeral Sandbox (RAM isolation, 100% auto-wipe).
  - Native High-Speed Privacy Tunnel & VPN Engine (Encrypted DoH, header stripping).
  - Synchronized Dynamic Viewport Resizing (Split view and dynamic drawers).
  - Developer Tools Suite (REST client, port scanner, terminal, inspector, notes).
• In-Place Setup & Delta Upgrader Center:
  - 1-Click launcher for standalone upgrade setup with data preservation.

--------------------------------------------------------------------------------
4. DEDICATED HELP PAGE (HELP PANEL & SHORTCUTS HUB) ACCORDING TO UI
--------------------------------------------------------------------------------
• Interactive Searchable Help Hub:
  - Live search bar to quickly query documentation, feature guides, and troubleshooting steps.
• Comprehensive Topic Modules:
  - Getting Started & Split View Guide: Multitasking, dual pane navigation, and tab management.
  - Multi-Engine Network Modes Guide: When and how to switch between Normal, LAN, Strict, and Dev modes.
  - Native VPN & Tunneling Guide: Regional node routing, DNS-over-HTTPS, and real-time latency ping testing.
  - Developer Tools & Workbenches Guide: Using the REST API workbench, port manager daemon, and PTY terminal.
  - Private Den Sandbox Guide: RAM-only isolated browsing and ephemeral data lifecycle.
  - Complete Keyboard Shortcuts Matrix: Fast visual reference for all hotkeys (Ctrl+T, Ctrl+N, Ctrl+Shift+P, F12, F9, Ctrl+\, F1).
  - FAQ & Troubleshooting: Network diagnostics, proxy troubleshooting, cache clearing, and dev tools access.

--------------------------------------------------------------------------------
5. UPGRADE SETTINGS — ADD FEATURES
--------------------------------------------------------------------------------
• Privacy & Security Upgrades:
  - DNS-over-HTTPS (DoH) Provider Selector: Cloudflare (1.1.1.1), Quad9 (9.9.9.9), Google (8.8.8.8), AdGuard Privacy, and Custom URL templates.
  - WebRTC Leak Shield: Strict non-proxied UDP blocking toggle to prevent real IP leaks.
  - Canvas & Audio Fingerprint Randomizer: Injects non-deterministic noise to defeat tracker fingerprinting.
  - Ad & Tracker Blocker Engine: Strict AdBlock, Balanced, or Developer Pass-through.
  - Cookie Policy Manager: Block third-party cookies, allow session-only, or block all.
  - HTTPS Auto-Upgrade: Automatically rewrite insecure HTTP requests to HTTPS.
  - Granular Browsing Data Cleaner: Checkboxes for history, cache, cookies, downloads, and storage.
• Search Engine Manager:
  - Pre-configured privacy engines: DuckDuckGo (Default), Brave Search, Google, Bing, Startpage, Ecosia.
  - Custom Search Engine configuration with URL query parameter templates.
  - Omnibox Search Suggestions toggle.
• Appearance & Themes:
  - 8 Frosted Glass Theme Presets: Cyber Dark, Obsidian Dark, Obsidian Light, Emerald Matrix, Solar Amber, Synth Violet, Sakura Neon, Clean Light.
  - Glass Blur Intensity Selector: Low, Medium, High / Ultra blur.
  - Bookmarks Bar Display Mode: Always Show, New Tab Only, Never Show.
• Startup & Tabs Configuration:
  - Startup Action: Open New Tab Page, Restore Previous Session Tabs, Open Specific URL.
  - Tab hover preview thumbnails toggle.

--------------------------------------------------------------------------------
6. ADD FEATURES IN ACCESSIBILITY (SETTINGS ACCESSIBILITY)
--------------------------------------------------------------------------------
• High-Contrast OLED Mode:
  - Pure black backgrounds (#000000) with maximum contrast neon borders and high-visibility text.
• Text Scaling & UI Zoom Slider:
  - Dynamic scale slider ranging from 80% to 150% with live viewport application.
• Dyslexic-Friendly Typography:
  - Toggle to apply enhanced legibility fonts across UI and readability layers.
• Reduce Motion & Glass Blur:
  - Toggle to disable backdrop-filter blur shaders and slide-in animations for motion sensitivity or performance.
• High-Visibility Neon Focus Rings:
  - Prominent 2px neon cyan outline on all keyboard-focused interactive elements and inputs.
• Color Vision / Daltonism Simulation Filters:
  - Normal (Standard full color).
  - Protanopia (Red-blind / Red-weak simulation filter).
  - Deuteranopia (Green-blind / Green-weak simulation filter).
  - Tritanopia (Blue-blind / Blue-yellow simulation filter).
  - Monochrome (Pure Grayscale filter).
• Screen Reader Optimization:
  - Semantic ARIA landmarks, roles, and logical tab stop sequence.

--------------------------------------------------------------------------------
7. NEW DOWNLOAD MANAGER (DM) — DYNAMIC MULTI-PART SEGMENTATION ENGINE
--------------------------------------------------------------------------------
• Dynamic Multi-Part Segmentation:
  - Instead of pre-splitting a file into static segments before downloading, DM dynamically splits a file during the download process.
  - If one connection finishes early or is faster than another, DM automatically splits the largest remaining unfinished segment in half and assigns it to the idle connection (Dynamic Work Stealing).
• Connection Reuse (HTTP Keep-Alive):
  - DM keeps TCP connections open rather than closing and re-authenticating for every segment, avoiding repeated handshakes and latency overhead.
  - Uses persistent connection pooling (http.Agent & https.Agent with max sockets and 30-second keep-alive).
• Resuming & Rebuilding (.nexusdownload Manifest):
  - DM continuously writes progress state to disk. When paused or interrupted, it sends HTTP range requests (Range: bytes=start-end) to request only the missing chunks, stitching them into the complete file upon completion.
• Speed Limiter (Bandwidth Throttle) in Settings:
  - Option in Settings -> Downloads: Throttle bandwidth usage so active downloads do not interrupt streaming, browsing, or gaming.
  - Presets: Unlimited (Max Speed), 500 KB/s (Ultra Low), 1 MB/s (Low), 2 MB/s (Balanced), 5 MB/s (High Speed), 10 MB/s (Turbo Cap).
• Custom Download Path Picker:
  - Built-in native folder selection dialog (dialog.showOpenDialog) to configure default download folders.
• Max Concurrent Connections per File:
  - Select between 4, 8 (Turbo — Recommended), or 16 parallel connections.
• Redesigned Frosted Glass UI:
  - Unified Glass Metric Strip: Translucent card showing live Active Tasks, Completed Files, and Total Volume.
  - Floating Omnibox Search: Real-time filtering by filename, extension, or source domain.
  - Segmented Control Tabs: All, Active, Completed, Cancelled with dynamic high-contrast theme styling.
  - Multi-Part Segment Visualization Mini-Map: Live progress blocks inside active cards showing parallel chunk workers.
  - Interactive Action Controls: Open File, Show in Folder, Pause, Resume, Cancel, Copy URL, Remove, and Clear Completed.
  - "+ Add URL" Modal: Direct link downloader with configurable connections (4, 8, 16) and custom filenames.

--------------------------------------------------------------------------------
8. ADD FEATURES IN SETTINGS SYSTEM
--------------------------------------------------------------------------------
• Hardware Acceleration (GPU):
  - Toggle GPU rasterization and WebGL hardware acceleration with restart confirmation.
• Memory Saver & Inactive Tab Suspender:
  - Configurable discard timeout: 15 minutes, 30 minutes, 1 hour, 2 hours, or Never.
  - Whitelist domains to prevent tab suspension on critical dev apps and dashboards.
• Background Server Watcher:
  - Keep background localhost daemons and server watchers active on window minimize/close.
• Port Scanner Daemon Configuration:
  - Auto-scan interval: Every 5s, 10s, 30s, or Manual scan only.
  - Scan port ranges: Standard Web (3000-8080) vs Comprehensive Full Dev (1000-65535).
  - Toast notification toggle when new local developer servers are detected.
• Sandbox Storage & Cache Breakdown:
  - Live telemetry display of Local Storage, IndexedDB, and Cache disk usage.
  - 1-Click Purge Cache & Storage button.
• User Preferences Backup & Restore:
  - Export user configuration, search engines, and settings to JSON.
  - Import user configuration from JSON file.
• Factory Reset Settings:
  - Restore all settings to pristine factory defaults with double-confirmation dialog.

--------------------------------------------------------------------------------
9. CODE SIGNING, PACKAGING & DISTRIBUTION
--------------------------------------------------------------------------------
• Windows Authenticode SHA-256 Code Signing with RFC 3161 Timestamping (DigiCert).
• Mark-of-the-Web (Zone.Identifier) Removal script integration.
• Standalone Windows Installer: NeXusWeb-Setup-v7.1.0.exe (129.68 MB).
• Standalone Linux x64 Distribution: NeXusWeb-v7.1.0-linux-x64.zip (121.25 MB).
• 1-Click Launchers: 'Launch NeXusWeb V7.1.0 (EXE).bat' and 'Launch NeXusWeb V7.1.0 (Dev).bat'.
================================================================================
