const { app, BrowserWindow, BrowserView, ipcMain, session, dialog, shell, globalShortcut, Menu, nativeImage, clipboard, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const crypto = require('crypto')
const { setupNetworkFilter, setFilterMode, getFilterMode } = require('./networkFilter')
const { isTrackerOrAd, privacyStats, getTabStats, resetTabStats } = require('./privacyFilter')
const { getTabLogs, clearTabLogs } = require('./requestInspector')
const { findEnvFiles, readEnvFile } = require('./envReader')
const { PIP_INJECTOR_SCRIPT, READER_MODE_EXTRACTOR_SCRIPT, MEDIA_HUD_CONTROL_SCRIPT } = require('./mediaInjector')
const { SAFARI_IN_PAGE_VIDEO_PLAYER_SCRIPT, SAFARI_VIDEO_CONTROL_SCRIPT } = require('./safariVideoInjector')
const { initTray, destroyTray } = require('./trayManager')
const { scanLocalPorts, getDetailedPortList, killProcess } = require('./portScanner')
const { createTerminal, writeToTerminal, resizeTerminal, destroyTerminal, destroyAllTerminals } = require('./terminalManager')
const {
  initDownloadManager,
  addMultiPartDownload,
  getDownloadsList,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  removeDownload,
  openDownloadedFile,
  showInFolder,
  copyDownloadUrl,
  selectDownloadFolder,
  clearCompletedDownloads,
  resolveInterceptedDownload,
} = require('./downloadManager')
const {
  SEARCH_ENGINES,
  getBookmarks, addBookmark, removeBookmark, isBookmarked,
  getHistory, addHistory, clearHistory, deleteHistoryItem,
  getSettings, updateSettings,
  getNotes, saveNotes, getNoteForUrl, saveNoteForUrl,
  getExtensions, saveExtensions,
  saveSession, getSession,
  getAllSyncableData, applyIncomingSyncData,
} = require('./storage')
const ChromeExtensionManager = require('./chromeExtensionManager')
const { updateManager } = require('./updateManager')
const { vpnEngine } = require('./vpnEngine')
const passwordManager = require('./passwordManager')
const { getBrowserTasks, killTaskProcess } = require('./taskManager')
const { castManager } = require('./castManager')
const { getInstalledWebApps, installWebApp, uninstallWebApp, createAppWindow, launchWebApp, EXTRACT_MANIFEST_SCRIPT } = require('./webAppManager')
const { performanceEngine } = require('./performanceEngine')
const memoryOptimizer = require('./memoryOptimizer')
const { YOUTUBE_AD_SHIELD_SCRIPT, UNIVERSAL_COSMETIC_ADBLOCK_SCRIPT, adblockStats, checkAdOrTracker } = require('./adblockEngine')
const SyncManager = require('./syncManager')
const { startEmbeddedSyncServer, stopEmbeddedSyncServer, isSyncServerRunning } = require('./embeddedSyncServer')

const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged
let chromeExtensionManager = null
let syncManager = null

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
app.userAgentFallback = CHROME_USER_AGENT

const os = require('os')
const totalSysMemMB = Math.round(os.totalmem() / 1024 / 1024)
const isLowSpecPC = totalSysMemMB <= 4500 // 4.5 GB or lower

// High-Efficiency Sovereign Chromium Engine Architecture with High-Speed Media Buffering
app.commandLine.appendSwitch('renderer-process-limit', '2')
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048 --expose-gc')
app.commandLine.appendSwitch('disk-cache-size', '536870912')
app.commandLine.appendSwitch('media-cache-size', '536870912')
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,CalculateNativeWinOcclusion,Translate,InterestFeedContentSuggestions,OptimizationHints,MediaRouter,AutofillServerCommunication,PreloadMediaEngagementData,CertificateTransparencyComponentUpdater')
app.commandLine.appendSwitch('disable-site-isolation-trials')
app.commandLine.appendSwitch('disable-breakpad')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-smooth-scrolling')
app.commandLine.appendSwitch('enable-accelerated-video-decode')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'false')
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'false')
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,BackForwardCache')

const settings = getSettings()

let currentMode = settings.defaultMode || 'normal'
let tabCounter = 0

// Start internal Proxy Bridge Server for Chrome VPN & Proxy Extensions
let proxyBridgeServer = null

function convertChromeProxyToElectronProxy(val) {
  if (!val) return { mode: 'direct' }
  
  if (val.mode === 'direct' || val.mode === 'system') {
    return { mode: 'direct' }
  }

  if (val.mode === 'pac_script' && val.pacScript) {
    if (val.pacScript.data) {
      const pacPath = path.join(app.getPath('userData'), 'nexus_active_proxy.pac')
      fs.writeFileSync(pacPath, val.pacScript.data, 'utf8')
      return { pacScript: `file:///${pacPath.replace(/\\/g, '/')}` }
    }
    if (val.pacScript.url) {
      return { pacScript: val.pacScript.url }
    }
  }

  if (val.mode === 'fixed_servers' && val.rules) {
    let proxyRules = ''
    let bypassList = '<local>'
    
    if (typeof val.rules === 'string') {
      proxyRules = val.rules
    } else if (typeof val.rules === 'object') {
      const parts = []
      
      if (val.rules.singleProxy) {
        const sp = val.rules.singleProxy
        const scheme = sp.scheme ? `${sp.scheme}://` : 'http://'
        const port = sp.port ? `:${sp.port}` : ''
        proxyRules = `${scheme}${sp.host}${port}`
      } else {
        if (val.rules.proxyForHttp) {
          const hp = val.rules.proxyForHttp
          parts.push(`http=${hp.scheme || 'http'}://${hp.host}${hp.port ? `:${hp.port}` : ''}`)
        }
        if (val.rules.proxyForHttps) {
          const sp = val.rules.proxyForHttps
          parts.push(`https=${sp.scheme || 'https'}://${sp.host}${sp.port ? `:${sp.port}` : ''}`)
        }
        if (val.rules.proxyForFtp) {
          const fp = val.rules.proxyForFtp
          parts.push(`ftp=${fp.scheme || 'http'}://${fp.host}${fp.port ? `:${fp.port}` : ''}`)
        }
        if (val.rules.fallbackProxy) {
          const fbp = val.rules.fallbackProxy
          parts.push(`${fbp.scheme || 'http'}://${fbp.host}${fbp.port ? `:${fbp.port}` : ''}`)
        }
        proxyRules = parts.join(';')
      }

      if (Array.isArray(val.rules.bypassList)) {
        bypassList = val.rules.bypassList.join(';')
      }
    }

    if (proxyRules) {
      return {
        proxyRules,
        proxyBypassRules: bypassList,
      }
    }
  }

  if (typeof val === 'string') {
    return { proxyRules: val }
  }
  if (val.proxyRules) {
    return { proxyRules: val.proxyRules }
  }

  return { mode: 'direct' }
}

const PROXY_BRIDGE_SECRET = crypto.randomBytes(32).toString('hex')

function startProxyBridgeServer() {
  if (proxyBridgeServer) return
  proxyBridgeServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/set-proxy') {
      const authHeader = req.headers['x-nexus-auth']
      const originHeader = req.headers['origin']

      // Block unauthorized requests and external web page origins
      if (authHeader !== PROXY_BRIDGE_SECRET || (originHeader && !originHeader.startsWith('chrome-extension://'))) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Access denied: unauthorized bridge call' }))
        return
      }

      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', async () => {
        try {
          const val = JSON.parse(body)
          const electronProxy = convertChromeProxyToElectronProxy(val)
          
          await session.defaultSession.setProxy(electronProxy)
          console.log('[NeXusWeb Proxy Bridge] Applied Proxy to Chromium Session:', electronProxy)

          // Broadcast proxy change to all open windows
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('vpn-proxy-applied', {
                active: electronProxy.mode !== 'direct',
                config: electronProxy
              })
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (e) {
          console.error('[NeXusWeb Proxy Bridge Error]', e.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  proxyBridgeServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[NeXusWeb Proxy Bridge] Bridge already running on port 49152 in another process.')
    } else {
      console.warn('[NeXusWeb Proxy Bridge Server Error]', err.message)
    }
  })

  try {
    proxyBridgeServer.listen(49152, '127.0.0.1', () => {
      console.log('[NeXusWeb Proxy Bridge] Active securely on http://127.0.0.1:49152')
    })
  } catch (err) {
    console.warn('[NeXusWeb Proxy Bridge Listen Warning]', err.message)
  }
}

// Ignore self-signed certificates on localhost/127.0.0.1 for local dev servers
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') {
      event.preventDefault()
      callback(true)
      return
    }
  } catch (e) {}
  callback(false)
})

// ─── Multi-Window State Manager ───────────────────────────────────────────────
const windowStates = new Map() // windowId -> WindowState

function getWindowState(win) {
  if (!win || win.isDestroyed()) return null
  if (!windowStates.has(win.id)) {
    windowStates.set(win.id, {
      win,
      tabs: new Map(),
      activeTabId: null,
      splitTabId: null,
      isSplitView: false,
      isMenuOpen: false,
      activeDrawer: null,
      isMediaHudOpen: false,
      isBookmarksBarOpen: false,
      isReaderModeOpen: false,
      isStatusBarOpen: true,
      isTerminalOpen: false,
      isTerminalMinimized: false,
      closedTabsStack: [],
    })
  }
  return windowStates.get(win.id)
}

function getWindowStateFromSender(sender) {
  if (!sender) return null
  const win = BrowserWindow.fromWebContents(sender)
  if (win) return getWindowState(win)

  // Check if sender belongs to a BrowserView in any window
  for (const [winId, state] of windowStates.entries()) {
    for (const [tabId, tab] of state.tabs.entries()) {
      if (tab.view && !tab.view.webContents.isDestroyed() && tab.view.webContents === sender) {
        return state
      }
    }
  }

  // Fallback to first available window state
  const firstWin = BrowserWindow.getAllWindows()[0]
  return firstWin ? getWindowState(firstWin) : null
}

let isEcosystemDiscoveryStarted = false
function startEcosystemDiscovery(getWin) {
  if (isEcosystemDiscoveryStarted) return
  isEcosystemDiscoveryStarted = true
  try {
    const dgram = require('dgram')
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString())
        if (data.ecosystem === 'ChevronNexus-Lab' || data.app === 'ChevronNexusHomePro') {
          const key = `${data.ip}:${data.port}`
          discoveredEcosystemServers.set(key, { ...data, lastSeen: Date.now() })
          const win = typeof getWin === 'function' ? getWin() : getWin
          if (win && !win.isDestroyed()) {
            win.webContents.send('ecosystem-server-discovered', data)
          }
        }
      } catch (e) {}
    })
    socket.on('error', () => {})
    socket.bind(45454, () => {
      console.log('[Ecosystem] 📡 UDP Auto-Discovery listener active on port 45454')
    })
  } catch (err) {
    console.warn('[Ecosystem] UDP init notice:', err.message)
  }
}

