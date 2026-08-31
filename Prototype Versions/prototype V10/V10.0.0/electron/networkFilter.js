/**
 * networkFilter.js - NeXusWeb V9.1.0
 * Strict mode-based network isolation, ad blocking, and request routing.
 * Optimized for zero-flicker dynamic mode transitions.
 */

const crypto = require('crypto')
const { checkAdOrTracker, adblockStats } = require('./adblockEngine')
const { getSettings } = require('./storage')
const { recordRequestStart, recordRequestComplete, recordRequestError } = require('./requestInspector')

const ECOSYSTEM_SECRET = "nexus_secret_ecosystem_token_2026_lab_auth"

let currentFilterMode = 'normal'
let globalOnPrivacyEvent = null
let globalGetActiveTabId = null
const initializedSessions = new WeakSet()

function isLocalhost(urlStr) {
  try {
    const u = new URL(urlStr)
    const h = u.hostname.toLowerCase()
    return (
      h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]' ||
      h.endsWith('.localhost') || h.endsWith('.local')
    )
  } catch (e) {
    return (
      urlStr.startsWith('http://localhost') || urlStr.startsWith('https://localhost') ||
      urlStr.startsWith('http://127.0.0.1') || urlStr.startsWith('https://127.0.0.1')
    )
  }
}

function isLAN(urlStr) {
  try {
    const u = new URL(urlStr)
    const h = u.hostname.toLowerCase()
    if (/^192\.168\.\d+\.\d+$/.test(h)) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h)) return true
    return false
  } catch (e) {
    return false
  }
}

function isFile(urlStr) {
  return urlStr.startsWith('file://') || urlStr.startsWith('data:') || urlStr.startsWith('blob:')
}

function isInternal(urlStr) {
  return (
    urlStr.startsWith('devtools://') || urlStr.startsWith('chrome-devtools://') ||
    urlStr.startsWith('chrome-extension://') || urlStr.startsWith('chrome://') ||
    urlStr.startsWith('about:') || urlStr.startsWith('nexusweb://') ||
    urlStr.includes('fonts.googleapis.com') || urlStr.includes('fonts.gstatic.com')
  )
}

function setFilterMode(mode) {
  currentFilterMode = mode || 'normal'
  console.log(`[NeXusWeb] Network filter mode transitioned to: ${currentFilterMode}`)
}

function getFilterMode() {
  return currentFilterMode
}

