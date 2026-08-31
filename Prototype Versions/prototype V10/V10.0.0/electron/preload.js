const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nexus', {
  // ── Tab Management ──────────────────────────────────────────────────────────
  createTab:        (url)   => ipcRenderer.invoke('create-tab', url),
  closeTab:         (tabId) => ipcRenderer.invoke('close-tab', tabId),
  switchTab:        (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  reopenClosedTab:  ()      => ipcRenderer.invoke('reopen-closed-tab'),
  getTabs:          ()      => ipcRenderer.invoke('get-tabs'),
  getActiveTab:     ()      => ipcRenderer.invoke('get-active-tab'),

  // ── Navigation ──────────────────────────────────────────────────────────────
  navigate:   (url, tabId) => ipcRenderer.invoke('navigate', { url, tabId }),
  goBack:     ()           => ipcRenderer.invoke('go-back'),
  goForward:  ()           => ipcRenderer.invoke('go-forward'),
  reload:     ()           => ipcRenderer.invoke('reload'),

  // ── Split View ──────────────────────────────────────────────────────────────
  splitView: {
    toggle:   (enabled) => ipcRenderer.invoke('split-view-toggle', enabled),
    setTab:   (tabId)   => ipcRenderer.invoke('split-view-set-tab', tabId),
    setRatio: (ratio)   => ipcRenderer.invoke('split-view-set-ratio', ratio),
    getRatio: ()        => ipcRenderer.invoke('split-view-get-ratio'),
    getState: ()        => ipcRenderer.invoke('split-view-get-state'),
    onChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('split-view-changed', handler)
      return () => ipcRenderer.removeListener('split-view-changed', handler)
    },
  },

  // ── Find in Page ────────────────────────────────────────────────────────────
  findInPage: {
    start:  (text, forward, findNext) => ipcRenderer.invoke('find-in-page', { text, forward, findNext }),
    stop:   (action)                  => ipcRenderer.invoke('stop-find-in-page', action),
    onResult: (cb) => {
      const handler = (_, res) => cb(res)
      ipcRenderer.on('find-result', handler)
      return () => ipcRenderer.removeListener('find-result', handler)
    },
    offResult: () => ipcRenderer.removeAllListeners('find-result'),
  },

  // ── Page Screenshot ─────────────────────────────────────────────────────────
  capturePage: () => ipcRenderer.invoke('capture-page'),
  onScreenshotCaptured: (cb) => {
    const handler = (_, res) => cb(res)
    ipcRenderer.on('screenshot-captured', handler)
    return () => ipcRenderer.removeListener('screenshot-captured', handler)
  },

  // ── Media & Picture-in-Picture ──────────────────────────────────────────────
  media: {
    triggerPiP: (tabId)             => ipcRenderer.invoke('media-pip', tabId),
    control:    (tabId, command)    => ipcRenderer.invoke('media-control', { tabId, command }),
    hudControl: (tabId, command, value) => ipcRenderer.invoke('media-hud-control', { tabId, command, value }),
    muteTab:    (tabId, mute)       => ipcRenderer.invoke('media-mute-tab', { tabId, mute }),
    onPiPTriggered: (cb) => {
      const handler = (_, res) => cb(res)
      ipcRenderer.on('pip-triggered', handler)
      return () => ipcRenderer.removeListener('pip-triggered', handler)
    },
    onAudioChanged: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-audio-changed', handler)
      return () => ipcRenderer.removeListener('tab-audio-changed', handler)
    },
    onFullscreenChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('html-fullscreen-change', handler)
      return () => ipcRenderer.removeListener('html-fullscreen-change', handler)
    },
  },

  // ── Safari-Style Custom Video Player Engine ─────────────────────────────────
  videoPlayer: {
    control: (command, payload, tabId) => ipcRenderer.invoke('video-control', { command, payload, tabId }),
    getState: (tabId)                  => ipcRenderer.invoke('video-get-state', tabId),
    onFullscreenChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('html-fullscreen-change', handler)
      return () => ipcRenderer.removeListener('html-fullscreen-change', handler)
    },
  },

  // ── Request Inspector (Network Logger) ──────────────────────────────────────
  inspector: {
    getLogs:   (tabId) => ipcRenderer.invoke('inspector-get-logs', tabId),
    clearLogs: (tabId) => ipcRenderer.invoke('inspector-clear-logs', tabId),
  },

  // ── Environment Variables (.env Reader) ─────────────────────────────────────
  env: {
    getFiles: (dir)      => ipcRenderer.invoke('env-get-files', dir),
    readFile: (filePath) => ipcRenderer.invoke('env-read-file', filePath),
  },

  // ── Reader Mode (Distraction-Free Reader) ────────────────────────────────────
  readerMode: {
    extract: (tabId) => ipcRenderer.invoke('reader-mode-extract', tabId),
  },

  // ── Privacy & Security Shield ───────────────────────────────────────────────
  privacy: {
    getStats: () => ipcRenderer.invoke('privacy-stats-get'),
    onEvent: (cb) => {
      const handler = (_, ev) => cb(ev)
      ipcRenderer.on('privacy-event', handler)
      return () => ipcRenderer.removeListener('privacy-event', handler)
    },
  },

  // ── Search Engines ──────────────────────────────────────────────────────────
  searchEngines: {
    getList: () => ipcRenderer.invoke('search-engines-get'),
  },

  // ── Menu & Drawer Visibility ────────────────────────────────────────────────
  setMenuOpen:     (isOpen) => ipcRenderer.invoke('set-menu-open', isOpen),
  setActiveDrawer: (drawer) => ipcRenderer.invoke('set-active-drawer', drawer),
  setMediaHudOpen: (isOpen) => ipcRenderer.invoke('set-media-hud-open', isOpen),
  setTheme:        (theme)  => ipcRenderer.invoke('set-theme', theme),

  // ── Zoom Controls ───────────────────────────────────────────────────────────
  zoom: {
    set:      (factor, tabId) => ipcRenderer.invoke('zoom-set', { factor, tabId }),
    get:      (tabId)         => ipcRenderer.invoke('zoom-get', tabId),
    onChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('zoom-changed', handler)
      return () => ipcRenderer.removeListener('zoom-changed', handler)
    },
  },

  // ── Network Mode ────────────────────────────────────────────────────────────
  setMode: (mode) => ipcRenderer.invoke('set-mode', mode),
  getMode: ()     => ipcRenderer.invoke('get-mode'),

  // ── Port Scanner & Port Manager ─────────────────────────────────────────────
  scanPorts: () => ipcRenderer.invoke('scan-ports'),
  portManager: {
    getDetailedList: ()    => ipcRenderer.invoke('port-manager-get'),
    kill:            (pid) => ipcRenderer.invoke('port-manager-kill', pid),
    killProcess:     (pid) => ipcRenderer.invoke('port-manager-kill', pid),
  },

  // ── Download Manager ────────────────────────────────────────────────────────
  downloads: {
    get:          ()   => ipcRenderer.invoke('downloads-get'),
    addMultiPart: (data) => ipcRenderer.invoke('downloads-add-multipart', data),
    pause:        (id) => ipcRenderer.invoke('downloads-pause', id),
    resume:       (id) => ipcRenderer.invoke('downloads-resume', id),
    cancel:       (id) => ipcRenderer.invoke('downloads-cancel', id),
    remove:       (id) => ipcRenderer.invoke('downloads-remove', id),
    openFile:     (id) => ipcRenderer.invoke('downloads-open-file', id),
    showFolder:   (id) => ipcRenderer.invoke('downloads-show-folder', id),
    copyUrl:      (id) => ipcRenderer.invoke('downloads-copy-url', id),
    selectFolder: ()   => ipcRenderer.invoke('downloads-select-folder'),
    clear:        ()   => ipcRenderer.invoke('downloads-clear'),
    onUpdate:     (cb) => {
      const handler = (_, item) => cb(item)
      ipcRenderer.on('download-updated', handler)
      return () => ipcRenderer.removeListener('download-updated', handler)
    },
    offUpdate:    () => ipcRenderer.removeAllListeners('download-updated'),
    onIntercepted: (cb) => {
      const handler = (_, info) => cb(info)
      ipcRenderer.on('download-intercepted', handler)
      return () => ipcRenderer.removeListener('download-intercepted', handler)
    },
    resolveIntercepted: (data) => ipcRenderer.invoke('download-resolve-intercepted', data),
  },

  // ── ChevronNexus Lab Ecosystem ──────────────────────────────────────────────
  ecosystem: {
    getTelemetry:       ()     => ipcRenderer.invoke('ecosystem-get-telemetry'),
    getDiscoveredServers: ()   => ipcRenderer.invoke('ecosystem-get-servers'),
    sendServerDownload: (data) => ipcRenderer.invoke('ecosystem-server-download', data),
    launchAdminConsole: (port) => ipcRenderer.invoke('ecosystem-launch-admin', port),
    onServerDiscovered: (cb)   => {
      const handler = (_, server) => cb(server)
      ipcRenderer.on('ecosystem-server-discovered', handler)
      return () => ipcRenderer.removeListener('ecosystem-server-discovered', handler)
    },
  },

  // ── Dev Notes / Scratch Pad ─────────────────────────────────────────────────
  notes: {
    get:    (urlKey)          => ipcRenderer.invoke('notes-get', urlKey),
    save:   (urlKey, content) => ipcRenderer.invoke('notes-save', { urlKey, content }),
    getAll: ()                => ipcRenderer.invoke('notes-get-all'),
  },

  // ── DevTools ────────────────────────────────────────────────────────────────
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),

  // ── Multi-Terminal Session Support ──────────────────────────────────────────
  terminal: {
    create:  (id, cols, rows) => ipcRenderer.invoke('terminal-create', { id, cols, rows }),
    write:   (id, data)       => ipcRenderer.invoke('terminal-write', { id, data }),
    resize:  (id, cols, rows) => ipcRenderer.invoke('terminal-resize', { id, cols, rows }),
    destroy: (id)             => ipcRenderer.invoke('terminal-destroy', { id }),
    onData:  (cb) => {
      const handler = (_, payload) => cb(payload)
      ipcRenderer.on('terminal-data', handler)
      return () => ipcRenderer.removeListener('terminal-data', handler)
    },
    offData: () => ipcRenderer.removeAllListeners('terminal-data'),
  },

  // ── Bookmarks ────────────────────────────────────────────────────────────────
  bookmarks: {
    get:    ()        => ipcRenderer.invoke('bookmark-get'),
    add:    (data)    => ipcRenderer.invoke('bookmark-add', data),
    remove: (id)      => ipcRenderer.invoke('bookmark-remove', id),
    check:  (url)     => ipcRenderer.invoke('bookmark-check', url),
  },

  // ── History ──────────────────────────────────────────────────────────────────
  history: {
    get:        ()   => ipcRenderer.invoke('history-get'),
    clear:      ()   => ipcRenderer.invoke('history-clear'),
    deleteItem: (id) => ipcRenderer.invoke('history-delete-item', id),
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    get:               ()      => ipcRenderer.invoke('settings-get'),
    update:            (patch) => ipcRenderer.invoke('settings-update', patch),
    selectWallpaper:   ()      => ipcRenderer.invoke('settings-select-wallpaper'),
    onSettingsChanged: (cb) => {
      const handler = (_, s) => cb(s)
      ipcRenderer.on('settings-changed', handler)
      return () => ipcRenderer.removeListener('settings-changed', handler)
    },
  },

  // ── Window Controls ──────────────────────────────────────────────────────────
  window: {
    minimize:      () => ipcRenderer.invoke('window-minimize'),
    maximize:      () => ipcRenderer.invoke('window-maximize'),
    close:         () => ipcRenderer.invoke('window-close'),
    onStateChange: (cb) => {
      const handler = (_, state) => cb(state)
      ipcRenderer.on('window-state-change', handler)
      return () => ipcRenderer.removeListener('window-state-change', handler)
    },
  },

  // ── Event Listeners ─────────────────────────────────────────────────────────
  on: {
    tabCreated: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-created', handler)
      return () => ipcRenderer.removeListener('tab-created', handler)
    },
    tabUpdated: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-updated', handler)
      return () => ipcRenderer.removeListener('tab-updated', handler)
    },
    tabRemoved: (cb) => {
      const handler = (_, id) => cb(id)
      ipcRenderer.on('tab-removed', handler)
      return () => ipcRenderer.removeListener('tab-removed', handler)
    },
    tabLoading: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-loading', handler)
      return () => ipcRenderer.removeListener('tab-loading', handler)
    },
    tabAudioChanged: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-audio-changed', handler)
      return () => ipcRenderer.removeListener('tab-audio-changed', handler)
    },
    activeTabChanged: (cb) => {
      const handler = (_, id) => cb(id)
      ipcRenderer.on('active-tab-changed', handler)
      return () => ipcRenderer.removeListener('active-tab-changed', handler)
    },
    modeChanged: (cb) => {
      const handler = (_, m) => cb(m)
      ipcRenderer.on('mode-changed', handler)
      return () => ipcRenderer.removeListener('mode-changed', handler)
    },
    navError: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('navigation-error', handler)
      return () => ipcRenderer.removeListener('navigation-error', handler)
    },
    showHome: (cb) => {
      const handler = (_, id) => cb(id)
      ipcRenderer.on('show-home', handler)
      return () => ipcRenderer.removeListener('show-home', handler)
    },
    initialUrl: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('open-initial-url', handler)
      return () => ipcRenderer.removeListener('open-initial-url', handler)
    },
    onReopenClosedTab: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('tab-reopen-closed', handler)
      return () => ipcRenderer.removeListener('tab-reopen-closed', handler)
    },
    onToggleBookmarkCmd: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('toggle-bookmark-cmd', handler)
      return () => ipcRenderer.removeListener('toggle-bookmark-cmd', handler)
    },
    onToggleReaderModeCmd: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('toggle-reader-mode-cmd', handler)
      return () => ipcRenderer.removeListener('toggle-reader-mode-cmd', handler)
    },
    onOpenSettingsCmd: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('open-settings-cmd', handler)
      return () => ipcRenderer.removeListener('open-settings-cmd', handler)
    },
    onOpenAboutCmd: (cb) => {
      const handler = () => cb()
      ipcRenderer.on('open-about-cmd', handler)
      return () => ipcRenderer.removeListener('open-about-cmd', handler)
    },
  },

  // ── Multi-Window & Private Den Sandbox ────────────────────────────────────
  openNewWindow:   (url, isPrivate) => ipcRenderer.invoke('open-new-window', { url, isPrivate }),
  isPrivateWindow: () => ipcRenderer.invoke('is-private-window'),
  wipeAndExit:     () => ipcRenderer.invoke('wipe-and-exit'),

  // ── File Dialog ──────────────────────────────────────────────────────────────
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // ── Window Controls ────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),

  // ── REST & GraphQL API Workbench ──────────────────────────────────────────
  apiWorkbench: {
    sendRequest: (reqData) => ipcRenderer.invoke('api-workbench-send', reqData),
  },

  // ── Layout & Viewport States ───────────────────────────────────────────────
  setReaderModeActive: (isOpen) => ipcRenderer.invoke('set-reader-mode-active', isOpen),
  setModesInfoOpen:    (isOpen) => ipcRenderer.invoke('set-modes-info-open', isOpen),
  setTerminalState:    (isOpen, isMinimized) => ipcRenderer.invoke('set-terminal-state', { isOpen, isMinimized }),
  setActiveDrawer:     (drawer) => ipcRenderer.invoke('set-active-drawer', drawer),
  setDrawerWidth:      (width) => ipcRenderer.invoke('set-drawer-width', width),
  setMediaHudOpen:     (isOpen) => ipcRenderer.invoke('set-media-hud-open', isOpen),
  setBookmarksBarOpen: (isOpen) => ipcRenderer.invoke('set-bookmarks-bar-open', isOpen),
  setStatusBarOpen:    (isOpen) => ipcRenderer.invoke('set-statusbar-open', isOpen),
  createPrivateTab:    (url) => ipcRenderer.invoke('create-private-tab', url),

  // ── Extensions & Userscripts & Chrome Web Extensions ──────────────────────
  extensions: {
    get:  ()     => ipcRenderer.invoke('extensions-get'),
    save: (list) => ipcRenderer.invoke('extensions-save', list),
    installFromStore: (urlOrId) => ipcRenderer.invoke('chrome-extension-install-store', urlOrId),
    installFromFolder: () => ipcRenderer.invoke('chrome-extension-install-folder'),
    listChromeExtensions: () => ipcRenderer.invoke('chrome-extension-list'),
    toggleChromeExtension: (id, enabled) => ipcRenderer.invoke('chrome-extension-toggle', { id, enabled }),
    updateDetails: (id, patch) => ipcRenderer.invoke('chrome-extension-update-details', { id, patch }),
    removeChromeExtension: (id) => ipcRenderer.invoke('chrome-extension-remove', id),
    openPopup: (id) => ipcRenderer.invoke('chrome-extension-open-popup', id),
  },

  // ── Built-in AdBlock & YouTube Ad-Shield ──────────────────────────────────
  adblock: {
    getStats: () => ipcRenderer.invoke('adblock-get-stats'),
    clearStats: () => ipcRenderer.invoke('adblock-clear-stats'),
  },

  // ── Native Proxy & VPN Tunnel Controller ──────────────────────────────────
  proxy: {
    getConfig: () => ipcRenderer.invoke('proxy-get-config'),
    setConfig: (config) => ipcRenderer.invoke('proxy-set-config', config),
    setMode:   (modeOrRegion, maybeRegion, customRules) => {
      let mode = 'region'
      let region = 'direct'
      if (typeof modeOrRegion === 'string') {
        if (maybeRegion) {
          mode = modeOrRegion
          region = maybeRegion
        } else {
          region = modeOrRegion
          mode = region === 'direct' ? 'direct' : 'region'
        }
      }
      return ipcRenderer.invoke('proxy-set-mode', { mode, region, customRules })
    },
    setCustom: (proxyString) => ipcRenderer.invoke('proxy-set-mode', { mode: 'custom', region: proxyString, customRules: proxyString }),
    checkIp:   () => ipcRenderer.invoke('proxy-check-ip'),
  },

  // ── GitHub Releases Auto-Updater ──────────────────────────────────────────
  updater: {
    check:    ()              => ipcRenderer.invoke('updater-check'),
    download: (assetUrl)      => ipcRenderer.invoke('updater-download', assetUrl),
    install:  (installerPath) => ipcRenderer.invoke('updater-install', installerPath),
    getState: ()              => ipcRenderer.invoke('updater-get-state'),
    onStatusChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('updater-status-changed', handler)
      return () => ipcRenderer.removeListener('updater-status-changed', handler)
    },
    onProgress: (cb) => {
      const handler = (_, p) => cb(p)
      ipcRenderer.on('updater-download-progress', handler)
      return () => ipcRenderer.removeListener('updater-download-progress', handler)
    },
  },

  // ── Passwords & AutoFill Vault ────────────────────────────────────────────
  passwords: {
    getAll:       (query)       => ipcRenderer.invoke('passwords-get-all', query),
    getForDomain: (domain)      => ipcRenderer.invoke('passwords-get-for-domain', domain),
    save:         (item)        => ipcRenderer.invoke('passwords-save', item),
    update:       (id, patch)   => ipcRenderer.invoke('passwords-update', { id, patch }),
    delete:       (id)          => ipcRenderer.invoke('passwords-delete', id),
    clearAll:     ()            => ipcRenderer.invoke('passwords-clear-all'),
    generate:     (options)     => ipcRenderer.invoke('passwords-generate', options),
    audit:        ()            => ipcRenderer.invoke('passwords-audit'),
    export:       (format)      => ipcRenderer.invoke('passwords-export', format),
    import:       (data, format)=> ipcRenderer.invoke('passwords-import', { data, format }),
    getSettings:  ()            => ipcRenderer.invoke('passwords-get-settings'),
    updateSettings:(patch)      => ipcRenderer.invoke('passwords-update-settings', patch),
    getProfiles:  ()            => ipcRenderer.invoke('autofill-get-profiles'),
    saveAddress:  (profile)     => ipcRenderer.invoke('autofill-save-address', profile),
    deleteAddress:(id)          => ipcRenderer.invoke('autofill-delete-address', id),
    onSavePrompt: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('password-save-prompt', handler)
      return () => ipcRenderer.removeListener('password-save-prompt', handler)
    },
  },

  // ── Browser Task Manager ──────────────────────────────────────────────────
  taskManager: {
    getTasks:    ()    => ipcRenderer.invoke('task-manager-get-tasks'),
    killProcess: (pid) => ipcRenderer.invoke('task-manager-kill-process', pid),
  },

  // ── Cast Media to Device ──────────────────────────────────────────────────
  cast: {
    scan:    ()                 => ipcRenderer.invoke('cast-scan-devices'),
    start:   (options)          => ipcRenderer.invoke('cast-start', options),
    stop:    ()                 => ipcRenderer.invoke('cast-stop'),
    control: (command, value)   => ipcRenderer.invoke('cast-control', { command, value }),
    getState:()                 => ipcRenderer.invoke('cast-get-state'),
  },

  // ── WebApp & PWA Engine ───────────────────────────────────────────────────
  webApps: {
    getManifest: (tabId) => ipcRenderer.invoke('webapp-get-manifest', tabId),
    install:     (options) => ipcRenderer.invoke('webapp-install', options),
    launch:      (urlOrId) => ipcRenderer.invoke('webapp-launch', urlOrId),
    list:        () => ipcRenderer.invoke('webapp-list'),
    uninstall:   (id) => ipcRenderer.invoke('webapp-uninstall', id),
  },

  // ── Performance Engine (Memory Saver & Tab Sleeper) ───────────────────────
  performance: {
    getSettings:    ()      => ipcRenderer.invoke('performance-get-settings'),
    updateSettings: (patch) => ipcRenderer.invoke('performance-update-settings', patch),
    sleepInactive:  ()      => ipcRenderer.invoke('performance-sleep-inactive'),
    wakeTab:        (tabId) => ipcRenderer.invoke('performance-wake-tab', tabId),
    getStats:       ()      => ipcRenderer.invoke('performance-get-stats'),
    onTabSleepChange: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('tab-sleep-change', handler)
      return () => ipcRenderer.removeListener('tab-sleep-change', handler)
    },
  },

  // ── Memory Optimizer & Low-RAM Engine ───────────────────────────────────────
  memory: {
    clean:         ()        => ipcRenderer.invoke('memory-clean'),
    getStats:      ()        => ipcRenderer.invoke('memory-stats'),
    setLowRamMode: (enabled) => ipcRenderer.invoke('memory-set-low-ram-mode', enabled),
  },

  // ── ChevronNexus Zero-Knowledge Sync System ───────────────────────────────
  sync: {
    getParams:      (email)               => ipcRenderer.invoke('sync-get-params', email),
    register:       (payload)             => ipcRenderer.invoke('sync-register', payload),
    login:          (payload)             => ipcRenderer.invoke('sync-login', payload),
    logout:         ()                    => ipcRenderer.invoke('sync-logout'),
    getStatus:      ()                    => ipcRenderer.invoke('sync-get-status'),
    syncNow:        ()                    => ipcRenderer.invoke('sync-now'),
    getDevices:     ()                    => ipcRenderer.invoke('sync-get-devices'),
    revokeDevice:   (deviceId)            => ipcRenderer.invoke('sync-revoke-device', deviceId),
    wipeDevice:     (deviceId)            => ipcRenderer.invoke('sync-wipe-device', deviceId),
    setup2FA:       ()                    => ipcRenderer.invoke('sync-setup-2fa'),
    verify2FA:      (code)                => ipcRenderer.invoke('sync-verify-2fa', code),
    setServerUrl:   (url)                 => ipcRenderer.invoke('sync-set-server-url', url),
    sendTab:        (targetDeviceId, tab) => ipcRenderer.invoke('sync-send-tab', { targetDeviceId, tabData: tab }),
    onUpdate: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('sync-update', handler)
      return () => ipcRenderer.removeListener('sync-update', handler)
    },
    onReceivedTab: (cb) => {
      const handler = (_, d) => cb(d)
      ipcRenderer.on('sync-received-tab', handler)
      return () => ipcRenderer.removeListener('sync-received-tab', handler)
    },
  },

  // ── Pro Universal File & Media Studio ─────────────────────────────────────
  fileViewer: {
    openFileDialog: (customFilters) => ipcRenderer.invoke('file-viewer-open-dialog', customFilters),
    readFile:       (filePath)      => ipcRenderer.invoke('file-viewer-read', filePath),
    saveFile:       (payload)       => ipcRenderer.invoke('file-viewer-save', payload),
    onTriggerOpen:  (cb) => {
      const handler = () => cb()
      ipcRenderer.on('trigger-open-file', handler)
      return () => ipcRenderer.removeListener('trigger-open-file', handler)
    },
  },

  // ── System & Default Browser ───────────────────────────────────────────────
  system: {
    setDefaultBrowser: () => ipcRenderer.invoke('system-set-default-browser'),
    isDefaultBrowser:  () => ipcRenderer.invoke('system-is-default-browser'),
  },

  showContextMenu: (opts) => ipcRenderer.invoke('show-chrome-context-menu', opts),
})
