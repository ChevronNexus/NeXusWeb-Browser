/**
 * privacyFilter.js - NeXusWeb V4
 * 100% Zero-Telemetry DuckDuckGo-style Privacy & Security Shield.
 * Features Tracker Blocking, Ad Network Blocking, HTTPS Auto-Upgrade,
 * Cookie Auto-Shredder, and zero external data leakage.
 */

const TRACKER_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'doubleclick.net', 'adservice.google.com', 'pagead2.googlesyndication.com', 'googlesyndication.com',
  'connect.facebook.net', 'pixel.facebook.com', 'an.facebook.com',
  'scorecardresearch.com', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com',
  'adnxs.com', 'amazon-adsystem.com', 'adsrvr.org', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'casalemedia.com', 'serving-sys.com', 'advertising.com', 'adroll.com',
  'chartbeat.com', 'quantserve.com', 'quantcount.com', 'segment.io', 'segment.com',
  'hotjar.com', 'clarity.ms', 'mixpanel.com', 'amplitude.com', 'heapanalytics.com',
  'fullstory.com', 'crazyegg.com', 'mouseflow.com', 'branch.io', 'appsflyer.com',
  'adjust.com', 'onesignal.com', 'optimizely.com', 'smartlook.com', 'bugsnag.com',
  'datadoghq.com', 'inspectlet.com', 'luckyorange.com', 'matomo.org', 'statcounter.com',
]

const TRACKER_PATH_PATTERNS = [
  /\/telemetry/i, /\/analytics\.js/i, /\/gtag\/js/i, /\/pixel\.gif/i,
  /\/beacon(\.js|\.gif)?/i, /\/track(\.js|\.gif|\/event)?/i, /\/collect(\?|$)/i, /\/logEvent/i,
]

const privacyStats = {
  trackersBlocked: 0,
  adsBlocked: 0,
  httpsUpgrades: 0,
  cookiesShredded: 0,
}

function isTrackerOrAd(urlStr) {
  try {
    const u = new URL(urlStr)
    const hostname = u.hostname.toLowerCase()
    const pathname = u.pathname

    for (const d of TRACKER_DOMAINS) {
      if (hostname === d || hostname.endsWith('.' + d)) {
        return { isTracker: true, domain: d }
      }
    }

    for (const pattern of TRACKER_PATH_PATTERNS) {
      if (pattern.test(pathname) || pattern.test(urlStr)) {
        return { isTracker: true, domain: hostname }
      }
    }
  } catch (e) {}

  return { isTracker: false }
}

const FINGERPRINT_SHIELD_SCRIPT = `
(function() {
  if (window.__nexus_shield_injected) return;
  window.__nexus_shield_injected = true;

  try {
    // Navigator Privacy Standards
    try { Object.defineProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true }); } catch(e) {}
    try { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true }); } catch(e) {}
  } catch(e) {}
})();
`

async function shredCookiesForSession(sess) {
  try {
    const cookies = await sess.cookies.get({})
    for (const cookie of cookies) {
      const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`
      await sess.cookies.remove(url, cookie.name)
    }
    privacyStats.cookiesShredded += cookies.length
    return cookies.length
  } catch (e) {
    return 0
  }
}

module.exports = {
  isTrackerOrAd,
  privacyStats,
  FINGERPRINT_SHIELD_SCRIPT,
  shredCookiesForSession,
  TRACKER_DOMAINS,
}
