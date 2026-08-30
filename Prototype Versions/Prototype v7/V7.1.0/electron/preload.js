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
    get:    ()      => ipcRenderer.invoke('settings-get'),
    update: (patch) => ipcRenderer.invoke('settings-update', patch),
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
  createPrivateTab:    (url) => ipcRenderer.invoke('create-private-tab', url),

  // ── Extensions & Userscripts & Chrome Web Extensions ──────────────────────
  extensions: {
    get:  ()     => ipcRenderer.invoke('extensions-get'),
    save: (list) => ipcRenderer.invoke('extensions-save', list),
    installFromStore: (urlOrId) => ipcRenderer.invoke('chrome-extension-install-store', urlOrId),
    installFromFolder: () => ipcRenderer.invoke('chrome-extension-install-folder'),
    listChromeExtensions: () => ipcRenderer.invoke('chrome-extension-list'),
    toggleChromeExtension: (id, enabled) => ipcRenderer.invoke('chrome-extension-toggle', { id, enabled }),
    removeChromeExtension: (id) => ipcRenderer.invoke('chrome-extension-remove', id),
    openPopup: (id) => ipcRenderer.invoke('chrome-extension-open-popup', id),
  },

  // ── Native Proxy & VPN Tunnel Controller ──────────────────────────────────
  proxy: {
    getConfig: () => ipcRenderer.invoke('proxy-get-config'),
    setConfig: (config) => ipcRenderer.invoke('proxy-set-config', config),
    setMode:   (mode, region, customRules) => ipcRenderer.invoke('proxy-set-mode', { mode, region, customRules }),
    checkIp:   () => ipcRenderer.invoke('proxy-check-ip'),
  },

  // ── Software Updater ──────────────────────────────────────────────────────
  updater: {
    check: () => ipcRenderer.invoke('updater-check'),
    install: (installerPath) => ipcRenderer.invoke('updater-install', installerPath),
  },
})
