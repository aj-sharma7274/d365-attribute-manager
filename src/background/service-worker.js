// D365 Attribute Manager — Background Service Worker
// Handles: D365 tab detection, API proxy, session management

// Inlined constants — service worker cannot import from app folder
const TOKEN_TTL_MS            = 8 * 60 * 60 * 1000
const MAX_MESSAGES_PER_MIN    = 60
const ALLOWED_API_PREFIX      = 'api/data/'
const DYNAMICS_HOSTNAME_SUFFIX = '.dynamics.com'
const STORAGE_KEYS = {
  THEME:   'd365am_theme',
  SESSION: 'd365am_session',
  LOGS:    'd365am_logs',
}

let _session = null

const EXTENSION_ORIGIN  = chrome.runtime.getURL('').slice(0, -1)

// ── Rate limiting ─────────────────────────────────────────────────────────────
const _msgTimestamps = []
function isRateLimited() {
  const now    = Date.now()
  const cutoff = now - 60_000
  // Remove timestamps older than 1 minute
  while (_msgTimestamps.length && _msgTimestamps[0] < cutoff) _msgTimestamps.shift()
  if (_msgTimestamps.length >= MAX_MESSAGES_PER_MIN) return true
  _msgTimestamps.push(now)
  return false
}

// ── Message Router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderUrl = sender.url || ''
  const isExtPage = senderUrl.startsWith(EXTENSION_ORIGIN)
  const isContent = sender.tab &&
    isValidDynamicsUrl(senderUrl)

  if (!isExtPage && !isContent) {
    sendResponse({ error: 'UNAUTHORIZED_ORIGIN' })
    return false
  }

  if (!message || typeof message.type !== 'string') {
    sendResponse({ error: 'INVALID_MESSAGE' })
    return false
  }

  if (isRateLimited()) {
    sendResponse({ error: 'RATE_LIMITED' })
    return false
  }

  switch (message.type) {
    case 'D365_PAGE_READY':
      handlePageReady(message.payload, sender, sendResponse)
      return true
    case 'GET_AUTH_STATUS':
      handleGetAuthStatus(sendResponse)
      return true
    case 'CLEAR_SESSION':
      handleClearSession(sendResponse)
      return true
    case 'OPEN_APP_TAB':
      handleOpenAppTab(sendResponse)
      return true
    case 'D365_API_REQUEST':
      handleApiProxy(message.payload, sendResponse)
      return true
    default:
      sendResponse({ error: 'UNKNOWN_TYPE' })
      return false
  }
})

// ── Click extension icon → open app tab directly (no popup) ──────────────────
chrome.action.onClicked.addListener(() => {
  const url = chrome.runtime.getURL('app/index.html')
  chrome.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true })
      chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
      chrome.tabs.create({ url })
    }
  })
})

// ── D365 Page Detected ────────────────────────────────────────────────────────
async function handlePageReady(payload, sender, sendResponse) {
  if (!payload?.orgUrl || !isValidDynamicsUrl(payload.orgUrl)) {
    sendResponse({ error: 'INVALID_URL' })
    return
  }

  _session = {
    orgUrl:      sanitizeUrl(payload.orgUrl),
    tabId:       sender.tab?.id,
    connectedAt: Date.now(),
  }

  await chrome.storage.session.set({ [STORAGE_KEYS.SESSION]: _session })
  chrome.action.setBadgeText({ text: '✓' })
  chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
  sendResponse({ success: true })
}

