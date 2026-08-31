/**
 * tabSuspender.js - NeXusWeb V4
 * Automatic memory tab hibernation & RAM reclamation engine.
 */

const { getSettings } = require('./storage')

class TabSuspender {
  constructor(mainWindow, tabsMap) {
    this.mainWindow = mainWindow
    this.tabsMap = tabsMap
    this.timer = null
    this.startMonitoring()
  }

  startMonitoring() {
    if (this.timer) clearInterval(this.timer)
    // Check tab idle state every 60 seconds
    this.timer = setInterval(() => this.checkTabs(), 60000)
  }

  stopMonitoring() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  touchTab(tabId) {
    const tab = this.tabsMap.get(tabId)
    if (tab) {
      tab.lastActiveTime = Date.now()
      if (tab.isSuspended) {
        this.resumeTab(tabId)
      }
    }
  }

  suspendTab(tabId) {
    const tab = this.tabsMap.get(tabId)
    if (!tab || tab.isSuspended || tab.isPlayingAudio || tab.url === 'nexusweb://home') return
    
    tab.isSuspended = true
    try {
      // Freeze JS execution and background resource consumption
      tab.view.webContents.setBackgroundThrottling(true)
    } catch (e) {}

    this.mainWindow?.webContents.send('tab-suspended-changed', { tabId, isSuspended: true })
    console.log(`[NeXusWeb TabSuspender] Suspended tab ${tabId} (${tab.title}) to free RAM`)
  }

  resumeTab(tabId) {
    const tab = this.tabsMap.get(tabId)
    if (!tab || !tab.isSuspended) return

    tab.isSuspended = false
    tab.lastActiveTime = Date.now()
    try {
      tab.view.webContents.setBackgroundThrottling(false)
    } catch (e) {}

    this.mainWindow?.webContents.send('tab-suspended-changed', { tabId, isSuspended: false })
    console.log(`[NeXusWeb TabSuspender] Resumed tab ${tabId} (${tab.title})`)
  }

  checkTabs() {
    const settings = getSettings()
    if (settings.enableTabSuspender === false) return

    const idleThresholdMs = (settings.tabSuspenderMinutes || 15) * 60 * 1000
    const now = Date.now()

    this.tabsMap.forEach((tab, tabId) => {
      // Never suspend tabs playing audio or active home tabs
      if (tab.isPlayingAudio || tab.url === 'nexusweb://home' || tab.isSuspended) return

      const idleTime = now - (tab.lastActiveTime || now)
      if (idleTime >= idleThresholdMs) {
        this.suspendTab(tabId)
      }
    })
  }

  getResourceStats() {
    const stats = []
    this.tabsMap.forEach((tab, tabId) => {
      stats.push({
        id: tabId,
        title: tab.title,
        url: tab.url,
        isSuspended: !!tab.isSuspended,
        isPlayingAudio: !!tab.isPlayingAudio,
      })
    })
    return stats
  }
}

module.exports = { TabSuspender }
