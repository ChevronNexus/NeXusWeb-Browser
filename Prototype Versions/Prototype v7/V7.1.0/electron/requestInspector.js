/**
 * requestInspector.js
 * Per-tab network request logger for NeXusWeb Developer Tools.
 * Tracks URL, method, resourceType, status, response time, and payload size.
 */

const MAX_LOGS_PER_TAB = 300
const tabLogs = new Map() // tabId -> Array of log entries

function getTabLogs(tabId) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  return tabLogs.get(id) || []
}

function clearTabLogs(tabId) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (id) {
    tabLogs.set(id, [])
  } else {
    tabLogs.clear()
  }
  return true
}

function recordRequestStart(tabId, details) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (!id) return null

  if (!tabLogs.has(id)) {
    tabLogs.set(id, [])
  }

  const logs = tabLogs.get(id)
  const entry = {
    id: details.id || String(Date.now()) + Math.random().toString(36).substr(2, 4),
    url: details.url,
    method: details.method || 'GET',
    resourceType: details.resourceType || 'other',
    startTime: Date.now(),
    status: 'pending',
    statusCode: 0,
    duration: 0,
    size: 0,
    fromCache: false,
    timestamp: new Date().toLocaleTimeString(),
  }

  logs.unshift(entry)
  if (logs.length > MAX_LOGS_PER_TAB) logs.pop()

  return entry
}

function recordRequestComplete(tabId, details) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (!id || !tabLogs.has(id)) return

  const logs = tabLogs.get(id)
  const entry = logs.find(e => e.id === details.id || (e.url === details.url && e.status === 'pending'))

  if (entry) {
    entry.status = details.statusCode >= 400 ? 'error' : 'ok'
    entry.statusCode = details.statusCode || 200
    entry.duration = Math.max(1, Date.now() - entry.startTime)
    entry.fromCache = !!details.fromCache
    if (details.responseHeaders) {
      const cl = details.responseHeaders['content-length'] || details.responseHeaders['Content-Length']
      if (cl) entry.size = parseInt(Array.isArray(cl) ? cl[0] : cl, 10) || 0
    }
  }
}

function recordRequestError(tabId, details) {
  const id = typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
  if (!id || !tabLogs.has(id)) return

  const logs = tabLogs.get(id)
  const entry = logs.find(e => e.id === details.id || (e.url === details.url && e.status === 'pending'))

  if (entry) {
    entry.status = 'failed'
    entry.statusCode = details.error || 0
    entry.duration = Math.max(1, Date.now() - entry.startTime)
  }
}

module.exports = {
  getTabLogs,
  clearTabLogs,
  recordRequestStart,
  recordRequestComplete,
  recordRequestError,
}
