/**
 * networkFilter.js - NeXusWeb V4
 * Strict mode-based network isolation and request routing.
 */

const { isTrackerOrAd, privacyStats } = require('./privacyFilter')
const { recordRequestStart, recordRequestComplete, recordRequestError } = require('./requestInspector')

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
    urlStr.startsWith('about:') || urlStr.startsWith('nexusweb://')
  )
}

function setupNetworkFilter(sess, mode, onPrivacyEvent, getActiveTabId) {
  sess.webRequest.onBeforeRequest(null)
  sess.webRequest.onBeforeSendHeaders(null)
  sess.webRequest.onCompleted(null)
  sess.webRequest.onErrorOccurred(null)

  // Configure Referrer Policy & DNT headers
  sess.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const requestHeaders = details.requestHeaders || {}
    if (mode === 'normal') {
      requestHeaders['DNT'] = '1'
      requestHeaders['Sec-GPC'] = '1'
      if (details.referrer && details.url) {
        try {
          const refHost = new URL(details.referrer).hostname
          const reqHost = new URL(details.url).hostname
          if (refHost !== reqHost) {
            delete requestHeaders['Referer']
          }
        } catch (e) {}
      }
    }
    callback({ requestHeaders })
  })

  // Filter requests according to mode + record inspector logs
  sess.webRequest.onBeforeRequest({ urls: ['*://*/*', 'ws://*/*', 'wss://*/*', 'file://*/*'] }, (details, callback) => {
    const url = details.url
    const activeTabId = getActiveTabId ? getActiveTabId() : null

    if (activeTabId && !url.startsWith('devtools://') && !url.startsWith('data:')) {
      recordRequestStart(activeTabId, details)
    }

    if (isInternal(url) || isFile(url)) {
      return callback({ cancel: false })
    }

    if (isLocalhost(url)) {
      return callback({ cancel: false })
    }

    switch (mode) {
      case 'strict':
        return callback({ cancel: true })

      case 'lan':
        if (isLAN(url)) return callback({ cancel: false })
        return callback({ cancel: true })

      case 'normal': {
        const trackerCheck = isTrackerOrAd(url)
        if (trackerCheck.isTracker) {
          privacyStats.trackersBlocked++
          if (onPrivacyEvent) {
            onPrivacyEvent({
              type: 'tracker-blocked',
              domain: trackerCheck.domain,
              url,
              totalBlocked: privacyStats.trackersBlocked,
            })
          }
          return callback({ cancel: true })
        }

        if (url.startsWith('http://') && !isLAN(url) && !isLocalhost(url)) {
          const upgradedUrl = url.replace(/^http:\/\//, 'https://')
          privacyStats.httpsUpgrades++
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
    const activeTabId = getActiveTabId ? getActiveTabId() : null
    if (activeTabId) recordRequestComplete(activeTabId, details)
  })

  sess.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    const activeTabId = getActiveTabId ? getActiveTabId() : null
    if (activeTabId) recordRequestError(activeTabId, details)
  })

  console.log(`[NeXusWeb] Network filter updated: mode = ${mode}`)
}

module.exports = { setupNetworkFilter, isLocalhost, isLAN, isFile }
