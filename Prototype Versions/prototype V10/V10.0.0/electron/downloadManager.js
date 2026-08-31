/**
 * downloadManager.js
 * Comprehensive Multi-Part Download Manager for NeXusWeb V7.1.0
 * 
 * Features:
 * 1. Dynamic Multi-Part Segmentation: Divides and re-splits active chunks dynamically during downloads.
 * 2. Keep-Alive Connection Reuse: Prevents repeated TLS handshakes.
 * 3. Range-Resume & Recovery: Writes .nexusdownload state to disk for pause/resume and crash recovery.
 * 4. Bandwidth Speed Limiter: Throttles downloads to avoid interfering with browsing, streaming, or gaming.
 * 5. Folder Selector: Native browse dialog for default download location.
 */

const { shell, clipboard, dialog, app } = require('electron')
const path = require('path')
const fs = require('fs')
const { DynamicSegmentDownloader } = require('./multiPartDownloader')
const { getSettings } = require('./storage')

const downloads = new Map() // id -> downloadRecord
const activeItems = new Map() // id -> Electron DownloadItem
const multiPartEngines = new Map() // id -> DynamicSegmentDownloader
let mainWindowRef = null

function formatEta(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return null
  if (seconds < 60) return `${Math.ceil(seconds)}s left`
  const mins = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)
  if (mins < 60) return `${mins}m ${secs}s left`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}h ${remMins}m left`
}

function getFileType(filename) {
  const ext = path.extname(filename || '').toLowerCase()
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) return 'archive'
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)) return 'image'
  if (['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) return 'audio'
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.cpp', '.c', '.rs', '.go'].includes(ext)) return 'code'
  if (['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.csv', '.xlsx'].includes(ext)) return 'document'
  if (['.exe', '.msi', '.bat', '.cmd', '.sh', '.appimage', '.deb', '.rpm'].includes(ext)) return 'executable'
  return 'default'
}

function initDownloadManager(sess, getMainWindow) {
  mainWindowRef = getMainWindow

  sess.on('will-download', (event, item, webContents) => {
    const settings = getSettings()
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 4)
    const filename = item.getFilename()
    const totalBytes = item.getTotalBytes()
    const startTime = Date.now()
    const fileType = getFileType(filename)
    const speedLimitKB = settings.downloadSpeedLimitKB || 0

    // If custom download path configured in settings, apply it
    if (settings.downloadPath && fs.existsSync(settings.downloadPath)) {
      item.setSavePath(path.join(settings.downloadPath, filename))
    }

    activeItems.set(id, item)

    const downloadRecord = {
      id,
      filename,
      savePath: item.getSavePath(),
      receivedBytes: 0,
      totalBytes,
      state: 'progressing',
      speed: 0,
      eta: null,
      startTime,
      url: item.getURL(),
      mimeType: item.getMimeType(),
      fileType,
      isPaused: false,
      connections: 1,
      turboMode: false,
      speedLimitKB,
    }

    downloads.set(id, downloadRecord)
    sendUpdate(downloadRecord)

    // Notify NeXusWeb Renderer for Smart Download Routing (Local PC vs. Direct Server)
    const win = typeof mainWindowRef === 'function' ? mainWindowRef() : mainWindowRef
    if (win && !win.isDestroyed()) {
      win.webContents.send('download-intercepted', {
        id,
        filename,
        url: item.getURL(),
        totalBytes,
        mimeType: item.getMimeType(),
      })
    }

    let lastBytes = 0
    let lastTime = Date.now()

    item.on('updated', (e, state) => {
      const now = Date.now()
      const timeDiff = (now - lastTime) / 1000
      const currentBytes = item.getReceivedBytes()
      const byteDiff = currentBytes - lastBytes

      if (timeDiff > 0.4) {
        const speed = Math.max(0, Math.round(byteDiff / timeDiff))
        downloadRecord.speed = speed
        if (speed > 0 && downloadRecord.totalBytes > currentBytes) {
          const remSec = (downloadRecord.totalBytes - currentBytes) / speed
          downloadRecord.eta = formatEta(remSec)
        } else {
          downloadRecord.eta = null
        }
        lastBytes = currentBytes
        lastTime = now
      }

      downloadRecord.receivedBytes = currentBytes
      downloadRecord.totalBytes = item.getTotalBytes()
      downloadRecord.savePath = item.getSavePath()
      downloadRecord.isPaused = item.isPaused()
      downloadRecord.state = item.isPaused() ? 'paused' : state

      sendUpdate(downloadRecord)
    })

    item.once('done', (e, state) => {
      activeItems.delete(id)
      downloadRecord.state = state
      downloadRecord.receivedBytes = item.getReceivedBytes()
      downloadRecord.savePath = item.getSavePath()
      downloadRecord.speed = 0
      downloadRecord.eta = null
      downloadRecord.isPaused = false
      sendUpdate(downloadRecord)
    })
  })
}

// Add a Dynamic Multi-Part Segmentation Download
function addMultiPartDownload(url, customFilename = null, connections = 8, speedLimitKB = 0) {
  const settings = getSettings()
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 4)
  const defaultDir = settings.downloadPath || app.getPath('downloads')
  const filename = customFilename || path.basename(new URL(url).pathname) || `download_${id}.bin`
  const savePath = path.join(defaultDir, filename)
  const limit = speedLimitKB || settings.downloadSpeedLimitKB || 0
  const maxConn = connections || settings.maxDownloadConnections || 8

  const downloadRecord = {
    id,
    filename,
    savePath,
    receivedBytes: 0,
    totalBytes: 0,
    state: 'progressing',
    speed: 0,
    eta: null,
    startTime: Date.now(),
    url,
    mimeType: '',
    fileType: getFileType(filename),
    isPaused: false,
    connections: maxConn,
    turboMode: true,
    speedLimitKB: limit,
    segments: [],
  }

  downloads.set(id, downloadRecord)
  sendUpdate(downloadRecord)

  const engine = new DynamicSegmentDownloader({
    id,
    url,
    savePath,
    connections: maxConn,
    speedLimitKB: limit,
    onUpdate: (upd) => {
      Object.assign(downloadRecord, upd)
      sendUpdate(downloadRecord)
    },
    onDone: (finalState) => {
      multiPartEngines.delete(id)
      downloadRecord.state = finalState
      downloadRecord.speed = 0
      downloadRecord.eta = null
      downloadRecord.isPaused = false
      sendUpdate(downloadRecord)
    },
  })

  multiPartEngines.set(id, engine)
  engine.start()
  return downloadRecord
}

function sendUpdate(record) {
  const win = typeof mainWindowRef === 'function' ? mainWindowRef() : mainWindowRef
  win?.webContents.send('download-updated', record)
}

function getDownloadsList() {
  return [...downloads.values()].reverse()
}

function pauseDownload(id) {
  // Check multi-part engine
  if (multiPartEngines.has(id)) {
    return multiPartEngines.get(id).pause()
  }
  // Check Electron active item
  const item = activeItems.get(id)
  if (item && !item.isPaused()) {
    item.pause()
    const rec = downloads.get(id)
    if (rec) {
      rec.state = 'paused'
      rec.isPaused = true
      rec.speed = 0
      rec.eta = null
      sendUpdate(rec)
    }
    return { success: true }
  }
  return { success: false, error: 'Item cannot be paused' }
}

function resumeDownload(id) {
  if (multiPartEngines.has(id)) {
    return multiPartEngines.get(id).resume()
  }
  const item = activeItems.get(id)
  if (item && item.canResume()) {
    item.resume()
    const rec = downloads.get(id)
    if (rec) {
      rec.state = 'progressing'
      rec.isPaused = false
      sendUpdate(rec)
    }
    return { success: true }
  }
  return { success: false, error: 'Item cannot be resumed' }
}

function cancelDownload(id) {
  if (multiPartEngines.has(id)) {
    const res = multiPartEngines.get(id).cancel()
    multiPartEngines.delete(id)
    return res
  }
  const item = activeItems.get(id)
  if (item) {
    item.cancel()
    activeItems.delete(id)
    const rec = downloads.get(id)
    if (rec) {
      rec.state = 'cancelled'
      rec.speed = 0
      rec.eta = null
      sendUpdate(rec)
    }
    return { success: true }
  }
  return { success: false, error: 'Item not active' }
}

function removeDownload(id) {
  if (multiPartEngines.has(id)) {
    try { multiPartEngines.get(id).cancel() } catch (e) {}
    multiPartEngines.delete(id)
  }
  const item = activeItems.get(id)
  if (item) {
    try { item.cancel() } catch (e) {}
    activeItems.delete(id)
  }
  downloads.delete(id)
  return getDownloadsList()
}

function openDownloadedFile(id) {
  const item = downloads.get(id)
  if (item && item.savePath && item.state === 'completed') {
    shell.openPath(item.savePath)
    return { success: true }
  }
  return { success: false, error: 'File not found or not completed' }
}

function showInFolder(id) {
  const item = downloads.get(id)
  if (item && item.savePath) {
    shell.showItemInFolder(item.savePath)
    return { success: true }
  }
  return { success: false, error: 'File not found' }
}

function copyDownloadUrl(id) {
  const item = downloads.get(id)
  if (item && item.url) {
    clipboard.writeText(item.url)
    return { success: true }
  }
  return { success: false, error: 'No URL available' }
}

async function selectDownloadFolder() {
  const win = typeof mainWindowRef === 'function' ? mainWindowRef() : mainWindowRef
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Default Downloads Folder',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: app.getPath('downloads'),
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] }
  }
  return { success: false }
}

function clearCompletedDownloads() {
  for (const [id, item] of downloads.entries()) {
    if (item.state === 'completed' || item.state === 'cancelled' || item.state === 'interrupted') {
      downloads.delete(id)
    }
  }
  return getDownloadsList()
}

function resolveInterceptedDownload({ action, id }) {
  if (action === 'cancel') {
    const item = activeItems.get(id)
    if (item) {
      try { item.cancel() } catch (e) {}
      activeItems.delete(id)
    }
    downloads.delete(id)
    return { success: true }
  }
  return { success: true }
}

module.exports = {
  initDownloadManager,
  addMultiPartDownload,
  getDownloadsList,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  removeDownload,
  openDownloadedFile,
  showInFolder,
  copyDownloadUrl,
  selectDownloadFolder,
  clearCompletedDownloads,
  resolveInterceptedDownload,
}
