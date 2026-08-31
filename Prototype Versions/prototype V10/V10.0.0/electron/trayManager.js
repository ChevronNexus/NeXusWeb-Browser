/**
 * trayManager.js
 * System Tray Integration for NeXusWeb V3.
 * Manages tray icon, dynamic server list menu, network mode toggle, and minimize-to-tray.
 */

const { Tray, Menu, nativeImage, app } = require('electron')
const path = require('path')
const fs = require('fs')

let tray = null

function initTray({ getMainWindow, onNewTab, onTriggerPiP, onModeChange, getMode, getServers }) {
  if (tray) return tray

  try {
    const iconPath = path.join(__dirname, '../src/assets/icon.png')
    let trayImage

    if (fs.existsSync(iconPath)) {
      trayImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    } else {
      trayImage = nativeImage.createEmpty()
    }

    tray = new Tray(trayImage)
    tray.setToolTip('NeXusWeb V3 · Privacy & Developer Browser')

    const updateContextMenu = async () => {
      const mainWindow = getMainWindow()
      const isVisible = mainWindow && mainWindow.isVisible()
      const currentMode = getMode ? getMode() : 'normal'
      let servers = []
      try {
        if (getServers) servers = await getServers()
      } catch (e) {}

      const serverMenuItems = servers.length > 0 ? [
        { label: `⚡ Active Servers (${servers.length})`, enabled: false },
        ...servers.slice(0, 5).map(s => ({
          label: `  :${s.port} — ${s.name || 'Server'}`,
          click: () => {
            if (mainWindow) {
              if (!mainWindow.isVisible()) mainWindow.show()
              mainWindow.focus()
            }
            if (onNewTab) onNewTab(`http://localhost:${s.port}`)
          }
        })),
        { type: 'separator' }
      ] : []

      const contextMenu = Menu.buildFromTemplate([
        {
          label: isVisible ? 'Hide NeXusWeb' : 'Show NeXusWeb',
          click: () => {
            if (!mainWindow) return
            if (mainWindow.isVisible()) {
              mainWindow.hide()
            } else {
              mainWindow.show()
              mainWindow.focus()
            }
          },
        },
        {
          label: '➕ New Tab',
          click: () => {
            if (mainWindow) {
              if (!mainWindow.isVisible()) mainWindow.show()
              mainWindow.focus()
            }
            if (onNewTab) onNewTab()
          }
        },
        {
          label: '📺 Floating Video (PiP)',
          click: () => {
            if (onTriggerPiP) onTriggerPiP()
          }
        },
        { type: 'separator' },
        ...serverMenuItems,
        {
          label: `🛡️ Network Mode: ${currentMode.toUpperCase()}`,
          submenu: [
            {
              label: '🔒 Strict Offline (Localhost)',
              type: 'radio',
              checked: currentMode === 'strict',
              click: () => onModeChange && onModeChange('strict')
            },
            {
              label: '📡 Local Network (LAN)',
              type: 'radio',
              checked: currentMode === 'lan',
              click: () => onModeChange && onModeChange('lan')
            },
            {
              label: '🛡️ Normal Web (Privacy Shield)',
              type: 'radio',
              checked: currentMode === 'normal',
              click: () => onModeChange && onModeChange('normal')
            },
            {
              label: '⚡ Developer Mode (Unrestricted)',
              type: 'radio',
              checked: currentMode === 'dev',
              click: () => onModeChange && onModeChange('dev')
            },
          ]
        },
        { type: 'separator' },
        {
          label: 'Quit NeXusWeb',
          click: () => {
            app.isQuitting = true
            app.quit()
          }
        },
      ])

      tray.setContextMenu(contextMenu)
    }

    tray.on('click', () => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return
      if (mainWindow.isVisible()) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    })

    tray.on('right-click', () => {
      updateContextMenu()
    })

    updateContextMenu()
    return tray
  } catch (err) {
    console.error('[NeXusWeb] Failed to create tray icon:', err)
    return null
  }
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

module.exports = {
  initTray,
  destroyTray,
}