function setupNetworkFilter(sess, mode, onPrivacyEvent, getActiveTabId) {
  if (mode) currentFilterMode = mode
  if (onPrivacyEvent) globalOnPrivacyEvent = onPrivacyEvent
  if (getActiveTabId) globalGetActiveTabId = getActiveTabId

  if (initializedSessions.has(sess)) {
    return
  }
  initializedSessions.add(sess)

  // Configure Referrer Policy & DNT & Anti-Tracking Headers
  sess.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const requestHeaders = details.requestHeaders || {}
    const reqUrl = details.url || ''

    // 1. Block local app assets (0.0.0.0:3000, localhost:5173) leaking into remote page contexts
    if (
      reqUrl.startsWith('http://0.0.0.0:3000') ||
      reqUrl.startsWith('https://0.0.0.0:3000') ||
      reqUrl.startsWith('http://localhost:5173') ||
      reqUrl.startsWith('https://localhost:5173')
    ) {
      return callback({ cancel: true })
    }

    const isChallengeOrAuth = reqUrl.includes('challenges.cloudflare.com') ||
                              reqUrl.includes('cloudflare.com') ||
                              reqUrl.includes('google.com') ||
                              reqUrl.includes('recaptcha.net') ||
                              reqUrl.includes('hcaptcha.com') ||
                              reqUrl.includes('gstatic.com') ||
                              reqUrl.includes('googleapis.com') ||
                              reqUrl.includes('youtube.com') ||
                              reqUrl.includes('youtu.be') ||
                              reqUrl.includes('/cdn-cgi/challenge-platform')

    // Always inject clean standard Chrome 126+ User-Agent and Sec-CH-UA Client Hints
    requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    requestHeaders['Sec-CH-UA'] = '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"'
    requestHeaders['Sec-CH-UA-Mobile'] = '?0'
    requestHeaders['Sec-CH-UA-Platform'] = '"Windows"'
    requestHeaders['Sec-CH-UA-Platform-Version'] = '"15.0.0"'

    // Strip any automated/embedded signals that block Google Sign-In or Cloudflare
    delete requestHeaders['X-Requested-With']
    delete requestHeaders['x-requested-with']
    delete requestHeaders['X-Electron-Version']
    delete requestHeaders['x-electron-version']
    delete requestHeaders['X-DevTools-Emulate-Network-Conditions-Client-Id']

    // Inject ChevronNexus Lab Ecosystem handshake headers on local/LAN requests
    if (isLocalhost(details.url) || isLAN(details.url)) {
      try {
        const u = new URL(details.url)
        const ts = String(Date.now())
        const sig = crypto.createHmac('sha256', ECOSYSTEM_SECRET).update(`${ts}:${u.pathname}`).digest('hex')
        requestHeaders['X-Nexus-Client'] = 'NeXusWeb-Desktop'
        requestHeaders['X-Nexus-Timestamp'] = ts
        requestHeaders['X-NexusWeb-Signature'] = sig
      } catch (e) {}
    }

    // Only apply strict privacy header stripping in strict/lan mode, never on Cloudflare/Auth challenges
    const activeMode = currentFilterMode
    if (!isChallengeOrAuth && activeMode === 'strict') {
      requestHeaders['DNT'] = '1'
      requestHeaders['Sec-GPC'] = '1'
      if (details.referrer && details.url) {
        try {
          const refUrl = new URL(details.referrer)
          const parsedReq = new URL(details.url)
          if (refUrl.hostname !== parsedReq.hostname) {
            delete requestHeaders['Referer']
          }
        } catch (e) {
          delete requestHeaders['Referer']
        }
      }
    }

    callback({ cancel: false, requestHeaders })
  })

  // Sanitize unrecognized Permissions-Policy feature warnings on responses
  sess.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const responseHeaders = details.responseHeaders || {}
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'permissions-policy') {
        responseHeaders[key] = responseHeaders[key].map(val => {
          return val.replace(/ch-ua-form-factors=[^,]*,?/gi, '').replace(/,\s*$/, '').trim()
        }).filter(Boolean)
      }
    }
    callback({ responseHeaders })
  })

  // Filter requests dynamically according to currentFilterMode + record inspector logs
  sess.webRequest.onBeforeRequest({ urls: ['*://*/*', 'ws://*/*', 'wss://*/*', 'file://*/*'] }, (details, callback) => {
    const url = details.url
    const activeTabId = globalGetActiveTabId ? globalGetActiveTabId() : null

    if (activeTabId && !url.startsWith('devtools://') && !url.startsWith('data:')) {
      recordRequestStart(activeTabId, details)
    }

    if (isInternal(url) || isFile(url)) {
      return callback({ cancel: false })
    }

    if (isLocalhost(url) || isLAN(url)) {
      return callback({ cancel: false })
    }

    const activeMode = currentFilterMode
    switch (activeMode) {
      case 'strict':
        return callback({ cancel: true })

      case 'lan':
        if (isLAN(url)) return callback({ cancel: false })
        return callback({ cancel: true })

      case 'normal': {
        const settings = getSettings()
        const isAdblockDisabled = settings.adblockLevel === 'off'
        const whitelist = settings.adblockWhitelist || []

        if (!isAdblockDisabled) {
          const adCheck = checkAdOrTracker(url, whitelist)
          if (adCheck.isBlocked) {
            adblockStats.adsBlocked++
            adblockStats.trackersBlocked++
            if (globalOnPrivacyEvent) {
              globalOnPrivacyEvent({
                type: 'ad-blocked',
                domain: adCheck.domain,
                reason: adCheck.reason,
                url,
                totalBlocked: adblockStats.adsBlocked,
              })
            }
            return callback({ cancel: true })
          }
        }

        if (url.startsWith('http://') && !isLAN(url) && !isLocalhost(url)) {
          const upgradedUrl = url.replace(/^http:\/\//, 'https://')
          adblockStats.httpsUpgrades++
          return callback({ redirectURL: upgradedUrl })
        }

        return callback({ cancel: false })
      }

      case 'dev':
        return callback({ cancel: false })

      default:
        return callback({ cancel: false })
    }
  })

  sess.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
    const activeTabId = globalGetActiveTabId ? globalGetActiveTabId() : null
    if (activeTabId) recordRequestComplete(activeTabId, details)
  })

  sess.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    const activeTabId = globalGetActiveTabId ? globalGetActiveTabId() : null
    if (activeTabId) recordRequestError(activeTabId, details)
  })

  console.log(`[NeXusWeb] Dynamic Network Filter initialized on session`)
}

module.exports = {
  setupNetworkFilter,
  setFilterMode,
  getFilterMode,
  isLocalhost,
  isLAN,
  isFile,
}
