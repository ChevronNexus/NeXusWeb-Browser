/**
 * multiPartDownloader.js
 * High-Performance Dynamic Multi-Part Segmentation Engine for NeXusWeb V7.1.0
 * 
 * Features:
 * 1. Dynamic Multi-Part Segmentation: Automatically splits largest remaining unfinished chunk in half when a connection finishes early.
 * 2. Connection Reuse: Uses keep-alive HTTP/HTTPS agent to prevent repeated handshakes.
 * 3. Resuming & Rebuilding: Persists state to `.nexusdownload` manifest for instant crash recovery and range resume.
 * 4. Bandwidth Throttler: Regulates download chunk flow to protect browsing/streaming.
 */

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 30000 })

class DynamicSegmentDownloader {
  constructor({ id, url, savePath, connections = 8, speedLimitKB = 0, onUpdate, onDone }) {
    this.id = id
    this.url = url
    this.savePath = savePath
    this.statePath = `${savePath}.nexusdownload`
    this.maxConnections = Math.max(1, Math.min(16, connections || 8))
    this.speedLimitBytesPerSec = (speedLimitKB || 0) * 1024 // 0 = unlimited
    this.onUpdate = onUpdate
    this.onDone = onDone

    this.totalBytes = 0
    this.receivedBytes = 0
    this.segments = [] // [{ id, start, end, downloaded, active, completed }]
    this.activeWorkers = new Map() // workerId -> { req, stream }
    this.state = 'idle' // 'idle' | 'progressing' | 'paused' | 'completed' | 'cancelled' | 'failed'
    this.startTime = Date.now()
    this.speed = 0
    this.fd = null
    this.supportsRange = false
    this.isDestroyed = false

    // Throttler trackers
    this.throttleWindowStart = Date.now()
    this.throttleBytesInWindow = 0
  }

  async start() {
    this.state = 'progressing'
    this.startTime = Date.now()

    try {
      // 1. Check if previous state file exists for resuming
      if (fs.existsSync(this.statePath) && fs.existsSync(this.savePath)) {
        try {
          const raw = fs.readFileSync(this.statePath, 'utf8')
          const saved = JSON.parse(raw)
          if (saved.url === this.url && saved.totalBytes > 0) {
            this.totalBytes = saved.totalBytes
            this.segments = saved.segments
            this.supportsRange = true
            this.receivedBytes = this.segments.reduce((acc, s) => acc + s.downloaded, 0)
            this.fd = fs.openSync(this.savePath, 'r+')
            this.spawnWorkers()
            return
          }
        } catch (e) {
          console.warn('[Downloader] Failed to read saved state, starting fresh:', e.message)
        }
      }

      // 2. Fetch File Headers (Content-Length, Accept-Ranges)
      const info = await this.probeUrl(this.url)
      this.totalBytes = info.contentLength
      this.supportsRange = info.supportsRange

      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.savePath), { recursive: true })

