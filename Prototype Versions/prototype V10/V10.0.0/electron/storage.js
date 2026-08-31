/**
 * storage.js
 * Persistent JSON storage for bookmarks, history, settings, dev notes, and session state.
 * Stored in Electron's userData directory.
 */

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

function getStorePath(name) {
  try {
    return path.join(app.getPath('userData'), `nexus_${name}.json`)
  } catch (e) {
    return path.join(__dirname, `nexus_${name}.json`)
  }
}

function readStore(name, defaultValue = []) {
  try {
    const p = getStorePath(name)
    if (!fs.existsSync(p)) return defaultValue
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    return defaultValue
  }
}

function writeStore(name, data) {
  try {
    fs.writeFileSync(getStorePath(name), JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (e) {
    return false
  }
}

// ── Search Engines ────────────────────────────────────────────────────────────
const SEARCH_ENGINES = [
  { id: 'duckduckgo', name: 'DuckDuckGo (Privacy)',  url: 'https://duckduckgo.com/?q={query}', homeUrl: 'https://duckduckgo.com', icon: '🦆' },
  { id: 'google',     name: 'Google',                url: 'https://www.google.com/search?q={query}', homeUrl: 'https://www.google.com', icon: '🔍' },
  { id: 'brave',      name: 'Brave Search',          url: 'https://search.brave.com/search?q={query}', homeUrl: 'https://search.brave.com', icon: '🦁' },
  { id: 'bing',       name: 'Bing',                  url: 'https://www.bing.com/search?q={query}', homeUrl: 'https://www.bing.com', icon: '🔵' },
  { id: 'ecosia',     name: 'Ecosia (Eco-friendly)', url: 'https://www.ecosia.org/search?q={query}', homeUrl: 'https://www.ecosia.org', icon: '🌲' },
  { id: 'startpage',  name: 'Startpage (Private)',   url: 'https://www.startpage.com/search?q={query}', homeUrl: 'https://www.startpage.com', icon: '🐸' },
  { id: 'kagi',       name: 'Kagi Search',           url: 'https://kagi.com/search?q={query}', homeUrl: 'https://kagi.com', icon: '🔴' },
  { id: 'custom',     name: 'Custom Template',       url: 'https://duckduckgo.com/?q={query}', homeUrl: 'https://duckduckgo.com', icon: '⚙️' },
]

// ── Bookmarks ──────────────────────────────────────────────────────────────────
function getBookmarks() {
  return readStore('bookmarks', [])
}

function addBookmark({ url, title, favicon }) {
  const bookmarks = getBookmarks()
  if (bookmarks.find(b => b.url === url)) return bookmarks
  bookmarks.unshift({ id: Date.now(), url, title: title || url, favicon: favicon || null, addedAt: new Date().toISOString() })
  writeStore('bookmarks', bookmarks)
  return bookmarks
}

function removeBookmark(id) {
  const bookmarks = getBookmarks().filter(b => b.id !== id && b.url !== id)
  writeStore('bookmarks', bookmarks)
  return bookmarks
}

function isBookmarked(url) {
  return !!getBookmarks().find(b => b.url === url)
}

// ── History ────────────────────────────────────────────────────────────────────
const MAX_HISTORY = 500

function getHistory() {
  return readStore('history', [])
}

function addHistory({ url, title, favicon }) {
  if (!url || url === 'nexusweb://home' || url.startsWith('devtools://') || url.startsWith('data:')) return
  const history = getHistory()
  const recent = history.slice(0, 5)
  const idx = recent.findIndex(h => h.url === url)
  if (idx !== -1) {
    history.splice(idx, 1)
  }
  history.unshift({ id: Date.now(), url, title: title || url, favicon: favicon || null, visitedAt: new Date().toISOString() })
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  writeStore('history', history)
  return history
}

function clearHistory() {
  writeStore('history', [])
  return []
}

function deleteHistoryItem(id) {
  const history = getHistory().filter(h => h.id !== id)
  writeStore('history', history)
  return history
}

// ── Settings ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light'
  defaultMode: 'normal', // 'strict' | 'lan' | 'normal' | 'dev'
  homePage: 'nexusweb://home',
  terminalShell: '',
  showBookmarksBar: false,
  newTabPage: 'home',
  autoScanInterval: 3000,
  searchEngine: {
    id: 'duckduckgo',
    name: 'DuckDuckGo (Privacy)',
    url: 'https://duckduckgo.com/?q={query}',
    homeUrl: 'https://duckduckgo.com',
    icon: '🦆'
  },
  privacyShield: {
    blockTrackers: true,
    blockAds: true,
    httpsUpgrade: true,
    fingerprintProtect: true,
  },
  media: {
    backgroundPlay: true,
    floatingVideoPiP: true,
    mediaHUD: true,
  },
  lowRamMode: false,
  autoCleanRam: true,
  tabSuspenderEnabled: true,
  tabSuspenderMinutes: 15,
  processSharingLimit: 4,
  wallpaper: '',
  wallpaperType: 'none',
  wallpaperBlur: 0,
  wallpaperOpacity: 0.85,
  version: '10.0.0',
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readStore('settings', {}) }
}