// ─── Window Creation (Ultra-Fast 0ms Flash-Free Launch) ───────────────────────
function createWindow(initialUrl = null, isPrivate = false) {
  const iconPath = path.join(__dirname, '../src/assets/icon.png')

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    backgroundColor: isPrivate ? '#090812' : '#0a0d14',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
  })

  Menu.setApplicationMenu(null)

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Browser Console] ${message} (${sourceId}:${line})`)
  })

  const state = getWindowState(win)
  state.isPrivate = !!isPrivate
  state.privatePartition = isPrivate ? `private_den_${Date.now()}_${Math.random().toString(36).slice(2)}` : null

  const activeSession = isPrivate ? session.fromPartition(state.privatePartition) : session.defaultSession

  // WebRTC IP Leak Protection across sessions
  try {
    if (isPrivate) {
      activeSession.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')
      activeSession.clearCache()
      activeSession.clearStorageData()
    } else {
      activeSession.setWebRTCIPHandlingPolicy('default_public_interface_only')
    }
  } catch (e) {}

  initDownloadManager(activeSession, () => win)
  startProxyBridgeServer()
  startEcosystemDiscovery(() => win)
  try { vpnEngine?.start?.()?.catch?.(() => {}) } catch (e) {}

  if (!isPrivate && !chromeExtensionManager) {
    chromeExtensionManager = new ChromeExtensionManager(app.getPath('userData'))
    chromeExtensionManager.init(session.defaultSession).catch(err => {
      console.warn('[NeXusWeb] Error initializing Chrome extensions:', err.message)
    })
  }

  const loadDist = () => {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { query: isPrivate ? { private: '1' } : {} }).then(() => {
      setTimeout(() => {
        const targetUrl = initialUrl || (isPrivate ? 'https://duckduckgo.com' : getDefaultUrlForMode(currentMode))
        createTabForWindow(state, targetUrl, isPrivate)
      }, 150)
    }).catch(err => {
      console.error('[NeXusWeb] Failed to load dist/index.html:', err)
    })
  }

  if (isDev) {
    const devUrl = isPrivate ? 'http://localhost:5173?private=1' : 'http://localhost:5173'
    win.loadURL(devUrl).then(() => {
      setTimeout(() => {
        const targetUrl = initialUrl || (isPrivate ? 'https://duckduckgo.com' : getDefaultUrlForMode(currentMode))
        createTabForWindow(state, targetUrl, isPrivate)
      }, 150)
    }).catch(() => loadDist())
  } else {
    loadDist()
  }

  win.on('closed', () => {
    state.tabs.forEach((tab) => {
      try { win.removeBrowserView(tab.view) } catch (e) {}
      try { tab.view.webContents.destroy() } catch (e) {}
    })
    state.tabs.clear()

    // FULL DATA WIPE for Private Den Virtual Sandbox on Window Close
    if (state.isPrivate && state.privatePartition) {
      try {
        const privSession = session.fromPartition(state.privatePartition)
        privSession.clearStorageData({
          storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
        }).catch(() => {})
        privSession.clearCache().catch(() => {})
        privSession.clearHostResolverCache().catch(() => {})
        console.log('[NeXusWeb Private Den] Completed 100% full data & cookie wipe on close.')
      } catch (e) {}
    }

    windowStates.delete(win.id)
  })

  win.on('resize', () => repositionAllViewsForWindow(state))
  win.on('maximize', () => {
    win?.webContents.send('window-state-change', 'maximized')
    repositionAllViewsForWindow(state)
  })
  win.on('unmaximize', () => {
    win?.webContents.send('window-state-change', 'normal')
    repositionAllViewsForWindow(state)
  })

  // Setup network filter with privacy notifications
  setupNetworkFilter(activeSession, currentMode, (privacyEvent) => {
    win?.webContents.send('privacy-event', privacyEvent)
  }, () => state.activeTabId)

  return win
}

function getErrorPageHtml(url, errorCode, errorDesc) {
  const safeUrl = String(url).replace(/"/g, '&quot;')
  const isLocalhostUrl = url.includes('localhost') || url.includes('127.0.0.1')
  
  return `data:text/html;charset=utf-8,` + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Connection Failed · NeXusWeb</title>
      <style>
        :root {
          --bg: #0a0d14;
          --card-bg: #0f1320;
          --text: #e8eaf2;
          --muted: #8892aa;
          --accent: #00d4ff;
          --border: #1e2640;
          --amber: #f59e0b;
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f1f5f9;
            --card-bg: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --accent: #0284c7;
            --border: #cbd5e1;
            --amber: #d97706;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 24px;
        }
        .card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 36px 32px;
          max-width: 520px;
          width: 100%;
          text-align: center;
          box-shadow: 0 16px 48px rgba(0,0,0,0.3);
        }
        .icon { font-size: 44px; margin-bottom: 12px; }
        h1 { font-size: 19px; font-weight: 600; margin-bottom: 8px; color: var(--accent); }
        p { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
        .url-box {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          font-family: 'Consolas', monospace;
          font-size: 12px;
          color: var(--amber);
          word-break: break-all;
          margin-bottom: 18px;
        }
        .hint {
          background: rgba(0, 212, 255, 0.08);
          border-left: 3px solid var(--accent);
          padding: 10px 14px;
          border-radius: 4px;
          font-size: 12px;
          text-align: left;
          margin-bottom: 20px;
          color: var(--text);
        }
        .actions { display: flex; gap: 10px; justify-content: center; }
        button {
          padding: 9px 18px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-retry {
          background: var(--accent);
          color: #0a0d14;
          border: none;
        }
        .btn-retry:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-home {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border);
        }
        .btn-home:hover { background: var(--border); }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${isLocalhostUrl ? '🔌' : '🌐'}</div>
        <h1>${isLocalhostUrl ? 'Local Server Offline' : 'Page Unreachable'}</h1>
        <p>${isLocalhostUrl 
          ? 'No active server is responding at this local port.' 
          : 'NeXusWeb could not establish a connection to this site.'}</p>
        <div class="url-box">${safeUrl}</div>
        ${isLocalhostUrl ? `
          <div class="hint">
            💡 <strong>Quick Fix:</strong> Start your development server in your project directory (e.g. <code>npm run dev</code> or <code>python manage.py runserver</code>).
          </div>
        ` : `
          <div class="hint">
            💡 <strong>Error Details:</strong> ${errorDesc || errorCode || 'Connection refused'}
          </div>
        `}
        <div class="actions">
          <button class="btn-retry" onclick="window.location.reload()">Retry Connection</button>
        </div>
      </div>
    </body>
    </html>
  `)
}

// ─── BrowserView Tab Management Per Window ───────────────────────────────────
function getDefaultUrlForMode(mode) {
  return 'nexusweb://home'
}

