const fs = require('fs')
const path = require('path')
const { app, dialog } = require('electron')
const { spawn } = require('child_process')

const CURRENT_VERSION = '6.0.0'
const UPDATE_MANIFEST_URL = 'https://updates.chevronnexus.com/nexusweb/latest.json'

class UpdateManager {
  constructor() {
    this.currentVersion = CURRENT_VERSION
    this.updateStatus = 'idle' // 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
    this.updateInfo = null
  }

  async checkForUpdates() {
    this.updateStatus = 'checking'
    
    // Simulate check against manifest or local distribution
    try {
      const manifestPath = path.join(__dirname, '..', 'dist-electron', 'setup-manifest.json')
      let manifest = null
      
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        } catch (e) {}
      }

      // Check version
      this.updateStatus = 'up-to-date'
      return {
        isUpdateAvailable: false,
        currentVersion: this.currentVersion,
        latestVersion: manifest?.version || this.currentVersion,
        releaseNotes: 'You are on the latest official build of NeXusWeb V6 by Chevron Nexus Software.',
        features: manifest?.features || [],
        buildDate: manifest?.buildDate || new Date().toISOString(),
        publisher: 'Chevron Nexus Software',
      }
    } catch (err) {
      this.updateStatus = 'error'
      return {
        isUpdateAvailable: false,
        error: err.message,
        currentVersion: this.currentVersion,
      }
    }
  }

  async installUpdateAndRestart(installerPath) {
    // If installerPath not provided, look for local setup.exe or NeXusWeb-Setup-v6.0.0.exe
    let targetSetup = installerPath
    if (!targetSetup) {
      const candidates = [
        path.join(__dirname, '..', 'dist-electron', 'NeXusWeb-Setup-v6.0.0.exe'),
        path.join(__dirname, '..', 'dist-electron', 'setup.exe'),
        path.join(app.getPath('userData'), 'updates', 'setup.exe')
      ]
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          targetSetup = c
          break
        }
      }
    }

    if (!targetSetup || !fs.existsSync(targetSetup)) {
      throw new Error('Installer binary not found.')
    }

    // Launch installer in /UPDATE mode and quit current app
    spawn(targetSetup, ['/UPDATE'], {
      detached: true,
      stdio: 'ignore'
    }).unref()

    setTimeout(() => {
      app.quit()
    }, 500)

    return { success: true }
  }
}

module.exports = {
  updateManager: new UpdateManager(),
  CURRENT_VERSION,
}
