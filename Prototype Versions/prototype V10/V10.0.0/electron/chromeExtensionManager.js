const https = require('https')
const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')

class ChromeExtensionManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath
    this.extensionsDir = path.join(userDataPath, 'installed_extensions')
    this.dbFile = path.join(userDataPath, 'installed_extensions.json')
    this.loadedExtensions = new Map()

    if (!fs.existsSync(this.extensionsDir)) {
      try { fs.mkdirSync(this.extensionsDir, { recursive: true }) } catch (e) {}
    }
  }

  getDb() {
    try {
      if (fs.existsSync(this.dbFile)) {
        return JSON.parse(fs.readFileSync(this.dbFile, 'utf8'))
      }
    } catch (e) {}
    return []
  }

  saveDb(list) {
    try {
      fs.writeFileSync(this.dbFile, JSON.stringify(list, null, 2), 'utf8')
    } catch (e) {}
  }

  extractExtensionId(input) {
    if (!input || typeof input !== 'string') return null
    const trimmed = input.trim()
    // Direct 32-char ID
    if (/^[a-z0-9]{32}$/i.test(trimmed)) {
      return trimmed.toLowerCase()
    }
    // Web store URL: .../detail/.../omghfjlpggmjjaagoclmmobgdodcjboh...
    const match = trimmed.match(/\/([a-z0-9]{32})(?:[\/?#]|$)/i)
    if (match && match[1]) {
      return match[1].toLowerCase()
    }
    // Direct id query parameter: ...?id=omghfjlpggmjjaagoclmmobgdodcjboh
    const matchQuery = trimmed.match(/[?&]id=([a-z0-9]{32})/i)
    if (matchQuery && matchQuery[1]) {
      return matchQuery[1].toLowerCase()
    }
    return null
  }

  resolveExtensionName(manifest, extDir) {
    if (!manifest.name) return 'Unnamed Extension'
    if (manifest.name.startsWith('__MSG_')) {
      const msgKey = manifest.name.replace(/^__MSG_/, '').replace(/__$/, '')
      try {
        const localePaths = [
          path.join(extDir, '_locales', 'en', 'messages.json'),
          path.join(extDir, '_locales', 'en_US', 'messages.json'),
          path.join(extDir, '_locales', 'en_GB', 'messages.json'),
        ]
        for (const locPath of localePaths) {
          if (fs.existsSync(locPath)) {
            const msgs = JSON.parse(fs.readFileSync(locPath, 'utf8'))
            if (msgs[msgKey] && msgs[msgKey].message) {
              return msgs[msgKey].message
            }
          }
        }
      } catch (e) {}
      return msgKey.replace(/_/g, ' ')
    }
    return manifest.name
  }

  async downloadAndExtract(extId, isEdgeHint = false) {
    const outDir = path.join(this.extensionsDir, extId)
    const chromeUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=122.0.0.0&acceptformat=crx2,crx3&x=id%3D${extId}%26uc`
    const edgeUrl = `https://edge.microsoft.com/extensionproxy/api/crx?url=https://microsoftedge.microsoft.com/addons/getcrx/${extId}`

    const primaryUrl = isEdgeHint ? edgeUrl : chromeUrl
    const fallbackUrl = isEdgeHint ? chromeUrl : edgeUrl

    const tryDownload = (urlToFetch) => {
      return new Promise((resolve, reject) => {
        const fetchUrl = (targetUrl) => {
          https.get(targetUrl, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return fetchUrl(res.headers.location)
            }
            if (res.statusCode !== 200) {
              return reject(new Error(`HTTP ${res.statusCode}`))
            }

            const chunks = []
            res.on('data', c => chunks.push(c))
            res.on('end', () => {
              const buffer = Buffer.concat(chunks)
              let zipStart = -1
              for (let i = 0; i < Math.min(buffer.length - 4, 10000); i++) {
                if (buffer[i] === 0x50 && buffer[i+1] === 0x4B && buffer[i+2] === 0x03 && buffer[i+3] === 0x04) {
                  zipStart = i
                  break
                }
              }
              if (zipStart === -1) {
                return reject(new Error('Invalid CRX: ZIP header not found'))
              }

              try {
                const zip = new AdmZip(buffer.subarray(zipStart))
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
                zip.extractAllTo(outDir, true)

                const manifestPath = path.join(outDir, 'manifest.json')
                if (!fs.existsSync(manifestPath)) {
                  return reject(new Error('Extracted extension is missing manifest.json'))
                }
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
                const displayName = this.resolveExtensionName(manifest, outDir)

                this.patchExtensionForElectron(outDir)

                resolve({
                  id: extId,
                  name: displayName,
                  version: manifest.version || '1.0.0',
                  description: manifest.description || (isEdgeHint ? 'Microsoft Edge Add-on' : 'Chrome Web Store Extension'),
                  path: outDir,
                  manifest,
                })
              } catch (err) {
                reject(err)
              }
            })
          }).on('error', reject)
        }

        fetchUrl(urlToFetch)
      })
    }

    try {
      return await tryDownload(primaryUrl)
    } catch (primaryErr) {
      console.log(`[NeXusWeb] Primary extension fetch failed (${primaryErr.message}), trying fallback endpoint...`)
      return await tryDownload(fallbackUrl)
    }
  }

  patchExtensionForElectron(extDir) {
    try {
      const manifestPath = path.join(extDir, 'manifest.json')
      if (!fs.existsSync(manifestPath)) return
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

      // Relax CSP in manifest.json
      if (manifest.content_security_policy) {
        if (typeof manifest.content_security_policy === 'object') {
          if (manifest.content_security_policy.extension_pages) {
            manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace(/connect-src/g, 'connect-src http://127.0.0.1:*')
          }
        } else if (typeof manifest.content_security_policy === 'string') {
          manifest.content_security_policy = manifest.content_security_policy.replace(/connect-src/g, 'connect-src http://127.0.0.1:*')
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
      }

      const universalShim = `
(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this));
  if (!root.chrome) root.chrome = {};

  const makeCallable = (target = function() { return Promise.resolve({}); }) => {
    target.addListener = () => {};
    target.removeListener = () => {};
    target.hasListener = () => false;
    target.hasListeners = () => false;
    return target;
  };

  const createSmartProxy = (base = function() { return Promise.resolve({}); }) => {
    return new Proxy(makeCallable(base), {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop === 'string' && ['then', 'catch', 'finally'].includes(prop)) {
          return undefined;
        }
        t[prop] = createSmartProxy();
        return t[prop];
      }
    });
  };

  if (!root.chrome.i18n) root.chrome.i18n = {};
  if (!root.chrome.i18n.getUILanguage) root.chrome.i18n.getUILanguage = () => 'en-US';
  if (!root.chrome.i18n.getMessage) root.chrome.i18n.getMessage = (k) => k;

  const knownNamespaces = ['permissions', 'privacy', 'management', 'alarms', 'windows', 'webRequest', 'declarativeNetRequest', 'contextMenus', 'idle', 'power', 'action', 'browserAction', 'pageAction', 'cookies', 'webNavigation'];
  for (const ns of knownNamespaces) {
    if (!root.chrome[ns]) {
      root.chrome[ns] = createSmartProxy();
    }
  }

  if (root.chrome.permissions) {
    root.chrome.permissions.getAll = async () => ({ permissions: ['proxy', 'privacy', 'storage', 'webRequest', 'webRequestAuthProvider', 'declarativeNetRequest', 'tabs'], origins: ['<all_urls>'] });
    root.chrome.permissions.contains = async () => true;
  }

  let _currentProxy = { mode: 'direct' };
  const _proxyListeners = new Set();

  root.chrome.proxy = {
    onError: makeCallable(),
    onRequest: makeCallable(),
    settings: {
      get: async (details, cb) => {
        const res = { value: _currentProxy, levelOfControl: 'controlled_by_this_extension' };
        if (cb) cb(res);
        return res;
      },
      set: async (details, cb) => {
        _currentProxy = details.value || { mode: 'direct' };
        try {
          await fetch('http://127.0.0.1:49152/set-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(_currentProxy),
          });
        } catch(e) {
          console.error('[PROXY SHIM FETCH ERROR]', e);
        }
        if (cb) cb();
        _proxyListeners.forEach(fn => {
          try { fn({ value: _currentProxy, levelOfControl: 'controlled_by_this_extension' }); } catch(e){}
        });
        return true;
      },
      clear: async (details, cb) => {
        _currentProxy = { mode: 'direct' };
        try {
          await fetch('http://127.0.0.1:49152/set-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(_currentProxy),
          });
        } catch(e) {}
        if (cb) cb();
        return true;
      },
      onChange: {
        addListener: (fn) => _proxyListeners.add(fn),
        removeListener: (fn) => _proxyListeners.delete(fn),
        hasListener: (fn) => _proxyListeners.has(fn),
      }
    }
  };
})();
`
      // Helper to recursively collect all .js files
      const getAllJsFiles = (dir) => {
        let results = []
        try {
          const list = fs.readdirSync(dir)
          for (const file of list) {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)
            if (stat && stat.isDirectory()) {
              results = results.concat(getAllJsFiles(fullPath))
            } else if (file.endsWith('.js')) {
              results.push(fullPath)
            }
          }
        } catch (e) {}
        return results
      }

      const allJsFiles = getAllJsFiles(extDir)
      for (const fullPath of allJsFiles) {
        try {
          let code = fs.readFileSync(fullPath, 'utf8')
          if (!code.includes('http://127.0.0.1:49152/set-proxy')) {
            const clean = code.replace(/\/\* SHIM_START \*\/[\s\S]*?\/\* SHIM_END \*\/\n?/g, '')
            fs.writeFileSync(fullPath, '/* SHIM_START */\n' + universalShim + '\n/* SHIM_END */\n' + clean, 'utf8')
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[ChromeExtensionManager] Patch warning:', e.message)
    }
  }

  async init(session) {
    if (!session) return
    const db = this.getDb()
    for (const item of db) {
      if (item.enabled && fs.existsSync(item.path)) {
        try {
          this.patchExtensionForElectron(item.path)
          const ext = await session.loadExtension(item.path, { allowFileAccess: true })
          this.loadedExtensions.set(item.id, ext)
          console.log(`[ChromeExtensionManager] Loaded extension: ${item.name} (${item.id})`)
        } catch (e) {
          console.warn(`[ChromeExtensionManager] Could not load extension ${item.name}:`, e.message)
        }
      }
    }
  }

  async installFromStore(input, session) {
    const extId = this.extractExtensionId(input)
    if (!extId) {
      return { success: false, error: 'Invalid Chrome Web Store or Edge Add-ons URL or 32-character Extension ID' }
    }

    const isEdgeHint = typeof input === 'string' && input.includes('microsoftedge.microsoft.com')

    try {
      const extData = await this.downloadAndExtract(extId, isEdgeHint)
      let loaded = null
      if (session) {
        try {
          loaded = await session.loadExtension(extData.path, { allowFileAccess: true })
          this.loadedExtensions.set(extId, loaded)
        } catch (e) {
          console.warn(`[ChromeExtensionManager] Loaded with warning:`, e.message)
        }
      }

      const db = this.getDb().filter(e => e.id !== extId)
      const newEntry = {
        id: extId,
        name: extData.name,
        version: extData.version,
        description: extData.description,
        path: extData.path,
        enabled: true,
        installedAt: new Date().toISOString(),
        isChromeStore: true,
      }
      db.push(newEntry)
      this.saveDb(db)

      return {
        success: true,
        extension: newEntry,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async installFromFolder(folderPath, session) {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Directory does not exist' }
    }
    const manifestPath = path.join(folderPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: 'Folder does not contain manifest.json' }
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      const extId = 'local_' + (manifest.name ? manifest.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : Date.now())
      const displayName = this.resolveExtensionName(manifest, folderPath)

      if (session) {
        try {
          const loaded = await session.loadExtension(folderPath, { allowFileAccess: true })
          this.loadedExtensions.set(extId, loaded)
        } catch (e) {}
      }

      const db = this.getDb().filter(e => e.path !== folderPath)
      const newEntry = {
        id: extId,
        name: displayName,
        version: manifest.version || '1.0.0',
        description: manifest.description || 'Local Chrome Extension',
        path: folderPath,
        enabled: true,
        installedAt: new Date().toISOString(),
        isChromeStore: false,
      }
      db.push(newEntry)
      this.saveDb(db)

      return { success: true, extension: newEntry }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  async toggleExtension(extId, enabled, session) {
    const db = this.getDb()
    const item = db.find(e => e.id === extId)
    if (!item) return { success: false, error: 'Extension not found' }

    item.enabled = !!enabled
    this.saveDb(db)

    if (item.enabled && session && fs.existsSync(item.path)) {
      try {
        const loaded = await session.loadExtension(item.path, { allowFileAccess: true })
        this.loadedExtensions.set(extId, loaded)
      } catch (e) {}
    }

    return { success: true, extensions: db }
  }

  async removeExtension(extId, session) {
    const db = this.getDb()
    const item = db.find(e => e.id === extId)
    const updated = db.filter(e => e.id !== extId)
    this.saveDb(updated)

    if (item && item.isChromeStore && fs.existsSync(item.path)) {
      try {
        fs.rmSync(item.path, { recursive: true, force: true })
      } catch (e) {}
    }

    return { success: true, extensions: updated }
  }

  updateExtensionDetails(extId, patch) {
    const db = this.getDb()
    const item = db.find(e => e.id === extId)
    if (!item) return { success: false, error: 'Extension not found' }

    Object.assign(item, patch)
    this.saveDb(db)
    return { success: true, extension: item, extensions: this.list() }
  }

  list() {
    const db = this.getDb()
    return db.map(ext => {
      let manifest = {}
      if (ext.path && fs.existsSync(path.join(ext.path, 'manifest.json'))) {
        try {
          manifest = JSON.parse(fs.readFileSync(path.join(ext.path, 'manifest.json'), 'utf8'))
        } catch (e) {}
      }

      return {
        ...ext,
        manifestVersion: manifest.manifest_version || 2,
        permissions: [...(manifest.permissions || []), ...(manifest.host_permissions || [])],
        optionsPage: manifest.options_ui?.page || manifest.options_page || null,
        siteAccess: ext.siteAccess || 'all', // 'all' | 'specific' | 'click'
        whitelist: ext.whitelist || [],
        allowInPrivate: ext.allowInPrivate ?? false,
        allowFileAccess: ext.allowFileAccess ?? true,
      }
    })
  }
}

module.exports = ChromeExtensionManager
