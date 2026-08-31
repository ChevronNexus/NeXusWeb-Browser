/**
 * gridManager.js - NeXusWeb V4
 * High-performance multi-pane grid & quad-view layout engine.
 * Computes pixel-perfect native BrowserView bounds with zero-flicker resizing.
 */

class GridManager {
  constructor(mainWindow, tabsMap) {
    this.mainWindow = mainWindow
    this.tabsMap = tabsMap
    this.layout = 'single' // 'single' | 'split-h' | 'split-v' | 'grid-2x2'
    this.paneTabIds = [null, null, null, null] // Array of up to 4 tab IDs
    this.activeDrawer = null
  }

  setLayout(layout, paneTabIds = []) {
    this.layout = layout || 'single'
    if (Array.isArray(paneTabIds)) {
      this.paneTabIds = [
        paneTabIds[0] || null,
        paneTabIds[1] || null,
        paneTabIds[2] || null,
        paneTabIds[3] || null,
      ]
    }
    this.repositionAllViews()
    return { layout: this.layout, paneTabIds: this.paneTabIds }
  }

  setPaneTab(paneIndex, tabId) {
    if (paneIndex >= 0 && paneIndex < 4) {
      this.paneTabIds[paneIndex] = tabId || null
      this.repositionAllViews()
    }
    return { layout: this.layout, paneTabIds: this.paneTabIds }
  }

  setActiveDrawer(drawer) {
    this.activeDrawer = drawer || null
    this.repositionAllViews()
  }

  getState() {
    return {
      layout: this.layout,
      paneTabIds: this.paneTabIds,
      activeDrawer: this.activeDrawer,
    }
  }

  repositionAllViews(activeTabId = null) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const bounds = this.mainWindow.getContentBounds()
    const TOP_OFFSET = 122
    const BOTTOM_OFFSET = 28
    const contentHeight = Math.max(0, bounds.height - TOP_OFFSET - BOTTOM_OFFSET)
    const DRAWER_WIDTH = this.activeDrawer ? 360 : 0
    const availableWidth = Math.max(0, bounds.width - DRAWER_WIDTH)

    // Detach all views first to prevent overlap ghosting
    this.tabsMap.forEach(({ view }) => {
      try { this.mainWindow.removeBrowserView(view) } catch (e) {}
    })

    const attachView = (tabId, rect) => {
      if (!tabId) return
      const tab = this.tabsMap.get(tabId)
      if (tab && tab.view && tab.url && tab.url !== 'nexusweb://home' && !tab.isSuspended) {
        try {
          this.mainWindow.addBrowserView(tab.view)
          tab.view.setBounds({
            x: Math.max(0, Math.floor(rect.x)),
            y: Math.max(0, Math.floor(rect.y)),
            width: Math.max(0, Math.floor(rect.width)),
            height: Math.max(0, Math.floor(rect.height)),
          })
        } catch (e) {}
      }
    }

    if (this.layout === 'single') {
      const primaryId = this.paneTabIds[0] || activeTabId
      attachView(primaryId, { x: 0, y: TOP_OFFSET, width: availableWidth, height: contentHeight })
    }
    else if (this.layout === 'split-h') {
      const halfW = Math.floor(availableWidth / 2)
      attachView(this.paneTabIds[0] || activeTabId, { x: 0, y: TOP_OFFSET, width: halfW - 1, height: contentHeight })
      attachView(this.paneTabIds[1], { x: halfW + 1, y: TOP_OFFSET, width: availableWidth - halfW - 1, height: contentHeight })
    }
    else if (this.layout === 'split-v') {
      const halfH = Math.floor(contentHeight / 2)
      attachView(this.paneTabIds[0] || activeTabId, { x: 0, y: TOP_OFFSET, width: availableWidth, height: halfH - 1 })
      attachView(this.paneTabIds[1], { x: 0, y: TOP_OFFSET + halfH + 1, width: availableWidth, height: contentHeight - halfH - 1 })
    }
    else if (this.layout === 'grid-2x2') {
      const halfW = Math.floor(availableWidth / 2)
      const halfH = Math.floor(contentHeight / 2)
      // Top-Left (Pane 0)
      attachView(this.paneTabIds[0] || activeTabId, { x: 0, y: TOP_OFFSET, width: halfW - 1, height: halfH - 1 })
      // Top-Right (Pane 1)
      attachView(this.paneTabIds[1], { x: halfW + 1, y: TOP_OFFSET, width: availableWidth - halfW - 1, height: halfH - 1 })
      // Bottom-Left (Pane 2)
      attachView(this.paneTabIds[2], { x: 0, y: TOP_OFFSET + halfH + 1, width: halfW - 1, height: contentHeight - halfH - 1 })
      // Bottom-Right (Pane 3)
      attachView(this.paneTabIds[3], { x: halfW + 1, y: TOP_OFFSET + halfH + 1, width: availableWidth - halfW - 1, height: contentHeight - halfH - 1 })
    }
  }
}

module.exports = { GridManager }
