/**
 * D365 Attribute Manager — Log Store
 * Session-based: logs cleared when session ends
 * Isolated per org URL — one user cannot see another's logs
 */
import { create } from 'zustand'

const MAX_LOGS    = 500
const SESSION_KEY = 'd365am_session_logs'

// ── Hash a log entry ──────────────────────────────────────────────────────────
async function hashEntry(entry, prevHash) {
  const data = JSON.stringify({ entry, prevHash })
  const buf  = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data)
  )
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export const useLogStore = create((set, get) => ({
  logs:    [],
  loaded:  false,
  orgUrl:  null,

  // ── Load logs from session storage (current session only) ─────────────────
  loadLogs: async (currentOrgUrl) => {
    try {
      const stored = await chrome.storage.session.get([SESSION_KEY])
      const all    = stored[SESSION_KEY] || []

      // Only show logs for current org — isolate per user/org
      const filtered = currentOrgUrl
        ? all.filter(l => l.orgUrl === currentOrgUrl)
        : all

      set({ logs: filtered, loaded: true, orgUrl: currentOrgUrl })
    } catch {
      set({ logs: [], loaded: true })
    }
  },

  // ── Add a log entry ───────────────────────────────────────────────────────
  addLog: async (entry) => {
    const logs     = get().logs
    const prevHash = logs.length > 0 ? logs[logs.length - 1].hash : '0'

    const logEntry = {
      id:         crypto.randomUUID(),
      timestamp:  new Date().toISOString(),
      operation:  entry.operation,
      status:     entry.status,
      entity:     entry.entity      || '',
      schemaName: entry.schemaName  || '',
      fieldType:  entry.fieldType   || '',
      solution:   entry.solution    || '',
      error:      entry.error       || null,
      orgUrl:     entry.orgUrl      || get().orgUrl || '',
      hash:       await hashEntry(entry, prevHash),
    }

    const updated = [...logs, logEntry].slice(-MAX_LOGS)
    set({ logs: updated })

    // Save to session storage — auto-cleared when browser closes
    try {
      const stored = await chrome.storage.session.get([SESSION_KEY])
      const all    = stored[SESSION_KEY] || []

      // Remove old entries for this org and add new ones
      const orgUrl    = logEntry.orgUrl
      const otherOrgs = all.filter(l => l.orgUrl !== orgUrl)
      const updated2  = [...otherOrgs, ...updated].slice(-MAX_LOGS * 5)

      await chrome.storage.session.set({ [SESSION_KEY]: updated2 })
    } catch { /* graceful */ }

    return logEntry
  },

  // ── Clear logs for current session/org only ───────────────────────────────
  clearLogs: async () => {
    const orgUrl = get().orgUrl

    set({ logs: [] })

    try {
      const stored = await chrome.storage.session.get([SESSION_KEY])
      const all    = stored[SESSION_KEY] || []

      // Only remove logs for current org
      const remaining = orgUrl
        ? all.filter(l => l.orgUrl !== orgUrl)
        : []

      await chrome.storage.session.set({ [SESSION_KEY]: remaining })
    } catch { /* graceful */ }
  },
}))