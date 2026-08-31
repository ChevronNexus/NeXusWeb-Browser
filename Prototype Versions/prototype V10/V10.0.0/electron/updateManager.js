/**
 * updateManager.js - NeXusWeb V10.0.0
 * Sovereign High-Speed GitHub Releases Auto-Updater Engine
 * Repository: https://github.com/ChevronNexus/NeXusWeb-Browser
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')

const CURRENT_VERSION = '10.0.0'
const GITHUB_REPO = 'ChevronNexus/NeXusWeb-Browser'
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

function parseSemver(verStr) {
  if (!verStr) return [0, 0, 0]
  const clean = String(verStr).trim().replace(/^v/i, '')
  const parts = clean.split('-')[0].split('.').map(p => parseInt(p, 10) || 0)
  while (parts.length < 3) parts.push(0)
  return parts
}

function isNewerVersion(current, remote) {
  const [cMaj, cMin, cPatch] = parseSemver(current)
  const [rMaj, rMin, rPatch] = parseSemver(remote)
  if (rMaj > cMaj) return true
  if (rMaj < cMaj) return false
  if (rMin > cMin) return true
  if (rMin < cMin) return false
  return rPatch > cPatch
}

class UpdateManager {
  constructor() {
    this.currentVersion = CURRENT_VERSION
    this.status = 'idle' // 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error'
    this.updateInfo = null
    this.downloadedFilePath = null
    this.downloadAbortController = null
  }

  notifyWindows(channel, data) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  /**
   * Fetch JSON from URL with GitHub User-Agent
   */
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': `NeXusWeb-Browser/${CURRENT_VERSION} (Windows NT 10.0; Win64; x64)`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      }

      https.get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return this.fetchJson(res.headers.location).then(resolve).catch(reject)
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`GitHub API HTTP ${res.statusCode}: ${res.statusMessage}`))
        }

        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          try {
            const data = JSON.parse(body)
            resolve(data)
          } catch (e) {
            reject(new Error('Invalid JSON response from GitHub Releases'))
          }
        })
      }).on('error', reject).on('timeout', function() {
        this.destroy()
        reject(new Error('GitHub API request timed out (10s)'))
      })
    })
  }

  /**
   * Check GitHub Releases for newer version
   */
  async checkForUpdates() {
    this.status = 'checking'
    this.notifyWindows('updater-status-changed', { status: 'checking', currentVersion: this.currentVersion })

    try {
      const release = await this.fetchJson(GITHUB_API_URL)
      const tagName = release.tag_name || ''
      const latestVer = tagName.replace(/^v/i, '')

      const hasUpdate = isNewerVersion(this.currentVersion, latestVer)

      // Find compatible Windows Setup asset
      let chosenAsset = null
      if (Array.isArray(release.assets)) {
        chosenAsset = release.assets.find(a => a.name.endsWith('.exe') && (a.name.includes('Setup') || a.name.includes('setup')))
          || release.assets.find(a => a.name.endsWith('.exe'))
          || release.assets.find(a => a.name.endsWith('.zip'))
      }

      this.updateInfo = {
        isUpdateAvailable: hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion: latestVer,
        releaseName: release.name || `NeXusWeb v${latestVer}`,
        releaseNotes: release.body || 'No release notes provided for this version.',
        publishedAt: release.published_at,
        htmlUrl: release.html_url,
        asset: chosenAsset ? {
          name: chosenAsset.name,
          size: chosenAsset.size,
          downloadUrl: chosenAsset.browser_download_url,
          downloadCount: chosenAsset.download_count,
        } : null,
        githubRepo: `https://github.com/${GITHUB_REPO}`,
      }

      this.status = hasUpdate ? 'available' : 'up-to-date'
      this.notifyWindows('updater-status-changed', {
        status: this.status,
        ...this.updateInfo
      })

      return this.updateInfo
    } catch (err) {
      // Fallback check against local manifest if GitHub offline
      try {
        const localManifest = path.join(app.getAppPath(), 'setup-manifest.json')
        if (fs.existsSync(localManifest)) {
          const m = JSON.parse(fs.readFileSync(localManifest, 'utf8'))
          if (m?.version && isNewerVersion(this.currentVersion, m.version)) {
            this.status = 'available'
            this.updateInfo = {
              isUpdateAvailable: true,
              currentVersion: this.currentVersion,
              latestVersion: m.version,
              releaseName: `NeXusWeb v${m.version}`,
              releaseNotes: (m.features || []).join('\n• '),
              asset: null,
              githubRepo: `https://github.com/${GITHUB_REPO}`
            }
            this.notifyWindows('updater-status-changed', { status: 'available', ...this.updateInfo })
            return this.updateInfo
          }
        }
      } catch (e) {}

      this.status = 'error'
      const errorResult = {
        isUpdateAvailable: false,
        error: err.message,
        currentVersion: this.currentVersion,
        githubRepo: `https://github.com/${GITHUB_REPO}`
      }
      this.notifyWindows('updater-status-changed', { status: 'error', error: err.message })
      return errorResult
    }
  }

  /**
   * Download update binary with chunked progress streaming
   */
  downloadUpdate(assetUrl) {
    return new Promise((resolve, reject) => {
      const targetUrl = assetUrl || this.updateInfo?.asset?.downloadUrl
      if (!targetUrl) {
        return reject(new Error('No download URL available for update.'))
      }

      this.status = 'downloading'
      this.notifyWindows('updater-status-changed', { status: 'downloading' })

      const updatesDir = path.join(app.getPath('userData'), 'updates')
      if (!fs.existsSync(updatesDir)) {
        fs.mkdirSync(updatesDir, { recursive: true })
      }

      const fileName = path.basename(targetUrl.split('?')[0]) || `NeXusWeb-Setup-v${this.updateInfo?.latestVersion || 'latest'}.exe`
      const destination = path.join(updatesDir, fileName)
      this.downloadedFilePath = destination

      const fileStream = fs.createWriteStream(destination)
      let downloadedBytes = 0
      let totalBytes = this.updateInfo?.asset?.size || 0
      let startTime = Date.now()

      const downloadFile = (url) => {
        const protocol = url.startsWith('https') ? https : http
        const req = protocol.get(url, {
          headers: {
            'User-Agent': `NeXusWeb-Browser/${CURRENT_VERSION}`
          }
        }, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            return downloadFile(response.headers.location)
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            fileStream.close()
            fs.unlink(destination, () => {})
            this.status = 'error'
            this.notifyWindows('updater-status-changed', { status: 'error', error: `Download failed: HTTP ${response.statusCode}` })
            return reject(new Error(`Download failed with status ${response.statusCode}`))
          }

          if (response.headers['content-length']) {
            totalBytes = parseInt(response.headers['content-length'], 10)
          }

          let lastProgressUpdate = 0

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length
            fileStream.write(chunk)

            const now = Date.now()
            if (now - lastProgressUpdate > 150) {
              const elapsedSec = Math.max((now - startTime) / 1000, 0.1)
              const speedBytesPerSec = downloadedBytes / elapsedSec
              const speedMbps = (speedBytesPerSec / (1024 * 1024)).toFixed(2)
              const percent = totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0

              const progressData = {
                downloadedBytes,
                totalBytes,
                percent: Math.round(percent),
                speedMbps: parseFloat(speedMbps),
                downloadedMB: (downloadedBytes / (1024 * 1024)).toFixed(1),
                totalMB: (totalBytes / (1024 * 1024)).toFixed(1)
              }

              this.notifyWindows('updater-download-progress', progressData)
              lastProgressUpdate = now
            }
          })

          response.on('end', () => {
            fileStream.end(() => {
              this.status = 'ready'
              this.notifyWindows('updater-status-changed', {
                status: 'ready',
                downloadedFilePath: destination,
                version: this.updateInfo?.latestVersion
              })
              resolve(destination)
            })
          })

          response.on('error', (err) => {
            fileStream.close()
            fs.unlink(destination, () => {})
            this.status = 'error'
            this.notifyWindows('updater-status-changed', { status: 'error', error: err.message })
            reject(err)
          })
        })

        req.on('error', (err) => {
          fileStream.close()
          fs.unlink(destination, () => {})
          this.status = 'error'
          this.notifyWindows('updater-status-changed', { status: 'error', error: err.message })
          reject(err)
        })
      }

      downloadFile(targetUrl)
    })
  }

  /**
   * Hand off update to updater.exe or silent setup and restart
   */
  async installUpdateAndRestart(customFilePath) {
    const fileToInstall = customFilePath || this.downloadedFilePath
    if (!fileToInstall || !fs.existsSync(fileToInstall)) {
      throw new Error('Downloaded update file not found.')
    }

    const appDir = path.dirname(process.execPath)
    const appExe = process.execPath
    const updaterExe = path.join(appDir, 'updater.exe')

    if (fs.existsSync(updaterExe)) {
      // Use dedicated standalone updater binary
      spawn(updaterExe, [
        '--source', fileToInstall,
        '--target', appDir,
        '--pid', String(process.pid),
        '--launch', appExe
      ], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    } else {
      // Fallback: spawn downloaded setup.exe directly with /SILENT /UPDATE
      spawn(fileToInstall, ['/SILENT', '/UPDATE'], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    }

    setTimeout(() => {
      app.quit()
    }, 400)

    return { success: true }
  }
}

module.exports = {
  updateManager: new UpdateManager(),
  CURRENT_VERSION,
  GITHUB_REPO,
  GITHUB_API_URL,
}