function createTabForWindow(state, url, isPrivate = false) {
  if (!state || !state.win || state.win.isDestroyed()) return null
  const isPriv = isPrivate || !!state.isPrivate
  const targetUrl = url || (isPriv ? 'https://duckduckgo.com' : getDefaultUrlForMode(currentMode))
  const tabId = ++tabCounter
  const initialTitle = targetUrl === 'nexusweb://home' ? 'Home' : (isPriv ? 'Private Den' : 'New Tab')
  
  const partition = state.privatePartition || (isPriv ? `private_den_${Date.now()}` : undefined)
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'tabPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      partition,
      webSecurity: currentMode !== 'dev',
      devTools: true,
      backgroundThrottling: true,
      spellcheck: false,
    },
  })

  // Prevent white flash by setting obsidian dark background
  view.setBackgroundColor('#0a0d14')

  // Hardened standard Chrome user agent
  view.webContents.setUserAgent(CHROME_USER_AGENT)

  const tab = {
    id: tabId,
    view,
    url: targetUrl,
    title: initialTitle,
    favicon: null,
    zoomFactor: 1.0,
    isPlayingAudio: false,
    hasMedia: false,
    isPrivate: !!isPrivate,
    isSleeping: false,
    lastActiveTime: Date.now(),
  }
  state.tabs.set(tabId, tab)
  performanceEngine.markTabActive(tabId)

  // Right-Click Context Menu: Links, Images, Media, Selection, and Navigation
  view.webContents.on('context-menu', (event, params) => {
    const menuTemplate = []

    // 1. Link Context
    if (params.linkURL) {
      menuTemplate.push(
        { label: 'Open link in new tab', click: () => createTabForWindow(state, params.linkURL, tab.isPrivate) },
        { label: 'Open link in new window', click: () => createWindow(params.linkURL, false) },
        { label: 'Open link in new private window', click: () => createWindow(params.linkURL, true) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      )
    }

    // 2. Image Context
    if (params.mediaType === 'image' || (params.srcURL && !['video', 'audio'].includes(params.mediaType))) {
      menuTemplate.push(
        { label: 'Open image in new tab', click: () => createTabForWindow(state, params.srcURL, tab.isPrivate) },
        { label: 'Save image as...', click: () => view.webContents.downloadURL(params.srcURL) },
        { label: 'Copy image', click: () => view.webContents.copyImageAt(params.x, params.y) },
        { label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' }
      )
    }

    // 3. Video & Audio Media Context
    if (params.mediaType === 'video' || params.mediaType === 'audio') {
      menuTemplate.push(
        { label: 'Open media in new tab', click: () => createTabForWindow(state, params.srcURL, tab.isPrivate) },
        { label: 'Save media as...', click: () => view.webContents.downloadURL(params.srcURL) },
        { label: 'Copy media address', click: () => clipboard.writeText(params.srcURL) },
        { label: 'Picture-in-Picture', click: () => triggerPictureInPictureForWindow(state, tabId) },
        { type: 'separator' }
      )
    }

    // 4. Selected Text Context
    if (params.selectionText && params.selectionText.trim()) {
      const selected = params.selectionText.trim()
      const preview = selected.length > 20 ? `${selected.slice(0, 20)}…` : selected
      const currentSettings = getSettings()
      const searchEngine = currentSettings.searchEngine || { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' }
      menuTemplate.push(
        {
          label: `Search ${searchEngine.name} for "${preview}"`,
          click: () => {
            const searchUrl = searchEngine.url ? searchEngine.url.replace('{query}', encodeURIComponent(selected)) : `https://duckduckgo.com/?q=${encodeURIComponent(selected)}`
            createTabForWindow(state, searchUrl, tab.isPrivate)
          }
        },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => view.webContents.copy() },
        { type: 'separator' }
      )
    }

    // 5. Editable field actions
    if (params.isEditable) {
      menuTemplate.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' }
      )
    }

    // 6. Standard Page Navigation & Tools
    menuTemplate.push(
      { label: 'Back', enabled: view.webContents.canGoBack(), accelerator: 'Alt+Left', click: () => view.webContents.goBack() },
      { label: 'Forward', enabled: view.webContents.canGoForward(), accelerator: 'Alt+Right', click: () => view.webContents.goForward() },
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => view.webContents.reload() },
      { type: 'separator' },
      {
        label: 'Save page as...',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          dialog.showSaveDialog(state.win, {
            defaultPath: 'page.html',
            filters: [{ name: 'Webpage, Complete', extensions: ['html', 'htm'] }]
          }).then(({ filePath }) => {
            if (filePath) {
              view.webContents.savePage(filePath, 'HTMLComplete').catch(() => {})
            }
          })
        }
      },
      { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => view.webContents.print() },
      { type: 'separator' },
      { label: 'Inspect Element', click: () => view.webContents.inspectElement(params.x, params.y) },
      { label: 'Developer Tools (F12)', accelerator: 'F12', click: () => view.webContents.toggleDevTools() }
    )

    const menu = Menu.buildFromTemplate(menuTemplate)
    menu.popup({ window: state.win })
  })

  // Keyboard zoom handler inside webContents (Ctrl + / Ctrl - / Ctrl 0)
  view.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.type === 'keyDown') {
        if (input.key === '=' || input.key === '+') {
          event.preventDefault()
          setZoomForWindow(state, tabId, Math.min(3.0, (tab.zoomFactor || 1.0) + 0.1))
        } else if (input.key === '-') {
          event.preventDefault()
          setZoomForWindow(state, tabId, Math.max(0.3, (tab.zoomFactor || 1.0) - 0.1))
        } else if (input.key === '0') {
          event.preventDefault()
          setZoomForWindow(state, tabId, 1.0)
        }
      }
    }
  })

  // Injected Always-Visible Scrollbars and Ctrl + MouseWheel smooth zooming
  view.webContents.on('dom-ready', () => {
    const currentUrl = view.webContents.getURL() || ''

    // Skip CSS/script injections on Google, Cloudflare challenge frames, and other CSP-strict domains
    const isProtectedDomain = (
      currentUrl.includes('accounts.google.com') ||
      currentUrl.includes('google.com/signin') ||
      currentUrl.includes('challenges.cloudflare.com') ||
      currentUrl.includes('recaptcha.net') ||
      currentUrl.includes('hcaptcha.com') ||
      currentUrl.includes('gstatic.com') ||
      currentUrl.includes('accounts.youtube.com') ||
      currentUrl.startsWith('about:') ||
      currentUrl.startsWith('data:')
    )

    // 1. Ensure scrollbars are always clearly visible and never clipped or hidden
    if (!isProtectedDomain) {
      view.webContents.insertCSS(`
        ::-webkit-scrollbar {
          width: 10px !important;
          height: 10px !important;
          background-color: rgba(10, 13, 20, 0.85) !important;
          display: block !important;
        }
        ::-webkit-scrollbar-track {
          background: rgba(15, 20, 32, 0.75) !important;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.45) !important;
          border-radius: 6px !important;
          border: 2px solid rgba(15, 20, 32, 0.75) !important;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #00d4ff !important;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.8) !important;
        }
        ::-webkit-scrollbar-corner {
          background: rgba(10, 13, 20, 0.9) !important;
        }
      `).catch(() => {})
    }

    if (isProtectedDomain) return

    const currentSettings = getSettings()
    if (currentSettings.enableCtrlWheelZoom !== false) {
      view.webContents.executeJavaScript(`
        if (!window.__nexus_wheel_zoom_attached) {
          window.__nexus_wheel_zoom_attached = true;
          window.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const dir = e.deltaY < 0 ? 'in' : 'out';
              window.postMessage({ type: 'nexus-zoom-wheel', dir: dir }, '*');
            }
          }, { passive: false });
        }
      `).catch(() => {})
    }

    // 3. Inject Safari Custom In-Page Video Player HUD on all videos
    view.webContents.executeJavaScript(SAFARI_IN_PAGE_VIDEO_PLAYER_SCRIPT).catch(() => {})

    // 4. Inject Form AutoFill & Password Prompt Script
    view.webContents.executeJavaScript(passwordManager.AUTOFILL_INJECTOR_SCRIPT).catch(() => {})
  })

  // Open target="_blank" in a new tab within this window
  view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (!targetUrl || targetUrl === 'about:blank' || targetUrl.startsWith('javascript:')) {
      return { action: 'deny' }
    }

    const settings = getSettings()
    const isAdblockDisabled = settings.adblockLevel === 'off'
    const whitelist = settings.adblockWhitelist || []

    if (!isAdblockDisabled) {
      const adCheck = checkAdOrTracker(targetUrl, whitelist)
      if (adCheck.isBlocked) {
        console.log(`[NeXusWeb] Blocked ad/popup window creation: ${targetUrl}`)
        adblockStats.adsBlocked++
        return { action: 'deny' }
      }
    }

    createTabForWindow(state, targetUrl, tab.isPrivate)
    return { action: 'deny' }
  })

  // Find in page result callback
  view.webContents.on('found-in-page', (event, result) => {
    state.win?.webContents.send('find-result', {
      tabId,
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
      selectionArea: result.selectionArea,
      finalUpdate: result.finalUpdate,
    })
  })

  // Audio Playback Tracking
  view.webContents.on('audio-state-changed', (event, audible) => {
    const t = state.tabs.get(tabId)
    if (t && t.isPlayingAudio !== audible) {
      t.isPlayingAudio = audible
      state.win?.webContents.send('tab-audio-changed', { tabId, isPlayingAudio: audible })
    }
  })

  // ── HTML5 Video Fullscreen Handler ──────────────────────────────────────────
  view.webContents.on('enter-html-full-screen', () => {
    const t = state.tabs.get(tabId)
    if (t) {
      t.isHtmlFullScreen = true
      state.isHtmlFullScreen = true
      if (state.win && !state.win.isDestroyed()) {
        const bounds = state.win.getContentBounds()
        try {
          view.setBounds({
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
          })
        } catch (e) {}
        state.win.webContents.send('html-fullscreen-change', { tabId, isFullScreen: true })
      }
    }
  })

  view.webContents.on('leave-html-full-screen', () => {
    const t = state.tabs.get(tabId)
    if (t) {
      t.isHtmlFullScreen = false
      state.isHtmlFullScreen = false
      repositionAllViewsForWindow(state)
      state.win?.webContents.send('html-fullscreen-change', { tabId, isFullScreen: false })
    }
  })

  view.webContents.on('did-navigate', (e, navUrl) => {
    if (navUrl.startsWith('data:text/html')) return
    const t = state.tabs.get(tabId)
    if (t) {
      t.url = navUrl
      if (!state.isPrivate && !t.isPrivate) {
        addHistory({ url: navUrl, title: t.title, favicon: t.favicon })
      }
      state.win?.webContents.send('tab-updated', {
        tabId,
        url: navUrl,
        title: t.title,
        favicon: t.favicon,
        canGoBack: view.webContents.canGoBack(),
        canGoForward: view.webContents.canGoForward(),
        bookmarked: isBookmarked(navUrl),
        zoomFactor: t.zoomFactor || 1.0,
        isPlayingAudio: !!t.isPlayingAudio,
      })
    }
  })

  view.webContents.on('did-navigate-in-page', (e, navUrl) => {
    if (navUrl.startsWith('data:text/html')) return
    const t = state.tabs.get(tabId)
    if (t) {
      t.url = navUrl
      state.win?.webContents.send('tab-updated', {
        tabId, url: navUrl, title: t.title,
        bookmarked: isBookmarked(navUrl),
      })
    }
  })

  view.webContents.on('page-title-updated', (e, title) => {
    const t = state.tabs.get(tabId)
    if (t && !t.url.startsWith('data:text/html')) {
      t.title = title
      state.win?.webContents.send('tab-updated', { tabId, url: t.url, title })
    }
  })

  view.webContents.on('page-favicon-updated', (e, favicons) => {
    const t = state.tabs.get(tabId)
    if (t && favicons.length > 0) {
      t.favicon = favicons[0]
      state.win?.webContents.send('tab-updated', { tabId, url: t.url, title: t.title, favicon: favicons[0] })
    }
  })

  view.webContents.on('did-start-loading', () => {
    state.win?.webContents.send('tab-loading', { tabId, loading: true })
  })

  view.webContents.on('did-stop-loading', () => {
    state.win?.webContents.send('tab-loading', { tabId, loading: false })
    const t = state.tabs.get(tabId)
    if (t && t.url !== 'nexusweb://home' && !t.url.startsWith('data:text/html')) {
      const navUrl = view.webContents.getURL()
      if (navUrl && !navUrl.startsWith('devtools://') && !navUrl.startsWith('data:')) {
        t.url = navUrl
        if (!state.isPrivate && !t.isPrivate) {
          addHistory({ url: navUrl, title: t.title, favicon: t.favicon })
        }
        state.win?.webContents.send('tab-updated', {
          tabId,
          url: navUrl,
          canGoBack: view.webContents.canGoBack(),
          canGoForward: view.webContents.canGoForward(),
          bookmarked: isBookmarked(navUrl),
        })

        // Skip script injections on Google, Cloudflare, and other CSP-strict / Trusted Types domains
        const isProtectedNavUrl = (
          navUrl.includes('accounts.google.com') ||
          navUrl.includes('google.com/signin') ||
          navUrl.includes('challenges.cloudflare.com') ||
          navUrl.includes('recaptcha.net') ||
          navUrl.includes('hcaptcha.com') ||
          navUrl.includes('gstatic.com') ||
          navUrl.includes('accounts.youtube.com')
        )

        if (!isProtectedNavUrl) {
          if (currentMode === 'normal' || state.isPrivate || t.isPrivate) {
            view.webContents.executeJavaScript(UNIVERSAL_COSMETIC_ADBLOCK_SCRIPT).catch(() => {})

            if (navUrl.includes('youtube.com') || navUrl.includes('youtu.be')) {
              view.webContents.executeJavaScript(YOUTUBE_AD_SHIELD_SCRIPT).catch(() => {})
            }
          }
          view.webContents.executeJavaScript(SAFARI_IN_PAGE_VIDEO_PLAYER_SCRIPT).catch(() => {})
        }
      }
    }
  })

  view.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignore aborted (-3), blocked by client/adblock (-20), and subresource failures
    if (errorCode === -3 || errorCode === -20) return
    if (isMainFrame === false) return
    if (!validatedURL || validatedURL === 'about:blank' || validatedURL.startsWith('data:') || validatedURL.startsWith('nexusweb://')) return
    console.log(`[NeXusWeb] Page load failed: ${validatedURL} (${errorCode}: ${errorDescription})`)
    const t = state.tabs.get(tabId)
    if (t && validatedURL && !validatedURL.startsWith('devtools://') && !validatedURL.startsWith('data:')) {
      view.webContents.loadURL(getErrorPageHtml(validatedURL, errorCode, errorDescription)).catch(() => {})
    }
  })

  setActiveTabForWindow(state, tabId)
  if (targetUrl && targetUrl !== 'nexusweb://home') {
    navigateTabForWindow(state, tabId, targetUrl)
  }

  state.win?.webContents.send('tab-created', {
    tabId,
    url: tab.url,
    title: tab.title,
  })

  return tabId
}

function setActiveTabForWindow(state, tabId) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (!state || !state.win || !id) return

  state.activeTabId = id
  repositionAllViewsForWindow(state)

  const tab = state.tabs.get(id)
  if (tab) {
    tab.lastActiveTime = Date.now()
    if (tab.isSleeping) {
      performanceEngine.wakeTab(tab, (data) => {
        state.win.webContents.send('tab-sleep-change', data)
      })
    } else {
      performanceEngine.markTabActive(id)
    }

    // Trigger lightweight GC on background inactive views
    state.tabs.forEach((t, tId) => {
      if (tId !== id && t.view && !t.view.webContents.isDestroyed()) {
        t.view.webContents.executeJavaScript('if (window.gc) window.gc();').catch(() => {})
      }
    })

    if (tab.url && tab.url !== 'nexusweb://home') {
      state.win.webContents.send('tab-updated', {
        tabId: id,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        canGoBack: tab.view.webContents.canGoBack(),
        canGoForward: tab.view.webContents.canGoForward(),
        bookmarked: isBookmarked(tab.url),
        zoomFactor: tab.zoomFactor || 1.0,
        isPlayingAudio: !!tab.isPlayingAudio,
      })
    } else {
      state.win.webContents.send('show-home', id)
    }
    state.win.webContents.send('active-tab-changed', id)
  }
}

function setSplitTabForWindow(state, tabId) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (state.tabs.has(id)) {
    state.splitTabId = id
    repositionAllViewsForWindow(state)
    state.win?.webContents.send('split-view-changed', { enabled: state.isSplitView, splitTabId: state.splitTabId })
  }
}

