import React, { useEffect, useState, useMemo } from 'react'
import {
  ScrollText, Download, Trash2, Filter,
  CheckCircle, XCircle, RefreshCw, Shield,
  ChevronDown, ChevronUp, Search
} from 'lucide-react'
import { useLogStore }     from '../store/logStore.js'
import { exportLogsToExcel } from '../utils/exportLogs.js'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore.js'

const OP_COLORS = {
  CREATE: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
  DELETE: { bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  text: 'var(--danger-text)'  },
}

const STATUS_COLORS = {
  success: { bg: 'var(--success-bg)', border: 'var(--success-border)', text: 'var(--success-text)' },
  error:   { bg: 'var(--danger-bg)',  border: 'var(--danger-border)',  text: 'var(--danger-text)'  },
}

export default function LogsPage() {
  const { logs, loaded, loadLogs, clearLogs } = useLogStore()

  const [search,       setSearch]      = useState('')
  const [filterOp,     setFilterOp]    = useState('all')   // all | CREATE | DELETE
  const [filterStatus, setFilterStatus]= useState('all')   // all | success | error
  const [sortDesc,     setSortDesc]    = useState(true)
  const [expandedId,   setExpandedId]  = useState(null)
  const [confirmClear, setConfirmClear]= useState(false)

  const { orgUrl } = useAuthStore()

useEffect(() => {
  if (orgUrl) loadLogs(orgUrl)
}, [orgUrl])

  // ── Filtered + sorted logs ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...logs]

    if (filterOp     !== 'all') result = result.filter(l => l.operation === filterOp)
    if (filterStatus !== 'all') result = result.filter(l => l.status    === filterStatus)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.schemaName?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q)     ||
        l.solution?.toLowerCase().includes(q)   ||
        l.fieldType?.toLowerCase().includes(q)
      )
    }

    if (sortDesc) result.reverse()
    return result
  }, [logs, filterOp, filterStatus, search, sortDesc])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   logs.length,
    success: logs.filter(l => l.status    === 'success').length,
    error:   logs.filter(l => l.status    === 'error').length,
    create:  logs.filter(l => l.operation === 'CREATE').length,
    delete:  logs.filter(l => l.operation === 'DELETE').length,
  }), [logs])

  const handleExport = () => {
    if (logs.length === 0) { toast.error('No logs to export.'); return }
    exportLogsToExcel(filtered.length > 0 ? filtered : logs)
    toast.success('Logs exported!')
  }

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    await clearLogs()
    setConfirmClear(false)
    toast.success('Logs cleared.')
  }

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
            Operation Logs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Tamper-evident audit log of all create and delete operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadLogs()} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-2">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-2">
            <Download size={13} /> Export Excel
          </button>
          <button
            onClick={handleClear}
            className="btn-danger text-xs px-3 py-1.5 flex items-center gap-2"
            style={{ fontWeight: confirmClear ? 700 : 400 }}
          >
            <Trash2 size={13} />
            {confirmClear ? 'Click again to confirm' : 'Clear All'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,   color: 'var(--text-accent)',   bg: 'var(--accent-bg)',   border: 'var(--accent-border)'   },
          { label: 'Success',  value: stats.success, color: 'var(--success-text)',  bg: 'var(--success-bg)',  border: 'var(--success-border)'  },
          { label: 'Failed',   value: stats.error,   color: 'var(--danger-text)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)'   },
          { label: 'Created',  value: stats.create,  color: 'var(--success-text)',  bg: 'var(--success-bg)',  border: 'var(--success-border)'  },
          { label: 'Deleted',  value: stats.delete,  color: 'var(--danger-text)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)'   },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className="text-center p-3 rounded-xl"
            style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="text-2xl font-bold font-mono" style={{ color }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)' }}>
        <Shield size={14} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Each log entry is SHA-256 hash-chained to the previous entry for tamper-evidence.
          Export to Excel to preserve the full chain for compliance or auditing.
        </p>
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />

          {/* Operation filter */}
          <div className="flex gap-1">
            {[['all','All Ops'],['CREATE','Create'],['DELETE','Delete']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterOp(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterOp === val ? 'var(--accent-bg)'     : 'var(--glass1)',
                  border:     filterOp === val ? '1px solid var(--accent-border)' : '1px solid var(--glass-border)',
                  color:      filterOp === val ? 'var(--text-accent)'   : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--glass-border)' }} />

          {/* Status filter */}
          <div className="flex gap-1">
            {[['all','All Status'],['success','Success'],['error','Failed']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterStatus === val ? 'var(--accent-bg)'     : 'var(--glass1)',
                  border:     filterStatus === val ? '1px solid var(--accent-border)' : '1px solid var(--glass-border)',
                  color:      filterStatus === val ? 'var(--text-accent)'   : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--glass-border)' }} />

          {/* Sort */}
          <button
            onClick={() => setSortDesc(d => !d)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              background: 'var(--glass1)',
              border:     '1px solid var(--glass-border)',
              color:      'var(--text-muted)',
            }}
          >
            {sortDesc ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {sortDesc ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }} />
          <input
            className="input pl-8 text-xs"
            placeholder="Search by field name, entity, solution..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Log list */}
      {!loaded && (
        <div className="text-center py-12">
          <RefreshCw size={24} className="animate-spin mx-auto mb-3"
            style={{ color: 'var(--text-accent)' }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading logs...</p>
        </div>
      )}

      {loaded && logs.length === 0 && (
        <div className="card text-center py-12">
          <ScrollText size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
            No logs yet
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Logs will appear here after you create or delete fields.
          </p>
        </div>
      )}

      {loaded && logs.length > 0 && filtered.length === 0 && (
        <div className="card text-center py-8">
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No logs match your current filters.
          </p>
        </div>
      )}

      {loaded && filtered.length > 0 && (
        <div className="space-y-2">
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Showing {filtered.length} of {logs.length} entries
          </p>

          {filtered.map((log) => {
            const opColor     = OP_COLORS[log.operation]     || OP_COLORS.CREATE
            const statusColor = STATUS_COLORS[log.status]    || STATUS_COLORS.success
            const isExpanded  = expandedId === log.id

            return (
              <div key={log.id} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--glass-border)' }}>

                {/* Main row */}
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{ background: isExpanded ? 'var(--glass2)' : 'var(--glass1)' }}
                >
                  {/* Status icon */}
                  {log.status === 'success'
                    ? <CheckCircle size={14} style={{ color: 'var(--success-text)', flexShrink: 0 }} />
                    : <XCircle    size={14} style={{ color: 'var(--danger-text)',  flexShrink: 0 }} />
                  }

                  {/* Operation badge */}
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0"
                    style={{ background: opColor.bg, border: `1px solid ${opColor.border}`, color: opColor.text }}>
                    {log.operation}
                  </span>

                  {/* Field info */}
                  <div className="flex-1 min-w-0">
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 500 }}>
                      {log.schemaName}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {log.entity}
                      {log.fieldType && ` · ${log.fieldType}`}
                      {log.solution  && ` · ${log.solution}`}
                    </span>
                  </div>

                  {/* Error snippet */}
                  {log.status === 'error' && log.error && (
                    <span style={{ fontSize: 11, color: 'var(--danger-text)', maxWidth: 180, textAlign: 'right' }}
                      className="truncate flex-shrink-0">
                      {log.error}
                    </span>
                  )}

                  {/* Timestamp */}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>

                  {isExpanded
                    ? <ChevronUp   size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    : <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 py-3 space-y-2"
                    style={{ borderTop: '1px solid var(--glass-border)', background: 'var(--glass1)' }}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {[
                        ['Entry ID',    log.id],
                        ['Timestamp',   new Date(log.timestamp).toLocaleString()],
                        ['Operation',   log.operation],
                        ['Status',      log.status],
                        ['Entity',      log.entity],
                        ['Schema Name', log.schemaName],
                        ['Field Type',  log.fieldType],
                        ['Solution',    log.solution],
                        ['Org URL',     log.orgUrl],
                        ...(log.error ? [['Error', log.error]] : []),
                      ].map(([label, value]) => (
                        <div key={label} className="flex gap-2">
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, minWidth: 90 }}>
                            {label}:
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: label === 'Schema Name' || label === 'Entry ID' ? 'monospace' : 'inherit' }}>
                            {value || '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Hash */}
                    <div style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'var(--glass2)',
                      border: '1px solid var(--glass-border)',
                    }}>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        SHA-256 Chain Hash
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-accent)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {log.hash}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}