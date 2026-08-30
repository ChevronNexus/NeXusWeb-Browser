/**
 * zoomManager.js - NeXusWeb V4
 * Manages dynamic page zooming with Ctrl + Mouse Wheel, keyboard shortcuts,
 * and synchronizes with the user's settings.
 */

const { getSettings } = require('./storage')

class ZoomManager {
  constructor(mainWindow, tabsMap) {
    this.mainWindow = mainWindow
    this.tabsMap = tabsMap
  }

  attachZoomEvents(tabId, view) {
    if (!view || !view.webContents) return

    // Inject wheel listener for Ctrl + Scroll Wheel
    const SCRIPT = `
      (function() {
        if (window.__nexus_zoom_wheel_attached) return;
        window.__nexus_zoom_wheel_attached = true;

        window.addEventListener('wheel', (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const direction = e.deltaY < 0 ? 'in' : 'out';
            window.postMessage({ type: '__nexus_wheel_zoom', direction }, '*');
          }
        }, { passive: false });
      })();
    `

    view.webContents.on('dom-ready', () => {
      view.webContents.executeJavaScript(SCRIPT).catch(() => {})
    })

    view.webContents.on('ipc-message', (_, channel, data) => {
      if (channel === 'zoom-wheel') {
        const settings = getSettings()
        if (settings.enableCtrlWheelZoom !== false) {
          if (data === 'in') this.zoomIn(tabId)
          else if (data === 'out') this.zoomOut(tabId)
        }
      }
    })
  }

  getZoom(tabId) {
    const tab = this.tabsMap.get(tabId)
    return tab?.zoomFactor || 1.0
  }

  setZoom(tabId, factor) {
    const tab = this.tabsMap.get(tabId)
    if (tab && tab.view) {
      const clamped = Math.max(0.25, Math.min(3.0, Math.round(factor * 10) / 10))
      tab.zoomFactor = clamped
      try {
        tab.view.webContents.setZoomFactor(clamped)
      } catch (e) {}
      this.mainWindow?.webContents.send('zoom-changed', { tabId, zoomFactor: clamped })
      return clamped
    }
    return 1.0
  }

  zoomIn(tabId) {
    const current = this.getZoom(tabId)
    return this.setZoom(tabId, current + 0.1)
  }

  zoomOut(tabId) {
    const current = this.getZoom(tabId)
    return this.setZoom(tabId, current - 0.1)
  }

  zoomReset(tabId) {
    return this.setZoom(tabId, 1.0)
  }
}

module.exports = { ZoomManager }