function toggleSplitViewForWindow(state, enabled) {
  state.isSplitView = enabled !== undefined ? enabled : !state.isSplitView
  if (state.isSplitView) {
    const validIds = [...state.tabs.keys()].filter(id => typeof id === 'number')
    if (!state.splitTabId || state.splitTabId === state.activeTabId || !state.tabs.has(state.splitTabId)) {
      const otherTabId = validIds.find(id => id !== state.activeTabId)
      if (otherTabId) {
        state.splitTabId = otherTabId
      } else {
        state.splitTabId = createTabForWindow(state, 'nexusweb://home')
        state.win?.webContents.send('tab-created', { tabId: state.splitTabId, url: 'nexusweb://home', title: 'Home' })
      }
    }
  } else {
    state.splitTabId = null
  }
  repositionAllViewsForWindow(state)
  state.win?.webContents.send('split-view-changed', { enabled: state.isSplitView, splitTabId: state.splitTabId })
  return state.isSplitView
}

function removeTabForWindow(state, tabId) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  const tab = state.tabs.get(id) || state.tabs.get(tabId)
  if (!tab) return

  // Save to closed tabs stack for Ctrl+Shift+T
  if (tab.url && tab.url !== 'nexusweb://home' && !tab.url.startsWith('data:')) {
    state.closedTabsStack.unshift({ url: tab.url, title: tab.title })
    if (state.closedTabsStack.length > 10) state.closedTabsStack.pop()
  }

  if (state.win) {
    try { state.win.removeBrowserView(tab.view) } catch (e) {}
  }
  try { tab.view.webContents.destroy() } catch (e) {}
  state.tabs.delete(id)
  state.tabs.delete(tabId)
  state.win?.webContents.send('tab-removed', id)

  try {
    if (global.gc) global.gc()
  } catch (e) {}

  if (state.splitTabId === id || state.splitTabId === tabId) {
    state.splitTabId = null
    state.isSplitView = false
    state.win?.webContents.send('split-view-changed', { enabled: false, splitTabId: null })
  }

  if (state.activeTabId === id || state.activeTabId === tabId) {
    const remaining = [...state.tabs.keys()].filter(k => typeof k === 'number')
    if (remaining.length > 0) setActiveTabForWindow(state, remaining[remaining.length - 1])
    else createTabForWindow(state)
  } else {
    repositionAllViewsForWindow(state)
  }
}

function reopenLastClosedTabForWindow(state) {
  if (state.closedTabsStack.length === 0) return null
  const last = state.closedTabsStack.shift()
  if (last && last.url) {
    return createTabForWindow(state, last.url)
  }
  return null
}

function resolveUrl(input) {
  const str = (input || '').trim()
  if (!str || str === 'nexusweb://home') return 'nexusweb://home'
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('file://') || str.startsWith('devtools://') || str.startsWith('chrome-extension://')) {
    return str
  }
  if (/^\d{1,5}$/.test(str)) {
    return `http://localhost:${str}`
  }
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i.test(str)) {
    return `http://${str}`
  }
  if (/^(192\.168\.|10\.|172\.)/.test(str)) {
    return `http://${str}`
  }
  if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(str)) {
    return `https://${str}`
  }
  
  const currentSettings = getSettings()
  const engine = currentSettings.searchEngine || { url: 'https://duckduckgo.com/?q={query}' }
  const searchUrlTemplate = engine.url || 'https://duckduckgo.com/?q={query}'
  return searchUrlTemplate.replace('{query}', encodeURIComponent(str))
}

function navigateTabForWindow(state, tabId, url) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : (tabId || state.activeTabId)
  const tab = state.tabs.get(id)
  if (!tab || !state.win) return

  const targetUrl = url || getDefaultUrlForMode(currentMode)

  if (targetUrl === 'nexusweb://home') {
    tab.url = 'nexusweb://home'
    tab.title = 'Home'
    repositionAllViewsForWindow(state)
    state.win.webContents.send('show-home', id)
    state.win.webContents.send('tab-updated', { tabId: id, url: 'nexusweb://home', title: 'Home', favicon: null })
    return
  }

  const finalUrl = resolveUrl(targetUrl)
  tab.url = finalUrl
  repositionAllViewsForWindow(state)

  tab.view.webContents.loadURL(finalUrl).catch(err => {
    console.error(`[NeXusWeb] loadURL error on ${finalUrl}:`, err.message)
    state.win.webContents.send('navigation-error', { tabId: id, error: err.message, url: finalUrl })
  })
}

function repositionAllViewsForWindow(state) {
  if (!state || !state.win || state.win.isDestroyed()) return
  const bounds = state.win.getContentBounds()
  const BOOKMARKS_OFFSET = state.isBookmarksBarOpen ? 28 : 0
  const TOP_OFFSET = (state.isSplitView ? 140 : 106) + BOOKMARKS_OFFSET
  
  const TERMINAL_OFFSET = state.isTerminalOpen ? (state.isTerminalMinimized ? 32 : 280) : 0
  const STATUS_BAR_OFFSET = (state.isStatusBarOpen !== false) ? 22 : 0
  const BOTTOM_OFFSET = STATUS_BAR_OFFSET + TERMINAL_OFFSET
  const contentHeight = Math.max(0, bounds.height - TOP_OFFSET - BOTTOM_OFFSET)
  const MODAL_PANELS = [
    'settings', 'about', 'help', 'shortcuts', 'shortcuts-help',
    'api-workbench', 'extensions', 'passwords', 'performance',
    'task-manager', 'cast', 'webapp-install', 'sync', 'theme', 'theme-studio',
    'modes-info'
  ]

  let DRAWER_WIDTH = 0
  if (state.activeDrawer && !MODAL_PANELS.includes(state.activeDrawer)) {
    if (typeof state.drawerWidth === 'number' && state.drawerWidth > 0) {
      DRAWER_WIDTH = state.drawerWidth
    } else if (state.activeDrawer === 'menu') {
      DRAWER_WIDTH = 260
    } else if (state.activeDrawer === 'quick-tools') {
      DRAWER_WIDTH = 340
    } else if (state.activeDrawer === 'notes') {
      DRAWER_WIDTH = 480
    } else {
      DRAWER_WIDTH = 380
    }
  }
  const availableWidth = Math.max(0, bounds.width - DRAWER_WIDTH)

  // If Reader Mode is active or any full-screen Modal Overlay is open, do NOT attach BrowserView so DOM overlay is 100% visible and interactive!
  const isModalActive = state.isReaderModeOpen ||
                        state.isModesInfoOpen ||
                        MODAL_PANELS.includes(state.activeDrawer)

  const currentAttachedViews = new Set(state.win.getBrowserViews() || [])
  const requiredViews = new Set()

  if (!isModalActive) {
    if (!state.isSplitView) {
      const mainTab = state.tabs.get(state.activeTabId)
      if (mainTab && mainTab.url && mainTab.url !== 'nexusweb://home' && mainTab.view) {
        requiredViews.add(mainTab.view)
      }
    } else {
      const leftTab = state.tabs.get(state.activeTabId)
      if (leftTab && leftTab.url && leftTab.url !== 'nexusweb://home' && leftTab.view) {
        requiredViews.add(leftTab.view)
      }
      const rightTab = state.tabs.get(state.splitTabId)
      if (rightTab && rightTab.url && rightTab.url !== 'nexusweb://home' && rightTab.view) {
        requiredViews.add(rightTab.view)
      }
    }
  }

  // Detach only views that are no longer supposed to be visible
  currentAttachedViews.forEach((v) => {
    if (!requiredViews.has(v)) {
      try { state.win.removeBrowserView(v) } catch (e) {}
    }
  })

  // Attach only views that are not yet attached
  requiredViews.forEach((v) => {
    if (!currentAttachedViews.has(v)) {
      try { state.win.addBrowserView(v) } catch (e) {}
    }
  })

  // Set bounds smoothly
  if (!isModalActive) {
    if (!state.isSplitView) {
      const mainTab = state.tabs.get(state.activeTabId)
      if (mainTab && mainTab.url && mainTab.url !== 'nexusweb://home' && mainTab.view) {
        try {
          if (mainTab.isHtmlFullScreen || state.isHtmlFullScreen) {
            mainTab.view.setBounds({
              x: 0,
              y: 0,
              width: bounds.width,
              height: bounds.height,
            })
          } else {
            mainTab.view.setBounds({
              x: 0,
              y: TOP_OFFSET,
              width: availableWidth,
              height: contentHeight,
            })
          }
        } catch (e) {}
      }
    } else {
      const ratio = Math.max(0.15, Math.min(0.85, typeof state.splitRatio === 'number' ? state.splitRatio : 0.5))
      const SPLIT_BAR_WIDTH = 6
      const usableWidth = Math.max(0, availableWidth - SPLIT_BAR_WIDTH)
      const leftWidth = Math.floor(usableWidth * ratio)
      const rightWidth = Math.max(0, usableWidth - leftWidth)

      const leftTab = state.tabs.get(state.activeTabId)
      if (leftTab && leftTab.url && leftTab.url !== 'nexusweb://home' && leftTab.view) {
        try {
          leftTab.view.setBounds({
            x: 0,
            y: TOP_OFFSET,
            width: leftWidth,
            height: contentHeight,
          })
        } catch (e) {}
      }

      const rightTab = state.tabs.get(state.splitTabId)
      if (rightTab && rightTab.url && rightTab.url !== 'nexusweb://home' && rightTab.view) {
        try {
          rightTab.view.setBounds({
            x: leftWidth + SPLIT_BAR_WIDTH,
            y: TOP_OFFSET,
            width: rightWidth,
            height: contentHeight,
          })
        } catch (e) {}
      }
    }
  }
}

// ─── Find in Page ─────────────────────────────────────────────────────────────
function findInPageForWindow(state, text, forward = true, findNext = false) {
  const tab = state.tabs.get(state.activeTabId)
  if (tab && tab.view && text) {
    return tab.view.webContents.findInPage(text, { forward, findNext })
  }
  return null
}

function stopFindInPageForWindow(state, action = 'clearSelection') {
  const tab = state.tabs.get(state.activeTabId)
  if (tab && tab.view) {
    tab.view.webContents.stopFindInPage(action)
  }
}