// ── Auth Status ───────────────────────────────────────────────────────────────
async function handleGetAuthStatus(sendResponse) {
  if (_session) {
    sendResponse({ authenticated: true, orgUrl: _session.orgUrl })
    return
  }

  const stored = await chrome.storage.session.get([STORAGE_KEYS.SESSION])
  if (stored[STORAGE_KEYS.SESSION]) {
    _session = stored[STORAGE_KEYS.SESSION]
    sendResponse({ authenticated: true, orgUrl: _session.orgUrl })
    return
  }

  const tabs = await chrome.tabs.query({ url: '*://*.dynamics.com/*' })
  if (tabs.length > 0) {
    try {
      const url = new URL(tabs[0].url)
      if (!url.hostname.endsWith(DYNAMICS_HOSTNAME_SUFFIX)) throw new Error()
      _session = { orgUrl: url.origin, tabId: tabs[0].id, connectedAt: Date.now() }
      await chrome.storage.session.set({ [STORAGE_KEYS.SESSION]: _session })
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
      sendResponse({ authenticated: true, orgUrl: _session.orgUrl })
    } catch {
      sendResponse({ authenticated: false })
    }
    return
  }

  sendResponse({ authenticated: false })
}

// ── API Proxy ─────────────────────────────────────────────────────────────────
async function handleApiProxy(payload, sendResponse) {
  // Validate path strictly
  if (!isValidApiPath(payload?.path)) {
    sendResponse({ ok: false, error: 'INVALID_API_PATH' })
    return
  }

  let tabId = _session?.tabId

  // Verify tab still open
  if (tabId) {
    try { await chrome.tabs.get(tabId) }
    catch { tabId = null }
  }

  if (!tabId) {
    const tabs = await chrome.tabs.query({ url: '*://*.dynamics.com/*' })
    if (tabs.length === 0) {
      sendResponse({ ok: false, error: 'NO_D365_TAB', message: 'No D365 tab found. Please open your D365 org.' })
      return
    }
    tabId = tabs[0].id
    if (_session) _session.tabId = tabId
  }

  chrome.tabs.sendMessage(
    tabId,
    { type: 'D365_API_REQUEST', payload },
    (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: 'CONTENT_SCRIPT_ERROR', message: 'Please refresh your D365 tab.' })
        return
      }
      sendResponse(response)
    }
  )
}

// ── Clear Session ─────────────────────────────────────────────────────────────
async function handleClearSession(sendResponse) {
  _session = null
  await chrome.storage.session.remove([STORAGE_KEYS.SESSION])
  chrome.action.setBadgeText({ text: '' })
  sendResponse({ success: true })
}

// ── Open App Tab (called from content or other contexts) ──────────────────────
function handleOpenAppTab(sendResponse) {
  const url = chrome.runtime.getURL('app/index.html')
  chrome.tabs.query({ url }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true })
      chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
      chrome.tabs.create({ url })
    }
  })
  if (sendResponse) sendResponse({ success: true })
}

// ── Tab events ────────────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  if (_session?.tabId === tabId) {
    _session = null
    chrome.storage.session.remove([STORAGE_KEYS.SESSION])
    chrome.action.setBadgeText({ text: '' })
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('.dynamics.com')) {
    try {
      const url = new URL(tab.url)
      if (!url.hostname.endsWith(DYNAMICS_HOSTNAME_SUFFIX)) return
      _session = { orgUrl: url.origin, tabId, connectedAt: Date.now() }
      chrome.storage.session.set({ [STORAGE_KEYS.SESSION]: _session })
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
    } catch { }
  }
})

// ── Security Helpers ──────────────────────────────────────────────────────────
function isValidDynamicsUrl(url) {
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith(DYNAMICS_HOSTNAME_SUFFIX) &&
      !u.hostname.includes('..') &&
      u.hostname.split('.').length >= 3
    )
  } catch { return false }
}

function sanitizeUrl(url) {
  try { return new URL(url).origin }
  catch { return null }
}

function isValidApiPath(path) {
  if (!path || typeof path !== 'string') return false
  if (path.length > 2000) return false
  // Must start with allowed prefix
  if (!path.replace(/^\/+/, '').startsWith(ALLOWED_API_PREFIX)) return false
  // Block path traversal attempts
  if (path.includes('..') || path.includes('//')) return false
  // Block null bytes
  if (path.includes('\0')) return false
  return true
}