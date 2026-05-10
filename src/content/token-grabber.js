; (function () {
  'use strict'

  if (window.__d365am_injected) return
  window.__d365am_injected = true

  if (!window.location.hostname.endsWith('.dynamics.com')) return

  // Extra check — must be HTTPS and valid hostname
  if (window.location.protocol !== 'https:') return
  if (window.location.hostname.includes('..')) return

  const _orgUrl = window.location.origin
  const _NativeXHR = window.XMLHttpRequest  // capture before D365 patches

  // ── Notify background ─────────────────────────────────────────────────────
  function notifyBackground() {
    try {
      chrome.runtime.sendMessage(
        { type: 'D365_PAGE_READY', payload: { orgUrl: _orgUrl } },
        (res) => { if (chrome.runtime.lastError) { } }
      )
    } catch { }
  }

  notifyBackground()
  window.addEventListener('load', notifyBackground)

  // ── API Proxy via native XHR (bypasses D365 service worker) ──────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'D365_API_REQUEST') return false

    const { method, path, body } = message.payload || {}

    // Security: strict path validation
    if (!path || typeof path !== 'string') {
      sendResponse({ ok: false, error: 'INVALID_PATH' })
      return false
    }
    const cleanPath = path.replace(/^\/+/, '')
    if (!cleanPath.startsWith('api/data/')) {
      sendResponse({ ok: false, error: 'FORBIDDEN_PATH' })
      return false
    }
    if (cleanPath.includes('..') || cleanPath.includes('//') || cleanPath.includes('\0')) {
      sendResponse({ ok: false, error: 'PATH_TRAVERSAL_BLOCKED' })
      return false
    }
    if (cleanPath.length > 2000) {
      sendResponse({ ok: false, error: 'PATH_TOO_LONG' })
      return false
    }

    const url = `${_orgUrl}/${cleanPath}`
    const requestMethod = (method || 'GET').toUpperCase()
    const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE']
    if (!allowedMethods.includes(requestMethod)) {
      sendResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' })
      return false
    }

    // Use native XHR — bypasses D365 service worker
    const xhr = new _NativeXHR()
    xhr.open(requestMethod, url, true)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('OData-MaxVersion', '4.0')
    xhr.setRequestHeader('OData-Version', '4.0')
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.withCredentials = true
    xhr.timeout = 60000 // 60 seconds for metadata operations

    xhr.onload = function () {
      // Security: limit response size
      const maxBytes = 5120 * 1024 // 5MB
      if (xhr.responseText.length > maxBytes) {
        sendResponse({ ok: false, error: 'RESPONSE_TOO_LARGE' })
        return
      }
      let data
      try { data = JSON.parse(xhr.responseText) }
      catch { data = { raw: xhr.responseText.slice(0, 1000) } }
      sendResponse({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
    }

    xhr.onerror = () => sendResponse({ ok: false, error: 'XHR_FAILED' })
    xhr.ontimeout = () => sendResponse({ ok: false, error: 'XHR_TIMEOUT' })

    if (body && requestMethod !== 'GET' && requestMethod !== 'DELETE') {
      xhr.send(JSON.stringify(body))
    } else {
      xhr.send()
    }

    return true
  })

})()