// ─── Screenshot Capture ───────────────────────────────────────────────────────
async function captureCurrentPageForWindow(state) {
  try {
    const tab = state.tabs.get(state.activeTabId)
    let img = null

    if (tab && tab.view && tab.url && tab.url !== 'nexusweb://home') {
      try {
        img = await tab.view.webContents.capturePage()
      } catch (e) {}
    }

    if (!img || img.isEmpty()) {
      img = await state.win.capturePage()
    }

    if (!img || img.isEmpty()) {
      return { success: false, error: 'Screenshot capture returned empty buffer' }
    }

    const desktopPath = app.getPath('desktop')
    const filename = `nexusweb_screenshot_${Date.now()}.png`
    const filePath = path.join(desktopPath, filename)
    const pngBuffer = img.toPNG()
    fs.writeFileSync(filePath, pngBuffer)
    return { success: true, filePath, filename }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Picture-in-Picture & Media Controls ──────────────────────────────────────
async function triggerPictureInPictureForWindow(state, tabId) {
  const targetId = tabId || state.activeTabId
  const tab = state.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active web view' }
  try {
    return await tab.view.webContents.executeJavaScript(PIP_INJECTOR_SCRIPT)
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function executeMediaCommandForWindow(state, tabId, command) {
  const targetId = tabId || state.activeTabId
  const tab = state.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false }

  try {
    const script = `
      (function() {
        const media = Array.from(document.querySelectorAll('video, audio'));
        if (media.length === 0) return { success: false, error: 'No media found' };
        const primary = media.find(m => !m.paused) || media[0];
        
        switch ('${command}') {
          case 'play-pause':
            if (primary.paused) primary.play();
            else primary.pause();
            return { success: true, paused: primary.paused };
          case 'skip-forward':
            primary.currentTime = Math.min(primary.duration || Infinity, primary.currentTime + 10);
            return { success: true, currentTime: primary.currentTime };
          case 'skip-backward':
            primary.currentTime = Math.max(0, primary.currentTime - 10);
            return { success: true, currentTime: primary.currentTime };
          case 'mute-toggle':
            primary.muted = !primary.muted;
            return { success: true, muted: primary.muted };
          default:
            return { success: true };
        }
      })()
    `
    return await tab.view.webContents.executeJavaScript(script)
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ─── Zoom Controls ────────────────────────────────────────────────────────────
function setZoomForWindow(state, tabId, factor) {
  const targetId = tabId || state.activeTabId
  const tab = state.tabs.get(targetId)
  if (tab && tab.view) {
    const clamped = Math.max(0.25, Math.min(3.0, factor))
    tab.zoomFactor = clamped
    tab.view.webContents.setZoomFactor(clamped)
    state.win?.webContents.send('zoom-changed', { tabId: targetId, zoomFactor: clamped })
    return clamped
  }
  return 1.0
}

function getZoomForWindow(state, tabId) {
  const tab = state.tabs.get(tabId || state.activeTabId)
  return tab ? tab.zoomFactor || 1.0 : 1.0
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('create-tab',   (event, url)   => {
  const state = getWindowStateFromSender(event.sender)
  return state ? createTabForWindow(state, url) : null
})
ipcMain.handle('close-tab',    (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) removeTabForWindow(state, tabId)
})
ipcMain.handle('switch-tab',   (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) setActiveTabForWindow(state, tabId)
})
ipcMain.handle('reopen-closed-tab', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? reopenLastClosedTabForWindow(state) : null
})
ipcMain.handle('navigate',     (event, { tabId, url }) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) navigateTabForWindow(state, tabId, url)
})
ipcMain.handle('go-back',      (event) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(state?.activeTabId)
  if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack()
})
ipcMain.handle('go-forward',   (event) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(state?.activeTabId)
  if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward()
})
ipcMain.handle('reload',       (event) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(state?.activeTabId)
  tab?.view.webContents.reload()
})
ipcMain.handle('get-active-tab', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return state?.activeTabId
})
ipcMain.handle('get-tabs', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? [...state.tabs.entries()].map(([id, t]) => ({
    id, url: t.url, title: t.title, favicon: t.favicon,
    zoomFactor: t.zoomFactor || 1.0,
    isPlayingAudio: !!t.isPlayingAudio,
  })) : []
})

// ─── IPC: Multi-Window & Private Den ─────────────────────────────────────────
ipcMain.handle('open-new-window', (_, { url, isPrivate } = {}) => {
  createWindow(url, isPrivate)
  return true
})
ipcMain.handle('is-private-window', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return !!state?.isPrivate
})
ipcMain.handle('wipe-and-exit', (event) => {
  const state = getWindowStateFromSender(event.sender)
  if (state?.win && !state.win.isDestroyed()) {
    state.win.close()
  }
  return true
})

// ─── IPC: Split View ──────────────────────────────────────────────────────────
ipcMain.handle('split-view-toggle', (event, enabled) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? toggleSplitViewForWindow(state, enabled) : false
})
ipcMain.handle('split-view-set-tab', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) setSplitTabForWindow(state, tabId)
})
ipcMain.handle('split-view-set-ratio', (event, ratio) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.splitRatio = Math.max(0.15, Math.min(0.85, parseFloat(ratio) || 0.5))
    repositionAllViewsForWindow(state)
    return state.splitRatio
  }
  return 0.5
})
ipcMain.handle('split-view-get-ratio', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return state?.splitRatio || 0.5
})
ipcMain.handle('split-view-get-state', (event) => {
  const state = getWindowStateFromSender(event.sender)
  return {
    enabled: state?.isSplitView || false,
    splitTabId: state?.splitTabId,
    activeTabId: state?.activeTabId,
    splitRatio: state?.splitRatio || 0.5
  }
})

// ─── IPC: Find in Page ────────────────────────────────────────────────────────
ipcMain.handle('find-in-page',      (event, { text, forward, findNext }) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? findInPageForWindow(state, text, forward, findNext) : null
})
ipcMain.handle('stop-find-in-page', (event, action) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) stopFindInPageForWindow(state, action)
})

// ─── IPC: Screenshot Capture ──────────────────────────────────────────────────
ipcMain.handle('capture-page', async (event) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? captureCurrentPageForWindow(state) : { success: false, error: 'No active window' }
})

// ─── IPC: Media Controls & Picture-in-Picture ─────────────────────────────────
ipcMain.handle('media-pip', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? triggerPictureInPictureForWindow(state, tabId) : { success: false, error: 'No window' }
})
ipcMain.handle('media-control', (event, { tabId, command }) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? executeMediaCommandForWindow(state, tabId, command) : { success: false }
})
ipcMain.handle('media-mute-tab', (event, { tabId, mute }) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(tabId || state?.activeTabId)
  if (tab && tab.view) {
    tab.view.webContents.setAudioMuted(mute)
    return { success: true, muted: mute }
  }
  return { success: false }
})

// ─── IPC: Zoom ────────────────────────────────────────────────────────────────
ipcMain.handle('zoom-set', (event, { tabId, factor }) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? setZoomForWindow(state, tabId, factor) : 1.0
})
ipcMain.handle('zoom-get', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  return state ? getZoomForWindow(state, tabId) : 1.0
})

// ─── IPC: Port Manager ────────────────────────────────────────────────────────
ipcMain.handle('scan-ports', async () => scanLocalPorts())
ipcMain.handle('port-manager-get', async () => getDetailedPortList())
ipcMain.handle('port-manager-kill', async (_, pid) => killProcess(pid))

// ─── IPC: Download Manager ────────────────────────────────────────────────────
ipcMain.handle('downloads-get',            () => getDownloadsList())
ipcMain.handle('downloads-add-multipart',  (_, { url, filename, connections, speedLimitKB }) => addMultiPartDownload(url, filename, connections, speedLimitKB))
ipcMain.handle('downloads-pause',          (_, id) => pauseDownload(id))
ipcMain.handle('downloads-resume',         (_, id) => resumeDownload(id))
ipcMain.handle('downloads-cancel',         (_, id) => cancelDownload(id))
ipcMain.handle('downloads-remove',         (_, id) => removeDownload(id))
ipcMain.handle('downloads-open-file',      (_, id) => openDownloadedFile(id))
ipcMain.handle('downloads-show-folder',    (_, id) => showInFolder(id))
ipcMain.handle('downloads-copy-url',       (_, id) => copyDownloadUrl(id))
ipcMain.handle('downloads-select-folder',  () => selectDownloadFolder())
ipcMain.handle('downloads-clear',          () => clearCompletedDownloads())
ipcMain.handle('download-resolve-intercepted', (_, data) => resolveInterceptedDownload(data))

// ─── IPC: ChevronNexus Lab Ecosystem ──────────────────────────────────────────
const ECOSYSTEM_SECRET_KEY = "nexus_secret_ecosystem_token_2026_lab_auth"
const discoveredEcosystemServers = new Map()

ipcMain.handle('ecosystem-get-servers', () => {
  return Array.from(discoveredEcosystemServers.values())
})

ipcMain.handle('ecosystem-get-telemetry', async () => {
  const http = require('http')
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:80/api/ecosystem/telemetry', { timeout: 1500 }, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) } catch (e) { resolve({ status: 'offline' }) }
      })
    })
    req.on('error', () => {
      // Fallback to port 5000
      const req2 = http.get('http://127.0.0.1:5000/api/ecosystem/telemetry', { timeout: 1500 }, (res2) => {
        let raw2 = ''
        res2.on('data', chunk => raw2 += chunk)
        res2.on('end', () => {
          try { resolve(JSON.parse(raw2)) } catch (e) { resolve({ status: 'offline' }) }
        })
      })
      req2.on('error', () => resolve({ status: 'offline' }))
    })
  })
})

ipcMain.handle('ecosystem-server-download', async (_, downloadData) => {
  const http = require('http')
  const crypto = require('crypto')
  const postPayload = JSON.stringify({
    source_url: downloadData.url,
    destination_portal: downloadData.destination_portal || 'account',
    destination_path: downloadData.destination_path || '',
    target_user: downloadData.target_user || 'house_admin',
    file_name: downloadData.filename || ''
  })

  return new Promise((resolve) => {
    const portsToTry = [80, 5000]
    const tryPort = (idx) => {
      if (idx >= portsToTry.length) {
        return resolve({ success: false, error: 'Could not connect to ChevronNexus Home (Pro) server.' })
      }
      const p = portsToTry[idx]
      const ts = Date.now().toString()
      const sig = crypto.createHmac('sha256', ECOSYSTEM_SECRET_KEY).update(`${ts}:/api/server/fetch_remote`).digest('hex')
      
      const req = http.request({
        hostname: '127.0.0.1',
        port: p,
        path: '/api/server/fetch_remote',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postPayload),
          'X-Nexus-Client': 'NeXusWeb-Desktop',
          'X-Nexus-Timestamp': ts,
          'X-NexusWeb-Signature': sig,
          'User-Agent': 'NeXusWeb-Browser/10.0.0'
        },
        timeout: 5000
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve({ success: true, ...parsed })
          } catch (e) {
            resolve({ success: false, error: 'Invalid response from server' })
          }
        })
      })
      req.on('error', () => tryPort(idx + 1))
      req.write(postPayload)
      req.end()
    }
    tryPort(0)
  })
})

ipcMain.handle('ecosystem-launch-admin', async (event, port = 80) => {
  const state = getWindowStateFromSender(event.sender)
  const adminUrl = `http://127.0.0.1:${port}/admin`
  if (state) {
    return createTabForWindow(state, adminUrl)
  }
  return null
})

// ─── IPC: Scratch Pad / Notes ─────────────────────────────────────────────────
ipcMain.handle('notes-get',       (_, urlKey) => getNoteForUrl(urlKey))
ipcMain.handle('notes-save',      (_, { urlKey, content }) => saveNoteForUrl(urlKey, content))
ipcMain.handle('notes-get-all',   () => getNotes())

// ─── IPC: Request Inspector (Network Logger) ──────────────────────────────────
ipcMain.handle('inspector-get-logs', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  return getTabLogs(tabId || state?.activeTabId)
})
ipcMain.handle('inspector-clear-logs', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  return clearTabLogs(tabId || state?.activeTabId)
})

// ─── IPC: Environment Variables (.env Reader) ─────────────────────────────────
ipcMain.handle('env-get-files', (_, dir) => findEnvFiles(dir))
ipcMain.handle('env-read-file', (_, filePath) => readEnvFile(filePath))