function updateSettings(patch) {
  const current = getSettings()
  const updated = { ...current, ...patch }
  writeStore('settings', updated)
  return updated
}

// ── Dev Notes / Scratch Pad ───────────────────────────────────────────────────
function getNotes() {
  return readStore('notes', { global: '# NeXusWeb Dev Notes\n\n- Welcome to Scratch Pad!\n- Keep scratch notes, API payloads, or snippet reminders here.', perUrl: {} })
}

function saveNotes(notes) {
  writeStore('notes', notes)
  return notes
}

function getNoteForUrl(urlKey) {
  const notes = getNotes()
  if (!urlKey || urlKey === 'global') {
    return { content: notes.global || '', isGlobal: true }
  }
  return { content: notes.perUrl?.[urlKey] || '', isGlobal: false }
}

function saveNoteForUrl(urlKey, content) {
  const notes = getNotes()
  if (!urlKey || urlKey === 'global') {
    notes.global = content
  } else {
    if (!notes.perUrl) notes.perUrl = {}
    notes.perUrl[urlKey] = content
  }
  saveNotes(notes)
  return notes
}

// ── Session Persistence ───────────────────────────────────────────────────────
function saveSession(sessionData) {
  writeStore('session', sessionData)
}

function getSession() {
  return readStore('session', null)
}

// ── Extensions & Userscripts Persistence ──────────────────────────────────────
function getExtensions() {
  return readStore('extensions', [
    {
      id: 'ext_dark_mode_override',
      name: 'Universal Dark Content Enhancer',
      description: 'Forces high-contrast dark palette on plain white legacy web docs.',
      domainMatch: '*://*/*',
      enabled: false,
      customJs: `console.log('[NeXus Extension] Universal Dark Active');`,
      customCss: `img, video { opacity: 0.95; }`,
    }
  ])
}

function saveExtensions(list) {
  writeStore('extensions', list)
  return list
}

// ── Sync Collection Converters ─────────────────────────────────────────────
function getAllSyncableData(sinceTimestamp = 0) {
  const items = []

  // 1. Bookmarks
  const bookmarks = getBookmarks()
  bookmarks.forEach(b => {
    items.push({
      collection: 'bookmarks',
      id: String(b.id || b.url),
      data: b,
      modifiedAt: b.createdAt || Date.now(),
    })
  })

  // 2. Notes
  const notes = getNotes()
  if (Array.isArray(notes)) {
    notes.forEach(n => {
      items.push({
        collection: 'notes',
        id: String(n.id || n.title),
        data: n,
        modifiedAt: n.updatedAt || Date.now(),
      })
    })
  }

  // 3. Settings
  const settings = getSettings()
  items.push({
    collection: 'settings',
    id: 'user_settings',
    data: settings,
    modifiedAt: Date.now(),
  })

  // 4. Extensions
  const extensions = getExtensions()
  extensions.forEach(ext => {
    items.push({
      collection: 'extensions',
      id: String(ext.id),
      data: ext,
      modifiedAt: Date.now(),
    })
  })

  return items
}

function applyIncomingSyncData(incomingItems = [], tombstones = []) {
  let bookmarks = getBookmarks()
  let notes = getNotes()
  let extensions = getExtensions()

  incomingItems.forEach(item => {
    if (item.collection === 'bookmarks') {
      const idx = bookmarks.findIndex(b => (b.id && b.id === item.data.id) || b.url === item.data.url)
      if (idx >= 0) bookmarks[idx] = { ...bookmarks[idx], ...item.data }
      else bookmarks.push(item.data)
    } else if (item.collection === 'notes') {
      if (Array.isArray(notes)) {
        const idx = notes.findIndex(n => n.id === item.data.id)
        if (idx >= 0) notes[idx] = { ...notes[idx], ...item.data }
        else notes.push(item.data)
      }
    } else if (item.collection === 'extensions') {
      const idx = extensions.findIndex(e => e.id === item.data.id)
      if (idx >= 0) extensions[idx] = { ...extensions[idx], ...item.data }
      else extensions.push(item.data)
    } else if (item.collection === 'settings') {
      updateSettings(item.data)
    }
  })

  tombstones.forEach(t => {
    if (t.collection === 'bookmarks') {
      bookmarks = bookmarks.filter(b => b.id !== t.id && b.url !== t.id)
    } else if (t.collection === 'notes' && Array.isArray(notes)) {
      notes = notes.filter(n => n.id !== t.id)
    } else if (t.collection === 'extensions') {
      extensions = extensions.filter(e => e.id !== t.id)
    }
  })

  writeStore('bookmarks', bookmarks)
  writeStore('notes', notes)
  writeStore('extensions', extensions)
}

module.exports = {
  SEARCH_ENGINES,
  getBookmarks, addBookmark, removeBookmark, isBookmarked,
  getHistory, addHistory, clearHistory, deleteHistoryItem,
  getSettings, updateSettings,
  getNotes, saveNotes, getNoteForUrl, saveNoteForUrl,
  getExtensions, saveExtensions,
  saveSession, getSession,
  getAllSyncableData, applyIncomingSyncData,
}
