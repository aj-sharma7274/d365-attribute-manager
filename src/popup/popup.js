;(function () {
  'use strict'
  const statusEl  = document.getElementById('status')
  const dot       = document.getElementById('dot')
  const statusTxt = document.getElementById('status-text')
  const orgUrlEl  = document.getElementById('org-url')

  chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (res) => {
    if (chrome.runtime.lastError || !res) return
    if (res.authenticated) {
      statusEl.className = 'status auth'
      dot.className      = 'dot green'
      statusTxt.textContent = 'Authenticated'
      orgUrlEl.textContent  = res.orgUrl?.replace('https://', '') || ''
    } else {
      statusTxt.textContent = 'Not authenticated'
    }
  })

  document.getElementById('open-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_APP_TAB' })
    window.close()
  })

  document.getElementById('clear-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' }, () => {
      statusEl.className    = 'status unauth'
      dot.className         = 'dot yellow'
      statusTxt.textContent = 'Session cleared'
      orgUrlEl.textContent  = ''
    })
  })
})()