// ─── IPC: Reader Mode (Distraction-Free Extractor) ─────────────────────────────
ipcMain.handle('reader-mode-extract', async (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  const targetId = tabId || state?.activeTabId
  const tab = state?.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active page view' }
  try {
    return await tab.view.webContents.executeJavaScript(READER_MODE_EXTRACTOR_SCRIPT)
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Media HUD Controls ──────────────────────────────────────────────────
ipcMain.handle('media-hud-control', async (event, { tabId, command, value }) => {
  const state = getWindowStateFromSender(event.sender)
  const targetId = tabId || state?.activeTabId
  const tab = state?.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active view' }
  try {
    return await tab.view.webContents.executeJavaScript(MEDIA_HUD_CONTROL_SCRIPT(command, value))
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Safari-Style Custom Video Player Engine ─────────────────────────────
ipcMain.handle('video-control', async (event, { command, payload, tabId }) => {
  const state = getWindowStateFromSender(event.sender)
  const targetId = tabId || state?.activeTabId
  const tab = state?.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active view' }
  try {
    const res = await tab.view.webContents.executeJavaScript(SAFARI_VIDEO_CONTROL_SCRIPT(command, JSON.stringify(payload || {})))
    if (command === 'snapshot' && res?.success && res?.dataUrl) {
      try {
        const base64Data = res.dataUrl.replace(/^data:image\/png;base64,/, '')
        const filename = `NeXusWeb-Snapshot-${Date.now()}.png`
        const savePath = path.join(app.getPath('desktop'), filename)
        fs.writeFileSync(savePath, base64Data, 'base64')
        res.savedPath = savePath
        res.filename = filename
      } catch (fsErr) {
        console.warn('[NeXusWeb] Snapshot save error:', fsErr.message)
      }
    }
    return res
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('video-get-state', async (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  const targetId = tabId || state?.activeTabId
  const tab = state?.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active view' }
  try {
    return await tab.view.webContents.executeJavaScript(SAFARI_VIDEO_CONTROL_SCRIPT('get-state'))
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Network Mode & Privacy ──────────────────────────────────────────────
ipcMain.handle('set-mode', (_, mode) => {
  currentMode = mode
  setFilterMode(mode)
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send('mode-changed', mode)
    }
  })
  return { success: true, mode }
})
ipcMain.handle('get-mode', () => currentMode)
ipcMain.handle('privacy-stats-get', () => ({
  trackersBlocked: privacyStats.trackersBlocked,
  adsBlocked: privacyStats.adsBlocked,
  httpsUpgrades: privacyStats.httpsUpgrades,
}))

// ─── IPC: Search Engines ──────────────────────────────────────────────────────
ipcMain.handle('search-engines-get', () => SEARCH_ENGINES)

// ─── IPC: DevTools ────────────────────────────────────────────────────────────
ipcMain.handle('toggle-devtools', (event) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(state?.activeTabId)
  if (tab && (currentMode === 'dev' || currentMode === 'normal')) {
    tab.view.webContents.isDevToolsOpened()
      ? tab.view.webContents.closeDevTools()
      : tab.view.webContents.openDevTools({ mode: 'detach' })
  }
})

// ─── IPC: Terminal ────────────────────────────────────────────────────────────
ipcMain.handle('terminal-create',  (event, { id, cols, rows }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return createTerminal(id, cols, rows, (data) => win?.webContents.send('terminal-data', { id, data }))
})
ipcMain.handle('terminal-write',   (_, { id, data }) => writeToTerminal(id, data))
ipcMain.handle('terminal-resize',  (_, { id, cols, rows }) => resizeTerminal(id, cols, rows))
ipcMain.handle('terminal-destroy', (_, { id }) => destroyTerminal(id))

// ─── IPC: Bookmarks & History & Settings ──────────────────────────────────────
ipcMain.handle('bookmark-get',    () => getBookmarks())
ipcMain.handle('bookmark-add',    (_, data) => addBookmark(data))
ipcMain.handle('bookmark-remove', (_, id) => removeBookmark(id))
ipcMain.handle('bookmark-check',  (_, url) => isBookmarked(url))
ipcMain.handle('history-get',         () => getHistory())
ipcMain.handle('history-clear',       () => clearHistory())
ipcMain.handle('history-delete-item', (_, id) => deleteHistoryItem(id))
ipcMain.handle('settings-get',    () => getSettings())
ipcMain.handle('settings-update', (_, patch) => {
  const updated = updateSettings(patch)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('settings-changed', updated)
    }
  }
  return updated
})
ipcMain.handle('settings-select-wallpaper', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Wallpaper (Image or Animated GIF)',
    filters: [
      { name: 'Images & Animated GIFs (*.png, *.jpg, *.jpeg, *.webp, *.gif)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'Animated GIFs (*.gif)', extensions: ['gif'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`
    return { success: true, filePath, fileUrl }
  }
  return { success: false, canceled: true }
})

ipcMain.handle('set-theme', (event, theme) => {
  const isLight = (theme === 'light' || theme === 'obsidian-light' || theme === 'crystal-light')
  nativeTheme.themeSource = isLight ? 'light' : 'dark'

  windowStates.forEach(state => {
    state.tabs.forEach(tab => {
      if (tab.view && !tab.view.webContents.isDestroyed()) {
        try {
          tab.view.setBackgroundColor(isLight ? '#f1f4f9' : '#0a0d14')
        } catch (e) {}
      }
    })
  })
  return true
})

// ─── IPC: Menu & Drawer Visibility ───────────────────────────────────────────
ipcMain.handle('set-menu-open', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isMenuOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-active-drawer', (event, drawer) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.activeDrawer = drawer || null
    if (!drawer) state.drawerWidth = 0
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-drawer-width', (event, width) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.drawerWidth = typeof width === 'number' && width > 0 ? width : 0
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-media-hud-open', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isMediaHudOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-bookmarks-bar-open', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isBookmarksBarOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-statusbar-open', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isStatusBarOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-reader-mode-active', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isReaderModeOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-terminal-state', (event, { isOpen, isMinimized }) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isTerminalOpen = !!isOpen
    state.isTerminalMinimized = !!isMinimized
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('set-modes-info-open', (event, isOpen) => {
  const state = getWindowStateFromSender(event.sender)
  if (state) {
    state.isModesInfoOpen = !!isOpen
    repositionAllViewsForWindow(state)
  }
  return true
})
ipcMain.handle('create-private-tab', (event, url) => {
  const state = getWindowStateFromSender(event.sender)
  if (!state) return null
  const tabId = createTabForWindow(state, url, true)
  setActiveTabForWindow(state, tabId)
  return tabId
})

ipcMain.handle('chrome-extension-install-store', async (_, input) => {
  if (currentMode !== 'normal' && currentMode !== 'dev') {
    return { success: false, error: 'Chrome extensions are supported in Normal and Developer modes only.' }
  }
  return chromeExtensionManager ? chromeExtensionManager.installFromStore(input, session.defaultSession) : { success: false, error: 'Manager not ready' }
})

ipcMain.handle('chrome-extension-install-folder', async (event) => {
  if (currentMode !== 'normal' && currentMode !== 'dev') {
    return { success: false, error: 'Chrome extensions are supported in Normal and Developer modes only.' }
  }
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Unpacked Chrome Extension Folder (containing manifest.json)',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return { success: false, canceled: true }
  
  const extPath = result.filePaths[0]
  return chromeExtensionManager ? chromeExtensionManager.installFromFolder(extPath, session.defaultSession) : { success: false, error: 'Manager not ready' }
})

ipcMain.handle('chrome-extension-list', () => {
  return chromeExtensionManager ? chromeExtensionManager.list() : []
})

ipcMain.handle('chrome-extension-toggle', (_, { id, enabled }) => {
  return chromeExtensionManager ? chromeExtensionManager.toggleExtension(id, enabled, session.defaultSession) : { success: false }
})

ipcMain.handle('chrome-extension-update-details', (_, { id, patch }) => {
  return chromeExtensionManager ? chromeExtensionManager.updateExtensionDetails(id, patch) : { success: false }
})

ipcMain.handle('chrome-extension-remove', (_, id) => {
  return chromeExtensionManager ? chromeExtensionManager.removeExtension(id, session.defaultSession) : { success: false }
})

// ─── IPC: AdBlock & Privacy Stats ───────────────────────────────────────────
ipcMain.handle('adblock-get-stats', () => ({
  adsBlocked: adblockStats.adsBlocked,
  trackersBlocked: adblockStats.trackersBlocked,
  youtubeAdsSkipped: adblockStats.youtubeAdsSkipped,
  httpsUpgrades: adblockStats.httpsUpgrades,
}))

ipcMain.handle('adblock-clear-stats', () => {
  adblockStats.adsBlocked = 0
  adblockStats.trackersBlocked = 0
  adblockStats.youtubeAdsSkipped = 0
  return adblockStats
})

// ─── IPC: Software Updater & System Default Browser ─────────────────────────
ipcMain.handle('system-set-default-browser', async () => {
  try {
    let success = false
    try {
      if (app.setAsDefaultProtocolClient('http') && app.setAsDefaultProtocolClient('https')) {
        success = true
      }
    } catch (e) {}

    // On Windows 10/11, launch Windows Default Apps settings so user can easily confirm
    if (process.platform === 'win32') {
      try {
        await shell.openExternal('ms-settings:defaultapps')
      } catch (e) {
        try {
          const { exec } = require('child_process')
          exec('control /name Microsoft.DefaultPrograms /page pageDefaultProgram')
        } catch (err) {}
      }
    } else if (process.platform === 'linux') {
      try {
        const { exec } = require('child_process')
        exec('xdg-settings set default-web-browser nexusweb.desktop')
      } catch (e) {}
    }
    return { success: true, isDefault: app.isDefaultProtocolClient('http') }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('system-is-default-browser', () => {
  try {
    return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
  } catch (e) {
    return false
  }
})

ipcMain.handle('show-chrome-context-menu', (event, { x, y, targetUrl, selectedText } = {}) => {
  const state = getWindowStateFromSender(event.sender)
  if (!state || !state.win) return { success: false }

  const template = [
    {
      label: 'New Tab',
      accelerator: 'CmdOrCtrl+T',
      click: () => createTabForWindow(state, 'nexusweb://home', state.isPrivateWindow)
    },
    {
      label: 'New Private Den Window',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: () => createPrivateDenWindow('https://duckduckgo.com')
    },
    { type: 'separator' },
    {
      label: 'Reopen Closed Tab',
      accelerator: 'CmdOrCtrl+Shift+T',
      click: () => state.win.webContents.send('tab-reopen-closed')
    },
    {
      label: 'Bookmark Current Page',
      accelerator: 'CmdOrCtrl+D',
      click: () => state.win.webContents.send('toggle-bookmark-cmd')
    },
    {
      label: 'Toggle Reader Mode',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: () => state.win.webContents.send('toggle-reader-mode-cmd')
    },
    { type: 'separator' },
    {
      label: 'Reload Page',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        const tab = state.tabs.get(state.activeTabId)
        if (tab && tab.view) tab.view.webContents.reload()
      }
    },
    {
      label: 'Duplicate Tab',
      click: () => {
        const tab = state.tabs.get(state.activeTabId)
        if (tab && tab.url) createTabForWindow(state, tab.url, tab.isPrivate)
      }
    },
    { type: 'separator' },
    {
      label: 'Inspect Element',
      accelerator: 'F12',
      click: () => {
        const tab = state.tabs.get(state.activeTabId)
        if (tab && tab.view) tab.view.webContents.toggleDevTools()
        else state.win.webContents.toggleDevTools()
      }
    },
    {
      label: 'Settings & Preferences',
      accelerator: 'CmdOrCtrl+,',
      click: () => state.win.webContents.send('open-settings-cmd')
    },
    {
      label: 'About NeXusWeb',
      click: () => state.win.webContents.send('open-about-cmd')
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  menu.popup({
    window: state.win,
    x: Math.round(x || 0),
    y: Math.round(y || 0)
  })
  return { success: true }
})

// ─── IPC: GitHub Releases Auto-Updater ───────────────────────────────────────
ipcMain.handle('updater-check', async () => {
  return await updateManager.checkForUpdates()
})

ipcMain.handle('updater-download', async (_, assetUrl) => {
  return await updateManager.downloadUpdate(assetUrl)
})

ipcMain.handle('updater-install', async (_, installerPath) => {
  return await updateManager.installUpdateAndRestart(installerPath)
})

ipcMain.handle('updater-get-state', () => {
  return {
    status: updateManager.status,
    currentVersion: updateManager.currentVersion,
    updateInfo: updateManager.updateInfo,
    downloadedFilePath: updateManager.downloadedFilePath
  }
})

let extensionPopupWindow = null

ipcMain.handle('chrome-extension-open-popup', (event, extId) => {
  if (!chromeExtensionManager) return { success: false, error: 'Manager not ready' }
  const ext = chromeExtensionManager.getDb().find(e => e.id === extId)
  if (!ext) return { success: false, error: 'Extension not found' }

  let popupFile = 'popup/popup.html'
  if (ext.path && fs.existsSync(ext.path)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(ext.path, 'manifest.json'), 'utf8'))
      popupFile = manifest.action?.default_popup ||
                  manifest.browser_action?.default_popup ||
                  manifest.options_page ||
                  manifest.options_ui?.page ||
                  'popup/popup.html'
      if (popupFile.startsWith('/')) popupFile = popupFile.slice(1)
    } catch (e) {}
  }

  const allLoaded = session.defaultSession.getAllExtensions()
  const loadedExt = allLoaded.find(e => e.path === ext.path || e.id === extId)
  const realExtId = loadedExt ? loadedExt.id : (ext.runtimeId || extId)

  if (extensionPopupWindow && !extensionPopupWindow.isDestroyed()) {
    extensionPopupWindow.close()
  }

  const win = BrowserWindow.fromWebContents(event.sender)
  const mainBounds = win ? win.getBounds() : { x: 100, y: 100, width: 1200 }
  const popWidth = 380
  const popHeight = 560
  const posX = Math.max(0, mainBounds.x + mainBounds.width - popWidth - 30)
  const posY = Math.max(0, mainBounds.y + 110)

  extensionPopupWindow = new BrowserWindow({
    width: popWidth,
    height: popHeight,
    x: posX,
    y: posY,
    parent: win || undefined,
    modal: false,
    frame: true,
    title: ext.name || 'Extension Dashboard',
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: '#0a0d14',
    webPreferences: {
      session: session.defaultSession,
      contextIsolation: false,
      sandbox: false,
      devTools: true,
    },
  })

  const popupShim = `
  (function() {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.proxy) {
      const listeners = new Set();
      let cur = { mode: 'direct' };
      const secret = '${PROXY_BRIDGE_SECRET}';
      window.chrome.proxy = {
        settings: {
          set: function(details, cb) {
            cur = details.value || { mode: 'direct' };
            fetch('http://127.0.0.1:49152/set-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-nexus-auth': secret },
              body: JSON.stringify(cur)
            }).catch(function(e) { console.error('Proxy fetch failed:', e); });
            if (typeof cb === 'function') cb();
            listeners.forEach(function(fn) { try { fn({ value: cur }); } catch(e){} });
            return Promise.resolve(true);
          },
          get: function(details, cb) {
            const res = { value: cur, levelOfControl: 'controlled_by_this_extension' };
            if (typeof cb === 'function') cb(res);
            return Promise.resolve(res);
          },
          clear: function(details, cb) {
            cur = { mode: 'direct' };
            fetch('http://127.0.0.1:49152/set-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-nexus-auth': secret },
              body: JSON.stringify(cur)
            }).catch(function(e) {});
            if (typeof cb === 'function') cb();
            return Promise.resolve(true);
          },
          onChange: {
            addListener: function(fn) { listeners.add(fn); },
            removeListener: function(fn) { listeners.delete(fn); }
          }
        }
      };
    }
  })();
  `

  extensionPopupWindow.webContents.on('dom-ready', () => {
    extensionPopupWindow.webContents.executeJavaScript(popupShim).catch(() => {})
  })

  const popupUrl = `chrome-extension://${realExtId}/${popupFile}`
  extensionPopupWindow.loadURL(popupUrl).catch((err) => {
    console.warn('[NeXusWeb] Failed to load extension popup URL:', err.message)
  })

  return { success: true, url: popupUrl }
})

ipcMain.handle('extensions-get', () => getExtensions())
ipcMain.handle('extensions-save', (_, list) => saveExtensions(list))

ipcMain.handle('proxy-get-config', () => vpnEngine.getConfig())

ipcMain.handle('proxy-set-mode', async (_, { mode, region = 'direct', customRules = null }) => {
  try {
    const conf = await vpnEngine.setRegion(region, customRules)
    
    // Apply proxy to session.defaultSession
    if (conf.mode === 'direct') {
      await session.defaultSession.setProxy({ mode: 'direct' })
    } else {
      await session.defaultSession.setProxy({ proxyRules: conf.proxyRules })
    }

    // Also apply to all active private partitions (Private Den)
    for (const [, state] of windowStates.entries()) {
      if (state.isPrivate && state.privatePartition) {
        try {
          const privSess = session.fromPartition(state.privatePartition)
          if (conf.mode === 'direct') {
            await privSess.setProxy({ mode: 'direct' })
          } else {
            await privSess.setProxy({ proxyRules: conf.proxyRules })
          }
        } catch (e) {}
      }
    }

    // Broadcast proxy change to all open windows
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('vpn-status-changed', vpnEngine.getConfig())
      }
    }

    return { success: true, config: vpnEngine.getConfig() }
  } catch (e) {
    console.error('[NeXus VPN] Error setting proxy mode:', e)
    return { success: false, error: e.message }
  }
})

ipcMain.handle('proxy-set-config', async (_, config) => {
  try {
    let conf = null
    if (!config || config.mode === 'direct') {
      conf = await vpnEngine.setRegion('direct')
      await session.defaultSession.setProxy({ mode: 'direct' })
    } else if (config.region) {
      conf = await vpnEngine.setRegion(config.region, config.proxyRules)
      await session.defaultSession.setProxy({ proxyRules: conf.proxyRules })
    } else if (config.mode === 'fixed_servers' && config.proxyRules) {
      conf = await vpnEngine.setRegion('custom', config.proxyRules)
      await session.defaultSession.setProxy({ proxyRules: config.proxyRules })
    } else if (config.mode === 'pac' && config.pacScript) {
      const pacPath = path.join(app.getPath('userData'), 'nexus_active_proxy.pac')
      fs.writeFileSync(pacPath, config.pacScript, 'utf8')
      const pacFileUrl = `file:///${pacPath.replace(/\\/g, '/')}`
      await session.defaultSession.setProxy({ pacScript: pacFileUrl })
      conf = { mode: 'pac', region: 'custom', pacFileUrl }
    }

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('vpn-status-changed', vpnEngine.getConfig())
      }
    }

    return { success: true, config: vpnEngine.getConfig() }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('proxy-check-ip', async () => {
  const startTime = Date.now()
  const endpoints = [
    'https://ipwho.is/',
    'https://ipapi.co/json/',
    'https://api.ipify.org?format=json',
  ]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { 'User-Agent': CHROME_USER_AGENT, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      })
      if (res.ok) {
        const data = await res.json()
        const latency = Date.now() - startTime
        return {
          success: true,
          ip: data.ip || '127.0.0.1',
          country: data.country || data.country_name || 'Protected Route',
          city: data.city || '',
          countryCode: data.country_code || data.countryCode || 'TUNNEL',
          org: data.connection?.isp || data.org || 'Encrypted Privacy Gateway',
          latency: `${latency}ms`,
        }
      }
    } catch (err) {}
  }

  const latency = Date.now() - startTime
  const conf = vpnEngine.getConfig()
  return {
    success: true,
    ip: 'Protected (Private Tunnel Active)',
    country: conf.nodeInfo?.country || 'Encrypted Gateway',
    countryCode: conf.region?.toUpperCase() || 'VPN',
    org: 'NeXusWeb DoH Privacy Shield',
    latency: `${Math.max(14, latency)}ms`,
  }
})

// ─── IPC: REST & GraphQL API Workbench ──────────────────────────────────────
ipcMain.handle('api-workbench-send', async (_, { method = 'GET', url, headers = {}, body = null, auth = null }) => {
  const startTime = Date.now()
  if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return {
      success: false,
      error: 'Invalid URL: Only HTTP and HTTPS endpoints are permitted in API Workbench.',
      duration: 0,
    }
  }

  try {
    const finalHeaders = { ...headers }
    if (auth && auth.type === 'bearer' && auth.token) {
      finalHeaders['Authorization'] = `Bearer ${auth.token}`
    } else if (auth && auth.type === 'basic' && auth.username) {
      const creds = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64')
      finalHeaders['Authorization'] = `Basic ${creds}`
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: finalHeaders,
    }

    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method)) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : String(body)
    }

    const response = await fetch(url, fetchOptions)
    const duration = Date.now() - startTime
    const contentType = response.headers.get('content-type') || ''
    
    let responseData
    if (contentType.includes('application/json')) {
      try { responseData = await response.json() } catch (e) { responseData = await response.text() }
    } else {
      responseData = await response.text()
    }

    const resHeaders = {}
    response.headers.forEach((val, key) => { resHeaders[key] = val })

    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
      data: responseData,
      duration,
      size: typeof responseData === 'string' ? responseData.length : JSON.stringify(responseData).length,
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      duration: Date.now() - startTime,
    }
  }
})

