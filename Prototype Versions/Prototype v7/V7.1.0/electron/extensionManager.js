/**
 * extensionManager.js - NeXusWeb V4
 * Built-in Userscripts & Custom CSS injection engine.
 * Allows developers to run custom scripts and styles per domain with zero bloat.
 */

const { getExtensions, saveExtensions } = require('./storage')

function domainMatches(pattern, urlStr) {
  if (!pattern || pattern === '*://*/*' || pattern === '*') return true
  try {
    const u = new URL(urlStr)
    const host = u.hostname.toLowerCase()
    const cleanPattern = pattern.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
    if (cleanPattern.startsWith('*.')) {
      const root = cleanPattern.slice(2)
      return host === root || host.endsWith('.' + root)
    }
    return host === cleanPattern || host.includes(cleanPattern)
  } catch (e) {
    return false
  }
}

function injectExtensionsForTab(view, urlStr) {
  if (!view || !view.webContents || !urlStr || urlStr === 'nexusweb://home') return

  const extensions = getExtensions()
  const matching = extensions.filter(ext => ext.enabled && domainMatches(ext.domain, urlStr))

  matching.forEach(ext => {
    if (ext.type === 'css' && ext.code) {
      view.webContents.insertCSS(ext.code).catch(() => {})
    } else if (ext.type === 'js' && ext.code) {
      view.webContents.executeJavaScript(`
        (function() {
          try {
            ${ext.code}
          } catch(e) {
            console.error('[NeXusWeb Extension Error: ${ext.name}]', e);
          }
        })();
      `).catch(() => {})
    }
  })
}

module.exports = {
  injectExtensionsForTab,
  domainMatches,
}