      if (this.supportsRange && this.totalBytes > 1024 * 512) {
        // Pre-allocate file on disk
        this.fd = fs.openSync(this.savePath, 'w+')
        try {
          fs.ftruncateSync(this.fd, this.totalBytes)
        } catch (e) {}

        // Initial Segmentation
        const numSegs = Math.min(this.maxConnections, Math.max(1, Math.ceil(this.totalBytes / (1024 * 1024 * 2))))
        const chunkSize = Math.floor(this.totalBytes / numSegs)
        this.segments = []

        for (let i = 0; i < numSegs; i++) {
          const start = i * chunkSize
          const end = i === numSegs - 1 ? this.totalBytes - 1 : (i + 1) * chunkSize - 1
          this.segments.push({
            id: i,
            start,
            end,
            downloaded: 0,
            active: false,
            completed: false,
          })
        }

        this.saveState()
        this.spawnWorkers()
      } else {
        // Fallback to single stream download if range is not supported
        this.downloadSingleStream()
      }
    } catch (err) {
      this.state = 'failed'
      this.notifyUpdate(err.message)
      this.onDone?.(this.state, err.message)
    }
  }

  probeUrl(targetUrl) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl)
      const client = parsed.protocol === 'https:' ? https : http
      const agent = parsed.protocol === 'https:' ? httpsAgent : httpAgent

      const req = client.request(targetUrl, {
        method: 'HEAD',
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NeXusWeb/7.1.0',
          'Accept-Encoding': 'identity',
        },
      }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href
          return resolve(this.probeUrl(redirectUrl))
        }

        const contentLength = parseInt(res.headers['content-length'] || '0', 10)
        const acceptRanges = res.headers['accept-ranges']
        const supportsRange = acceptRanges === 'bytes' || !!res.headers['content-range'] || (contentLength > 0 && res.statusCode === 200)

        resolve({
          contentLength,
          supportsRange: supportsRange && contentLength > 0,
        })
      })

      req.on('error', (err) => {
        // If HEAD fails, fallback to GET probe
        this.probeUrlGet(targetUrl).then(resolve).catch(reject)
      })
      req.setTimeout(8000, () => {
        req.destroy()
        this.probeUrlGet(targetUrl).then(resolve).catch(reject)
      })
      req.end()
    })
  }

  probeUrlGet(targetUrl) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl)
      const client = parsed.protocol === 'https:' ? https : http
      const agent = parsed.protocol === 'https:' ? httpsAgent : httpAgent

      const req = client.request(targetUrl, {
        method: 'GET',
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NeXusWeb/7.1.0',
          'Range': 'bytes=0-0',
        },
      }, (res) => {
        const contentRange = res.headers['content-range']
        let contentLength = 0
        if (contentRange) {
          const m = contentRange.match(/\/(\d+)/)
          if (m) contentLength = parseInt(m[1], 10)
        } else {
          contentLength = parseInt(res.headers['content-length'] || '0', 10)
        }
        res.destroy()
        resolve({
          contentLength,
          supportsRange: res.statusCode === 206 || !!contentRange,
        })
      })
      req.on('error', reject)
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('Connection timed out')) })
      req.end()
    })
  }

  spawnWorkers() {
    if (this.state !== 'progressing' || this.isDestroyed) return

    // Find incomplete segments
    const unassigned = this.segments.filter(s => !s.completed && !s.active)
    for (const seg of unassigned) {
      if (this.activeWorkers.size >= this.maxConnections) break
      this.startSegmentWorker(seg)
    }

    // If there are idle connection slots and no unassigned segments, dynamic re-segmentation!
    if (this.activeWorkers.size < this.maxConnections) {
      this.splitLargestSegment()
    }
  }

  // Dynamic Multi-Part Segmentation: Split the largest remaining unfinished segment in half
  splitLargestSegment() {
    if (this.activeWorkers.size >= this.maxConnections) return

    // Find the active segment with the largest remaining bytes
    let largest = null
    let maxRemaining = 1024 * 512 // Only split if at least 512 KB remaining

    for (const seg of this.segments) {
      if (seg.active && !seg.completed) {
        const remaining = (seg.end - seg.start + 1) - seg.downloaded
        if (remaining > maxRemaining) {
          maxRemaining = remaining
          largest = seg
        }
      }
    }

    if (!largest) return

    const currentOffset = largest.start + largest.downloaded
    const remainingBytes = largest.end - currentOffset + 1
    const halfBytes = Math.floor(remainingBytes / 2)

    if (halfBytes < 1024 * 256) return // Don't make chunks smaller than 256 KB

    const newStart = currentOffset + halfBytes
    const newEnd = largest.end

    // Adjust current segment's end
    largest.end = newStart - 1

    // Create new segment
    const newSegment = {
      id: this.segments.length,
      start: newStart,
      end: newEnd,
      downloaded: 0,
      active: false,
      completed: false,
    }

    this.segments.push(newSegment)
    this.saveState()

    // Immediately assign worker to new segment
    this.startSegmentWorker(newSegment)
  }

  startSegmentWorker(seg) {
    if (this.state !== 'progressing' || this.isDestroyed) return

    seg.active = true
    const workerId = `worker_${seg.id}_${Date.now()}`
    const startByte = seg.start + seg.downloaded
    const endByte = seg.end

    if (startByte > endByte) {
      seg.completed = true
      seg.active = false
      this.checkCompletion()
      return
    }

    const parsed = new URL(this.url)
    const client = parsed.protocol === 'https:' ? https : http
    const agent = parsed.protocol === 'https:' ? httpsAgent : httpAgent

    const req = client.request(this.url, {
      method: 'GET',
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NeXusWeb/7.1.0',
        'Range': `bytes=${startByte}-${endByte}`,
        'Accept-Encoding': 'identity',
      },
    }, (res) => {
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        seg.active = false
        this.activeWorkers.delete(workerId)
        return
      }

      let currentFilePos = startByte

      res.on('data', (chunk) => {
        if (this.state !== 'progressing' || this.isDestroyed) {
          res.destroy()
          return
        }

        // Apply Bandwidth Throttler if configured
        this.applyThrottle(chunk.length)

        try {
          fs.writeSync(this.fd, chunk, 0, chunk.length, currentFilePos)
          currentFilePos += chunk.length
          seg.downloaded += chunk.length
          this.receivedBytes += chunk.length
          this.notifyUpdate()
        } catch (e) {
          console.error('[Downloader] Write error:', e.message)
        }
      })

      res.on('end', () => {
        seg.active = false
        seg.completed = true
        this.activeWorkers.delete(workerId)
        this.saveState()
        this.checkCompletion()
        this.spawnWorkers() // Re-check if other segments can be split
      })

      res.on('error', (err) => {
        seg.active = false
        this.activeWorkers.delete(workerId)
        // Retry worker on failure
        setTimeout(() => this.spawnWorkers(), 1000)
      })
    })

    req.on('error', (err) => {
      seg.active = false
      this.activeWorkers.delete(workerId)
      setTimeout(() => this.spawnWorkers(), 1000)
    })

    this.activeWorkers.set(workerId, { req })
    req.end()
  }

  downloadSingleStream() {
    const parsed = new URL(this.url)
    const client = parsed.protocol === 'https:' ? https : http
    const agent = parsed.protocol === 'https:' ? httpsAgent : httpAgent
    const outStream = fs.createWriteStream(this.savePath)

    const req = client.request(this.url, {
      method: 'GET',
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NeXusWeb/7.1.0',
        'Accept-Encoding': 'identity',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, this.url).href
        this.url = nextUrl
        return this.downloadSingleStream()
      }

      this.totalBytes = parseInt(res.headers['content-length'] || '0', 10)

      res.on('data', (chunk) => {
        if (this.state !== 'progressing') {
          res.destroy()
          return
        }
        this.applyThrottle(chunk.length)
        this.receivedBytes += chunk.length
        this.notifyUpdate()
      })

      res.pipe(outStream)

      outStream.on('finish', () => {
        this.state = 'completed'
        this.notifyUpdate()
        this.onDone?.('completed')
      })

      outStream.on('error', (err) => {
        this.state = 'failed'
        this.notifyUpdate(err.message)
        this.onDone?.('failed', err.message)
      })
    })

    req.on('error', (err) => {
      this.state = 'failed'
      this.notifyUpdate(err.message)
      this.onDone?.('failed', err.message)
    })

    this.activeWorkers.set('single', { req })
    req.end()
  }

  applyThrottle(chunkBytes) {
    if (this.speedLimitBytesPerSec <= 0) return

    this.throttleBytesInWindow += chunkBytes
    const now = Date.now()
    const elapsedSec = (now - this.throttleWindowStart) / 1000

    if (elapsedSec >= 1) {
      this.throttleWindowStart = now
      this.throttleBytesInWindow = 0
    } else if (this.throttleBytesInWindow > this.speedLimitBytesPerSec) {
      // Sleep briefly synchronously or slow down
      const sleepMs = Math.min(200, Math.ceil((1 - elapsedSec) * 1000))
      const targetTime = Date.now() + sleepMs
      while (Date.now() < targetTime) {}
    }
  }

  checkCompletion() {
    const allDone = this.segments.length > 0 && this.segments.every(s => s.completed)
    if (allDone) {
      this.state = 'completed'
      if (this.fd) {
        try { fs.closeSync(this.fd) } catch (e) {}
        this.fd = null
      }
      // Remove temporary state file on completion
      try {
        if (fs.existsSync(this.statePath)) fs.unlinkSync(this.statePath)
      } catch (e) {}

      this.notifyUpdate()
      this.onDone?.('completed')
    }
  }

  saveState() {
    if (!this.supportsRange || this.segments.length === 0 || this.state === 'completed') return
    try {
      const data = JSON.stringify({
        url: this.url,
        savePath: this.savePath,
        totalBytes: this.totalBytes,
        segments: this.segments,
        updatedAt: Date.now(),
      }, null, 2)
      fs.writeFileSync(this.statePath, data, 'utf8')
    } catch (e) {}
  }

  pause() {
    this.state = 'paused'
    this.abortAllWorkers()
    this.saveState()
    this.notifyUpdate()
    return { success: true }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'progressing'
      this.spawnWorkers()
      this.notifyUpdate()
      return { success: true }
    }
    return { success: false, error: 'Not paused' }
  }

  cancel() {
    this.state = 'cancelled'
    this.abortAllWorkers()
    if (this.fd) {
      try { fs.closeSync(this.fd) } catch (e) {}
      this.fd = null
    }
    try {
      if (fs.existsSync(this.statePath)) fs.unlinkSync(this.statePath)
    } catch (e) {}
    this.notifyUpdate()
    return { success: true }
  }

  setSpeedLimit(limitKB) {
    this.speedLimitBytesPerSec = (limitKB || 0) * 1024
  }

  abortAllWorkers() {
    for (const [id, worker] of this.activeWorkers.entries()) {
      try {
        worker.req?.destroy?.()
      } catch (e) {}
    }
    this.activeWorkers.clear()
    for (const seg of this.segments) {
      seg.active = false
    }
  }

  notifyUpdate(errorMessage = null) {
    const percent = this.totalBytes > 0 ? Math.min(100, Math.round((this.receivedBytes / this.totalBytes) * 100)) : 0
    const now = Date.now()
    const timeDiff = (now - this.startTime) / 1000
    this.speed = timeDiff > 0.5 ? Math.round(this.receivedBytes / timeDiff) : 0

    let eta = null
    if (this.speed > 0 && this.totalBytes > this.receivedBytes) {
      const remSec = (this.totalBytes - this.receivedBytes) / this.speed
      if (remSec < 60) eta = `${Math.ceil(remSec)}s left`
      else {
        const m = Math.floor(remSec / 60)
        const s = Math.ceil(remSec % 60)
        eta = `${m}m ${s}s left`
      }
    }

    this.onUpdate?.({
      id: this.id,
      url: this.url,
      savePath: this.savePath,
      filename: path.basename(this.savePath),
      totalBytes: this.totalBytes,
      receivedBytes: this.receivedBytes,
      state: this.state,
      speed: this.speed,
      eta,
      isPaused: this.state === 'paused',
      connections: this.activeWorkers.size,
      maxConnections: this.maxConnections,
      segments: this.segments.map(s => ({
        id: s.id,
        progress: (s.end - s.start + 1) > 0 ? Math.min(100, Math.round((s.downloaded / (s.end - s.start + 1)) * 100)) : 0,
        active: s.active,
        completed: s.completed,
      })),
      error: errorMessage,
    })
  }
}

module.exports = {
  DynamicSegmentDownloader,
}