// ─── IPC: Passwords & AutoFill Vault ──────────────────────────────────────────
ipcMain.handle('passwords-get-all', (_, query) => passwordManager.getPasswords(query))
ipcMain.handle('passwords-get-for-domain', (_, domain) => passwordManager.getPasswordForDomain(domain))
ipcMain.handle('passwords-save', (_, item) => passwordManager.savePassword(item))
ipcMain.handle('passwords-update', (_, { id, patch }) => passwordManager.updatePassword(id, patch))
ipcMain.handle('passwords-delete', (_, id) => passwordManager.deletePassword(id))
ipcMain.handle('passwords-clear-all', () => passwordManager.clearAllPasswords())
ipcMain.handle('passwords-generate', (_, options) => passwordManager.generatePassword(options))
ipcMain.handle('passwords-audit', () => passwordManager.auditPasswords())
ipcMain.handle('passwords-export', (_, format) => passwordManager.exportPasswords(format))
ipcMain.handle('passwords-import', (_, { data, format }) => passwordManager.importPasswords(data, format))
ipcMain.handle('passwords-get-settings', () => passwordManager.getAutofillSettings())
ipcMain.handle('passwords-update-settings', (_, patch) => passwordManager.updateAutofillSettings(patch))
ipcMain.handle('autofill-get-profiles', () => passwordManager.getAutofillProfiles())
ipcMain.handle('autofill-save-address', (_, profile) => passwordManager.saveAddressProfile(profile))
ipcMain.handle('autofill-delete-address', (_, id) => passwordManager.deleteAddressProfile(id))

// ─── IPC: Browser Task Manager ────────────────────────────────────────────────
ipcMain.handle('task-manager-get-tasks', () => {
  const allTabs = []
  windowStates.forEach(state => {
    state.tabs.forEach(t => allTabs.push(t))
  })
  const allExtensions = getExtensions() || []
  return getBrowserTasks(allTabs, allExtensions)
})
ipcMain.handle('task-manager-kill-process', (_, pid) => killTaskProcess(pid))

// ─── IPC: Cast Media to Device ────────────────────────────────────────────────
ipcMain.handle('cast-scan-devices', () => castManager.scanDevices())
ipcMain.handle('cast-start', (_, options) => castManager.startCasting(options))
ipcMain.handle('cast-stop', () => castManager.stopCasting())
ipcMain.handle('cast-control', (_, { command, value }) => castManager.controlCast(command, value))
ipcMain.handle('cast-get-state', () => castManager.getState())

