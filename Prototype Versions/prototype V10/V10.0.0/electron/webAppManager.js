/**
 * webAppManager.js
 * PWA & Standalone Desktop WebApp Engine for NeXusWeb (Chrome-style WebApps)
 * Manifest extraction, standalone frameless/sleek app window, shortcut creation, and multi-window isolation.
 */

const { app, BrowserWindow, Menu, shell, session } = require('electron')
const fs = require('fs')
const path = require('path')

const WEBAPPS_FILE = 'nexus_installed_webapps.json'

function getStorePath(filename) {
  try {
    return path.join(app.getPath('userData'), filename)
  } catch (e) {
    return path.join(__dirname, filename)
  }
}

function readJsonFile(filename, defaultVal = []) {
  try {
    const p = getStorePath(filename)
    if (!fs.existsSync(p)) return defaultVal
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    return defaultVal
  }
}

function writeJsonFile(filename, data) {
  try {
    fs.writeFileSync(getStorePath(filename), JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (e) {
    return false
  }
}

function getInstalledWebApps() {
  return readJsonFile(WEBAPPS_FILE, [])
}

/**
 * Creates a standalone, Chrome-style dedicated WebApp window.
 */
function createAppWindow(targetUrl, appName = 'Web App', iconUrl = null) {
  if (!targetUrl) return null

  const iconPath = path.join(__dirname, '../src/assets/icon.png')
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 600,
    minHeight: 450,
    title: appName,
    autoHideMenuBar: true,
    backgroundColor: '#0a0d14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      session: session.defaultSession,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: true,
    }
  })

  Menu.setApplicationMenu(null)

  // Dynamically update window title when page changes
  win.webContents.on('page-title-updated', (e, title) => {
    win.setTitle(`${title} — ${appName}`)
  })

  // Keyboard navigation shortcuts inside the WebApp window
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    // F5 or Ctrl+R: Reload
    if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
      event.preventDefault()
      win.webContents.reload()
    }
    // F12 or Ctrl+Shift+I: DevTools
    if (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault()
      win.webContents.toggleDevTools()
    }
    // Alt+Left: Back
    if (input.alt && input.key === 'ArrowLeft' && win.webContents.canGoBack()) {
      event.preventDefault()
      win.webContents.goBack()
    }
    // Alt+Right: Forward
    if (input.alt && input.key === 'ArrowRight' && win.webContents.canGoForward()) {
      event.preventDefault()
      win.webContents.goForward()
    }
  })

  win.loadURL(targetUrl).catch(err => {
    console.warn(`[NeXusWeb WebApp] Error loading ${targetUrl}:`, err.message)
  })

  return win
}

function launchWebApp(urlOrId) {
  if (!urlOrId) return { success: false, error: 'No URL or ID provided' }
  const apps = getInstalledWebApps()
  const found = apps.find(a => a.id === urlOrId || a.url === urlOrId)
  const targetUrl = found ? found.url : urlOrId
  const appName = found ? found.name : 'Web App'
  const iconUrl = found ? found.icon : null

  const win = createAppWindow(targetUrl, appName, iconUrl)
  return { success: !!win, url: targetUrl, name: appName }
}

function installWebApp({ name, url, icon, startUrl, createDesktopShortcut = true }) {
  if (!url) return { success: false, error: 'URL required to install WebApp' }
  const cleanUrl = url
  const appName = (name || new URL(url).hostname).trim()
  const appId = `webapp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()

  let list = getInstalledWebApps()
  // Update if already exists, or prepend
  const existingIdx = list.findIndex(a => a.url === cleanUrl)
  const newApp = {
    id: existingIdx >= 0 ? list[existingIdx].id : appId,
    name: appName,
    url: cleanUrl,
    startUrl: startUrl || cleanUrl,
    icon: icon || (existingIdx >= 0 ? list[existingIdx].icon : null),
    installedAt: now,
  }

  if (existingIdx >= 0) {
    list[existingIdx] = newApp
  } else {
    list.unshift(newApp)
  }
  writeJsonFile(WEBAPPS_FILE, list)

  // Create Windows Desktop Shortcut / Silent Batch Launcher
  if (createDesktopShortcut) {
    try {
      const desktopPath = app.getPath('desktop')
      const sanitizedName = appName.replace(/[/\\?%*:|"<>]/g, '')
      const shortcutBat = path.join(desktopPath, `${sanitizedName}.bat`)

      const execPath = process.execPath
      const batContent = `@echo off\r\nstart "" "${execPath}" --app="${cleanUrl}"\r\n`
      fs.writeFileSync(shortcutBat, batContent, 'utf8')
      newApp.shortcutPath = shortcutBat
    } catch(e) {
      console.warn('[NeXusWeb] Desktop shortcut creation warning:', e.message)
    }
  }

  // Automatically launch the newly installed WebApp in dedicated app window (Chrome behavior)
  try {
    createAppWindow(cleanUrl, appName, icon)
  } catch(e) {
    console.warn('[NeXusWeb] Auto-launch WebApp warning:', e.message)
  }

  return { success: true, app: newApp, webapps: list }
}

function uninstallWebApp(id) {
  let list = getInstalledWebApps()
  const target = list.find(a => a.id === id)
  if (target && target.shortcutPath && fs.existsSync(target.shortcutPath)) {
    try { fs.unlinkSync(target.shortcutPath) } catch(e) {}
  }
  list = list.filter(a => a.id !== id)
  writeJsonFile(WEBAPPS_FILE, list)
  return { success: true, webapps: list }
}

const EXTRACT_MANIFEST_SCRIPT = `
(function() {
  try {
    const title = document.querySelector('meta[name="application-name"]')?.content ||
                  document.querySelector('meta[property="og:site_name"]')?.content ||
                  document.title ||
                  window.location.hostname;

    const manifestLink = document.querySelector('link[rel="manifest"]')?.href;
    const icons = Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]'))
      .map(el => el.href)
      .filter(Boolean);

    const themeColor = document.querySelector('meta[name="theme-color"]')?.content || '#00d4ff';

    return {
      success: true,
      title: title.trim(),
      url: window.location.href,
      origin: window.location.origin,
      manifestUrl: manifestLink || null,
      icon: icons[0] || null,
      themeColor,
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
})()
`

module.exports = {
  getInstalledWebApps,
  installWebApp,
  uninstallWebApp,
  createAppWindow,
  launchWebApp,
  EXTRACT_MANIFEST_SCRIPT,
}
