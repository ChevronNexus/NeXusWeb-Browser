const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

let WebSocketClient = typeof WebSocket !== 'undefined' ? WebSocket : (globalThis.WebSocket || null)
try {
  const wsPkg = require('ws')
  WebSocketClient = wsPkg.WebSocket || wsPkg
} catch (e) {}

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8080'

// 12-Word BIP39 Wordlist subset for offline mnemonic recovery phrases
const MNEMONIC_WORDS = [
  'alpha', 'beacon', 'cipher', 'delta', 'echo', 'falcon', 'galaxy', 'harbor',
  'iron', 'jupiter', 'knight', 'legend', 'matrix', 'nexus', 'omega', 'phoenix',
  'quantum', 'radar', 'shadow', 'titan', 'uranus', 'vector', 'whisper', 'zenith',
  'anchor', 'breeze', 'castle', 'dragon', 'eagle', 'forest', 'glacier', 'horizon',
  'island', 'jungle', 'kingdom', 'lagoon', 'monarch', 'nebula', 'ocean', 'palace',
  'quest', 'river', 'summit', 'temple', 'universe', 'valley', 'warrior', 'yacht'
]

function generateMnemonicPhrase(wordCount = 12) {
  const words = []
  for (let i = 0; i < wordCount; i++) {
    const idx = crypto.randomInt(0, MNEMONIC_WORDS.length)
    words.push(MNEMONIC_WORDS[idx])
  }
  return words.join(' ')
}

class SyncManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath
    this.configPath = path.join(userDataPath, 'chevronnexus_sync_config.json')
    this.serverUrl = DEFAULT_SERVER_URL
    this.session = null
    this.masterEncryptionKey = null // Never leaves device
    this.ws = null
    this.isSyncing = false
    this.lastSyncTimestamp = 0
    this.syncListeners = new Set()
    this.receivedTabListeners = new Set()
    this.loadConfig()
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf8')
        const data = JSON.parse(raw)
        this.serverUrl = data.serverUrl || DEFAULT_SERVER_URL
        this.session = data.session || null
        this.lastSyncTimestamp = data.lastSyncTimestamp || 0
        this.syncOptions = data.syncOptions || {
          bookmarks: true,
          passwords: true,
          history: true,
          tabs: true,
          notes: true,
          settings: true,
          extensions: true,
        }
      } catch (e) {
        console.error('[SyncManager] Error loading config:', e.message)
      }
    }
  }

  saveConfig() {
    try {
      const data = {
        serverUrl: this.serverUrl,
        session: this.session,
        lastSyncTimestamp: this.lastSyncTimestamp,
        syncOptions: this.syncOptions || {
          bookmarks: true,
          passwords: true,
          history: true,
          tabs: true,
          notes: true,
          settings: true,
          extensions: true,
        },
      }
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8')
    } catch (e) {
      console.error('[SyncManager] Error saving config:', e.message)
    }
  }

  setServerUrl(url) {
    this.serverUrl = (url || DEFAULT_SERVER_URL).replace(/\/$/, '')
    this.saveConfig()
    this.reconnectWebSocket()
    return this.serverUrl
  }

  // ── Cryptography (Zero-Knowledge Key Derivation & AES-256-GCM) ───────────

  deriveKeys(masterPassword, salt, rounds = 600000) {
    // 1. Derive 64-byte master key via PBKDF2 (600,000 rounds)
    const derivedKey = crypto.pbkdf2Sync(masterPassword, salt, rounds, 64, 'sha256')
    // Split into 32 bytes for Encryption (KEK) + 32 bytes for Authentication (AuthKey)
    const encryptionKey = derivedKey.subarray(0, 32)
    const authHashKey = derivedKey.subarray(32, 64).toString('hex')
    return { encryptionKey, authHashKey }
  }

  encryptData(plainObj, key = this.masterEncryptionKey) {
    if (!key) throw new Error('Master encryption key is not set on client')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const jsonStr = JSON.stringify(plainObj)
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    return {
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
      ciphertext: encrypted,
    }
  }

  decryptData(encryptedBlob, key = this.masterEncryptionKey) {
    if (!key) throw new Error('Master encryption key is not set on client')
    if (typeof encryptedBlob === 'string') {
      try { encryptedBlob = JSON.parse(encryptedBlob) } catch (e) {}
    }
    const { iv, tag, ciphertext } = encryptedBlob
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return JSON.parse(decrypted)
  }

  // ── HTTP API Request Helper ───────────────────────────────────────────────

  async apiRequest(endpoint, method = 'GET', body = null) {
    const urlObj = new URL(`${this.serverUrl}${endpoint}`)
    const isHttps = urlObj.protocol === 'https:'
    const lib = isHttps ? https : http

    const payload = body ? JSON.stringify(body) : null
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'NeXusWeb-Sync-Client/9.0.1',
    }

    if (this.session && this.session.token) {
      headers['Authorization'] = `Bearer ${this.session.token}`
    }
    if (this.session && this.session.deviceId) {
      headers['X-Device-Id'] = this.session.deviceId
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload)
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(urlObj, {
        method,
        headers,
        timeout: 10000,
      }, (res) => {
        let raw = ''
        res.on('data', chunk => raw += chunk)
        res.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (res.statusCode === 403 && data.wiped) {
              this.handleRemoteWipe()
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data)
            } else {
              reject(new Error(data.error || `HTTP ${res.statusCode}`))
            }
          } catch (e) {
            reject(new Error(`Invalid server response: ${raw.slice(0, 100)}`))
          }
        })
      })

      req.on('error', (err) => reject(new Error(`Connection to sync server failed: ${err.message}`)))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Sync server connection timed out'))
      })

      if (payload) req.write(payload)
      req.end()
    })
  }

  // ── Account Lifecycle (Register, Login, 2FA, Logout) ──────────────────────

  async getAuthParams(email) {
    return this.apiRequest('/api/auth/params', 'POST', { email })
  }

  async register({ email, masterPassword, deviceName }) {
    const salt = crypto.randomBytes(16).toString('hex')
    const { encryptionKey, authHashKey } = this.deriveKeys(masterPassword, salt)
    const recoveryPhrase = generateMnemonicPhrase(12)
    const recoveryPhraseHash = crypto.createHash('sha256').update(recoveryPhrase).digest('hex')

    const res = await this.apiRequest('/api/auth/register', 'POST', {
      email,
      authSalt: salt,
      authHashKey,
      kdfRounds: 600000,
      recoveryPhraseHash,
      deviceName: deviceName || 'Windows PC',
      deviceType: 'desktop',
      os: process.platform === 'win32' ? 'Windows' : (process.platform === 'linux' ? 'Linux' : 'Android'),
    })

    if (res.success) {
      this.masterEncryptionKey = encryptionKey
      this.session = {
        userId: res.userId,
        deviceId: res.deviceId,
        token: res.token,
        email: res.email,
        recoveryPhrase, // Returned on creation for user to write down
      }
      this.saveConfig()
      this.connectWebSocket()
      this.notifyListeners({ status: 'connected', email: res.email })
    }

    return { ...res, recoveryPhrase }
  }

  async login({ email, masterPassword, totpCode, deviceName }) {
    const params = await this.getAuthParams(email)
    if (!params.success) throw new Error('Could not fetch authentication parameters')

    const { encryptionKey, authHashKey } = this.deriveKeys(masterPassword, params.authSalt, params.kdfRounds || 600000)

    const res = await this.apiRequest('/api/auth/login', 'POST', {
      email,
      authHashKey,
      totpCode: totpCode || undefined,
      deviceName: deviceName || 'Windows PC',
      deviceType: 'desktop',
      os: process.platform === 'win32' ? 'Windows' : 'Linux',
    })

    if (res.requires2FA) {
      return { success: false, requires2FA: true, message: res.message }
    }

    if (res.success) {
      this.masterEncryptionKey = encryptionKey
      this.session = {
        userId: res.userId,
        deviceId: res.deviceId,
        token: res.token,
        email: res.email,
      }
      this.saveConfig()
      this.connectWebSocket()
      this.notifyListeners({ status: 'connected', email: res.email })
    }

    return res
  }

  logout() {
    this.session = null
    this.masterEncryptionKey = null
    if (this.ws) {
      try { this.ws.close() } catch (e) {}
      this.ws = null
    }
    this.saveConfig()
    this.notifyListeners({ status: 'logged_out' })
    return { success: true }
  }

  async setup2FA() {
    if (!this.session || !this.session.token) {
      return { success: false, error: 'Please create an account or sign in to your vault first before configuring 2FA.' }
    }
    try {
      return await this.apiRequest('/api/auth/2fa/setup', 'POST')
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async verify2FA(code) {
    if (!this.session || !this.session.token) {
      return { success: false, error: 'Please create an account or sign in to your vault first.' }
    }
    try {
      return await this.apiRequest('/api/auth/2fa/verify', 'POST', { code })
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async getDevices() {
    return this.apiRequest('/api/devices', 'GET')
  }

  async revokeDevice(deviceId) {
    return this.apiRequest('/api/devices/revoke', 'POST', { deviceId })
  }

  async wipeDevice(deviceId) {
    return this.apiRequest('/api/devices/wipe', 'POST', { deviceId })
  }

  async getStatus() {
    if (!this.session) {
      return {
        signedIn: false,
        serverUrl: this.serverUrl,
        lastSyncTimestamp: this.lastSyncTimestamp,
      }
    }

    try {
      const res = await this.apiRequest('/api/sync/status', 'GET')
      return {
        signedIn: true,
        serverUrl: this.serverUrl,
        email: this.session.email,
        deviceId: this.session.deviceId,
        lastSyncTimestamp: this.lastSyncTimestamp,
        ...res,
      }
    } catch (e) {
      return {
        signedIn: true,
        offline: true,
        serverUrl: this.serverUrl,
        email: this.session.email,
        deviceId: this.session.deviceId,
        lastSyncTimestamp: this.lastSyncTimestamp,
        error: e.message,
      }
    }
  }

  // ── Sync Execution (Pull & Push Local Data) ───────────────────────────────

  async syncNow(localDataCollectors = {}) {
    if (!this.session || !this.masterEncryptionKey || this.isSyncing) return
    this.isSyncing = true
    this.notifyListeners({ status: 'syncing' })

    try {
      // 1. Pull changes from server since last sync
      const pullRes = await this.apiRequest('/api/sync/pull', 'POST', {
        sinceTimestamp: this.lastSyncTimestamp,
      })

      const incomingItems = []
      if (pullRes && pullRes.items) {
        for (const item of pullRes.items) {
          try {
            const decrypted = this.decryptData(item.encryptedPayload)
            incomingItems.push({
              collection: item.collection,
              id: item.id,
              data: decrypted,
              modifiedAt: item.modifiedAt,
            })
          } catch (e) {
            console.warn(`[SyncManager] Decryption error on ${item.collection}:${item.id}`, e.message)
          }
        }
      }

      // 2. Apply incoming items to local database via callback
      if (localDataCollectors.applyIncoming && incomingItems.length > 0) {
        await localDataCollectors.applyIncoming(incomingItems, pullRes.tombstones || [])
      }

      // 3. Collect modified local items to push
      const itemsToPush = []
      if (localDataCollectors.getLocalModified) {
        const localModified = await localDataCollectors.getLocalModified(this.lastSyncTimestamp)
        for (const localItem of localModified) {
          const encrypted = this.encryptData(localItem.data)
          itemsToPush.push({
            collection: localItem.collection,
            id: localItem.id,
            encryptedPayload: JSON.stringify(encrypted),
            version: localItem.version || 1,
            modifiedAt: localItem.modifiedAt || Date.now(),
          })
        }
      }

      // 4. Push local changes
      if (itemsToPush.length > 0) {
        await this.apiRequest('/api/sync/push', 'POST', { items: itemsToPush })
      }

      this.lastSyncTimestamp = pullRes?.serverTimestamp || Date.now()
      this.saveConfig()
      this.notifyListeners({ status: 'synced', timestamp: this.lastSyncTimestamp, count: incomingItems.length + itemsToPush.length })
      return { success: true, pulled: incomingItems.length, pushed: itemsToPush.length }
    } catch (e) {
      console.error('[SyncManager] Sync failed:', e.message)
      this.notifyListeners({ status: 'error', error: e.message })
      throw e
    } finally {
      this.isSyncing = false
    }
  }

  // ── Send Tab to Connected Device ──────────────────────────────────────────

  async sendTabToDevice(targetDeviceId, tabData) {
    if (!this.session || !this.masterEncryptionKey) throw new Error('Must be signed in to send tab')
    const encryptedPayload = this.encryptData(tabData)
    return this.apiRequest('/api/sync/send-tab', 'POST', {
      targetDeviceId,
      encryptedTabPayload: JSON.stringify(encryptedPayload),
    })
  }

  // ── Real-Time WebSocket Channel ───────────────────────────────────────────

  connectWebSocket() {
    if (!this.session || !this.session.token || !WebSocketClient) return
    if (this.ws && (this.ws.readyState === 1 || this.ws.readyState === WebSocketClient.OPEN)) return

    try {
      const wsUrl = this.serverUrl.replace(/^http/, 'ws') + `/api/sync/ws?token=${encodeURIComponent(this.session.token)}`
      this.ws = new WebSocketClient(wsUrl)

      this.ws.on?.('open', () => {
        console.log('[SyncManager] Real-time WebSocket connected to ChevronNexus Sync')
      })

      this.ws.on('message', (msg) => {
        try {
          const event = JSON.parse(msg.toString())
          if (event.event === 'invalidation' || event.type === 'sync-changed') {
            // Another device committed data, trigger instant background delta sync
            this.syncNow()
          } else if (event.event === 'tab_received' || event.type === 'received-tab') {
            const tabData = event.tab || (event.encryptedTabPayload ? this.decryptData(event.encryptedTabPayload) : null)
            if (tabData) this.notifyReceivedTab(tabData)
          } else if (event.event === 'remote_wipe' || event.type === 'wipe-command') {
            this.handleRemoteWipe()
          }
        } catch (e) {}
      })

      this.ws.on('close', () => {
        this.ws = null
        // Reconnect backoff
        setTimeout(() => this.connectWebSocket(), 15000)
      })

      this.ws.on('error', () => {})
    } catch (e) {
      console.warn('[SyncManager] WebSocket init error:', e.message)
    }
  }

  reconnectWebSocket() {
    if (this.ws) {
      try { this.ws.close() } catch (e) {}
      this.ws = null
    }
    this.connectWebSocket()
  }

  handleRemoteWipe() {
    console.warn('[SyncManager] REMOTE WIPE COMMAND RECEIVED! Purging all local session and sync state.')
    this.logout()
    // Signal UI to clear local browsing cache
    this.notifyListeners({ status: 'wiped', message: 'This device was remotely erased by account owner.' })
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  onSyncUpdate(callback) {
    this.syncListeners.add(callback)
    return () => this.syncListeners.delete(callback)
  }

  notifyListeners(data) {
    for (const listener of this.syncListeners) {
      try { listener(data) } catch (e) {}
    }
  }

  onReceivedTab(callback) {
    this.receivedTabListeners.add(callback)
    return () => this.receivedTabListeners.delete(callback)
  }

  notifyReceivedTab(tab) {
    for (const listener of this.receivedTabListeners) {
      try { listener(tab) } catch (e) {}
    }
  }
}

module.exports = SyncManager