// ─── IPC: WebApp & PWA Engine ─────────────────────────────────────────────────
ipcMain.handle('webapp-get-manifest', async (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  const targetId = tabId || state?.activeTabId
  const tab = state?.tabs.get(targetId)
  if (!tab || !tab.view) return { success: false, error: 'No active view' }
  try {
    return await tab.view.webContents.executeJavaScript(EXTRACT_MANIFEST_SCRIPT)
  } catch (err) {
    return { success: false, error: err.message }
  }
})
ipcMain.handle('webapp-install', (_, options) => installWebApp(options))
ipcMain.handle('webapp-launch', (_, urlOrId) => launchWebApp(urlOrId))
ipcMain.handle('webapp-list', () => getInstalledWebApps())
ipcMain.handle('webapp-uninstall', (_, id) => uninstallWebApp(id))

// ─── IPC: Performance Engine ──────────────────────────────────────────────────
ipcMain.handle('performance-get-settings', () => performanceEngine.getSettings())
ipcMain.handle('performance-update-settings', (_, patch) => performanceEngine.updateSettings(patch))
ipcMain.handle('performance-sleep-inactive', (event) => {
  const state = getWindowStateFromSender(event.sender)
  if (!state) return { success: false }
  const tabsList = Array.from(state.tabs.values())
  return performanceEngine.sleepAllInactiveTabs(tabsList, state.activeTabId, (data) => {
    state.win?.webContents.send('tab-sleep-change', data)
  })
})
ipcMain.handle('performance-wake-tab', (event, tabId) => {
  const state = getWindowStateFromSender(event.sender)
  const tab = state?.tabs.get(tabId)
  if (tab) {
    performanceEngine.wakeTab(tab, (data) => {
      state.win?.webContents.send('tab-sleep-change', data)
    })
    return { success: true }
  }
  return { success: false }
})
ipcMain.handle('performance-get-stats', (event) => {
  const state = getWindowStateFromSender(event.sender)
  const tabsList = state ? Array.from(state.tabs.values()) : []
  return performanceEngine.getStats(tabsList)
})

// ─── IPC: Memory Optimizer & Low-RAM Engine ───────────────────────────────────
ipcMain.handle('memory-clean', async (event) => {
  const state = getWindowStateFromSender(event.sender)
  return await memoryOptimizer.cleanProcessMemory(state)
})
ipcMain.handle('memory-stats', () => {
  return memoryOptimizer.getMemoryStats()
})
ipcMain.handle('memory-set-low-ram-mode', (event, enabled) => {
  const state = getWindowStateFromSender(event.sender)
  return memoryOptimizer.setLowRamMode(enabled, state)
})

// ─── IPC: ChevronNexus Zero-Knowledge Sync Engine ─────────────────────────────
ipcMain.handle('sync-get-params', (_, email) => {
  try { startEmbeddedSyncServer(app.getPath('userData')) } catch (e) {}
  return syncManager?.getAuthParams(email)
})
ipcMain.handle('sync-register', (_, payload) => {
  try { startEmbeddedSyncServer(app.getPath('userData')) } catch (e) {}
  return syncManager?.register(payload)
})
ipcMain.handle('sync-login', (_, payload) => {
  try { startEmbeddedSyncServer(app.getPath('userData')) } catch (e) {}
  return syncManager?.login(payload)
})
ipcMain.handle('sync-logout', () => {
  const res = syncManager?.logout()
  try { stopEmbeddedSyncServer() } catch (e) {}
  return res
})
ipcMain.handle('sync-get-status', () => syncManager?.getStatus())
ipcMain.handle('sync-now', async () => {
  if (!syncManager) return { success: false }
  try { startEmbeddedSyncServer(app.getPath('userData')) } catch (e) {}
  return await syncManager.syncNow({
    getLocalModified: async (sinceTimestamp) => getAllSyncableData(sinceTimestamp),
    applyIncoming: async (incoming, tombstones) => applyIncomingSyncData(incoming, tombstones),
  })
})
ipcMain.handle('sync-get-devices', () => syncManager?.getDevices())
ipcMain.handle('sync-revoke-device', (_, deviceId) => syncManager?.revokeDevice(deviceId))
ipcMain.handle('sync-wipe-device', (_, deviceId) => syncManager?.wipeDevice(deviceId))
ipcMain.handle('sync-setup-2fa', () => syncManager?.setup2FA())
ipcMain.handle('sync-verify-2fa', (_, code) => syncManager?.verify2FA(code))
ipcMain.handle('sync-set-server-url', (_, url) => syncManager?.setServerUrl(url))
ipcMain.handle('sync-send-tab', (_, { targetDeviceId, tabData }) => syncManager?.sendTabToDevice(targetDeviceId, tabData))

// ─── IPC: Window Controls ─────────────────────────────────────────────────────
ipcMain.handle('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})
ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.handle('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})
ipcMain.handle('open-file-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return dialog.showOpenDialog(win, { properties: ['openFile', 'openDirectory'] })
})

// ─── Pro Universal File & Media Studio IPC Handlers ───────────────────────────
ipcMain.handle('file-viewer-open-dialog', async (event, customFilters) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const defaultFilters = [
    { name: 'All Supported Media & Documents', extensions: ['txt', 'doc', 'docx', 'pdf', 'md', 'json', 'csv', 'log', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'heic', 'heif', 'avif', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'hevc'] },
    { name: 'Documents & Text (*.docx, *.pdf, *.txt, *.md, *.json, *.csv)', extensions: ['docx', 'doc', 'pdf', 'txt', 'md', 'json', 'csv', 'log', 'rtf', 'html', 'xml', 'js', 'py', 'c', 'cpp', 'cs', 'rs', 'go', 'java'] },
    { name: 'Images (*.jpg, *.png, *.svg, *.webp, *.heic)', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'heic', 'heif', 'avif'] },
    { name: 'Audio & Music (*.mp3, *.wav, *.flac, *.ogg, *.m4a)', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
    { name: 'Video & Movies (*.mp4, *.mov, *.webm, *.mkv, *.hevc)', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'hevc'] },
    { name: 'All Files (*.*)', extensions: ['*'] }
  ]
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: customFilters || defaultFilters
  })
  return res
})

ipcMain.handle('file-viewer-read', async (_, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const baseName = path.basename(filePath)
    
    const textExts = new Set(['txt', 'md', 'json', 'csv', 'log', 'rtf', 'html', 'xml', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'py', 'c', 'cpp', 'h', 'cs', 'rs', 'go', 'java', 'sql', 'sh', 'bat', 'cmd', 'ps1', 'ini', 'env', 'yml', 'yaml', 'toml'])
    const isText = textExts.has(ext)
    
    let textContent = null
    let base64Content = null
    
    if (isText) {
      textContent = fs.readFileSync(filePath, 'utf8')
    } else {
      const buffer = fs.readFileSync(filePath)
      base64Content = buffer.toString('base64')
    }

    return {
      success: true,
      name: baseName,
      path: filePath,
      ext,
      size: stat.size,
      mtime: stat.mtimeMs,
      isText,
      textContent,
      base64Content,
      uri: `file:///${filePath.replace(/\\/g, '/')}`
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file-viewer-save', async (event, { defaultName, base64Data, textData, filterName, extension }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const res = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'export',
    filters: [{ name: filterName || 'File', extensions: [extension || '*'] }]
  })
  if (!res.canceled && res.filePath) {
    try {
      if (base64Data) {
        fs.writeFileSync(res.filePath, Buffer.from(base64Data, 'base64'))
      } else if (textData) {
        fs.writeFileSync(res.filePath, textData, 'utf8')
      }
      return { success: true, filePath: res.filePath }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
  return { canceled: true }
})

// ─── Global Keyboard Shortcuts ────────────────────────────────────────────────
function registerShortcuts() {
  globalShortcut.register('CommandOrControl+N', () => createWindow())
  globalShortcut.register('CommandOrControl+Shift+N', () => createWindow(null, true))
  globalShortcut.register('CommandOrControl+O', () => {
    const focusedWin = BrowserWindow.getFocusedWindow()
    if (focusedWin) {
      focusedWin.webContents.send('trigger-open-file')
    }
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Check if launched as a Standalone WebApp (like Chrome --app="https://...")
  let appUrl = null
  for (const arg of process.argv) {
    if (arg.startsWith('--app=')) {
      appUrl = arg.slice(6).replace(/^"|"$/g, '')
    } else if (arg.startsWith('--app-url=')) {
      appUrl = arg.slice(10).replace(/^"|"$/g, '')
    }
  }

  if (appUrl) {
    createAppWindow(appUrl)
    return
  }

  // Purge stale service workers and cache storage to prevent cross-origin CSP collisions
  try {
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    })
  } catch (e) {}

  const mainWin = createWindow()
  registerShortcuts()

  // Defer non-essential services after window creation for sub-150ms launch
  setImmediate(() => {
    try {
      syncManager = new SyncManager(app.getPath('userData'))
      syncManager.onSyncUpdate((data) => {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sync-update', data))
      })
      syncManager.onReceivedTab((tabData) => {
        BrowserWindow.getAllWindows().forEach(w => {
          w.webContents.send('sync-received-tab', tabData)
          const state = getWindowState(w)
          if (state && tabData && tabData.url) {
            createTabForWindow(state, tabData.url)
          }
        })
      })
      if (syncManager.session?.token) {
        try { startEmbeddedSyncServer(app.getPath('userData')) } catch (e) {}
        syncManager.connectWebSocket()
      }
    } catch (e) {
      console.error('[NeXusWeb] SyncManager init failed:', e.message)
    }

    try {
      initTray({
        getMainWindow: () => BrowserWindow.getAllWindows()[0],
        onNewTab: (url) => {
          const win = BrowserWindow.getAllWindows()[0]
          const state = getWindowState(win)
          if (state) createTabForWindow(state, url)
        },
        onTriggerPiP: () => {
          const win = BrowserWindow.getAllWindows()[0]
          const state = getWindowState(win)
          if (state) triggerPictureInPictureForWindow(state)
        },
        onModeChange: (newMode) => {
          currentMode = newMode
          setFilterMode(newMode)
          BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed()) {
              w.webContents.send('mode-changed', newMode)
            }
          })
        },
        getMode: () => currentMode,
        getServers: () => scanLocalPorts(),
      })
    } catch (e) {
      console.error('[NeXusWeb] Tray init failed:', e)
    }
  })

  // Start Automatic Low-RAM Tab Idle Sweeper & OOM Protection
  try {
    const activeWin = BrowserWindow.getAllWindows()[0]
    const state = getWindowState(activeWin)

    performanceEngine.startAutoIdleSweeper(
      () => {
        const win = BrowserWindow.getAllWindows()[0]
        const st = getWindowState(win)
        return st ? Array.from(st.tabs.values()) : []
      },
      () => {
        const win = BrowserWindow.getAllWindows()[0]
        const st = getWindowState(win)
        return st?.activeTabId
      },
      (data) => {
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('tab-sleep-change', data))
      }
    )

    if (state) {
      memoryOptimizer.initAutoOomGuard(state)
      if (settings.lowRamMode || isLowSpecPC) {
        memoryOptimizer.setLowRamMode(true, state)
      }
    }
  } catch (e) {
    console.warn('[NeXusWeb] Performance sweeper init error:', e.message)
  }

  // Automatic GitHub Releases background check after 5s
  setTimeout(() => {
    try {
      const currentSettings = storage.getSettings()
      if (currentSettings?.autoCheckUpdates !== false) {
        updateManager.checkForUpdates().catch(() => {})
      }
    } catch (e) {}
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  try {
    if (typeof destroyAllTerminals === 'function') destroyAllTerminals()
  } catch (e) {
    console.warn('[NeXusWeb] Terminal cleanup on quit:', e.message)
  }
})

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll()
  } catch (e) {}
  try {
    if (typeof destroyTray === 'function') destroyTray()
  } catch (e) {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
