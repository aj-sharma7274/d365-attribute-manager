import React, { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ValidationReport({ results }) {
  const [filter,   setFilter]   = useState('all')
  const [expanded, setExpanded] = useState({})

  if (!results) return null

  const { errors, errorCount, warningCount, totalRows, isValid } = results

  const filtered = errors.filter(e =>
    filter === 'all' || e.severity === filter
  )

  // Group by sheet + row
  const grouped = filtered.reduce((acc, e) => {
    const key = `${e.sheet} — Row ${e.row}`
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const exportReport = () => {
    const rows = [
      ['Sheet', 'Row', 'Column', 'Severity', 'Message'],
      ...errors.map(e => [e.sheet, e.row, e.col, e.severity, e.message]),
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 25 }, { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 80 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Validation Report')
    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'D365_Validation_Report.xlsx'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Summary */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl"
        style={{
          background: isValid ? 'var(--success-bg)' : 'var(--danger-bg)',
          border:     `1px solid ${isValid ? 'var(--success-border)' : 'var(--danger-border)'}`,
        }}
      >
        <div className="flex items-center gap-3">
          {isValid
            ? <CheckCircle size={20} style={{ color: 'var(--success-text)' }} />
            : <AlertCircle size={20} style={{ color: 'var(--danger-text)'  }} />
          }
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isValid
                ? `✓ ${totalRows} rows validated — ready to process`
                : `${errorCount} error${errorCount !== 1 ? 's' : ''} found — fix and re-upload`
              }
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {totalRows} rows · {errorCount} errors · {warningCount} warnings
            </p>
          </div>
        </div>
        {errors.length > 0 && (
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
            style={{
              background: 'var(--glass1)',
              border:     '1px solid var(--glass-border)',
              color:      'var(--text-secondary)',
            }}
          >
            <Download size={13} />
            Export Report
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {errors.length > 0 && (
        <div className="flex gap-2">
          {[
            ['all',     'All',      errors.length],
            ['error',   'Errors',   errorCount],
            ['warning', 'Warnings', warningCount],
          ].map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: filter === val ? 'var(--accent-bg)'     : 'var(--glass1)',
                border:     filter === val
                  ? '1px solid var(--accent-border)'
                  : '1px solid var(--glass-border)',
                color: filter === val ? 'var(--text-accent)' : 'var(--text-muted)',
              }}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Error list */}
      {Object.keys(grouped).length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {Object.entries(grouped).map(([groupKey, groupErrors]) => {
            const isOpen    = expanded[groupKey] !== false
            const hasErrors = groupErrors.some(e => e.severity === 'error')
            return (
              <div
                key={groupKey}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--glass-border)' }}
              >
                {/* Group header */}
                <button
                  onClick={() => toggle(groupKey)}
                  className="flex items-center justify-between w-full px-4 py-2.5 text-left transition-all"
                  style={{ background: 'var(--glass1)' }}
                >
                  <div className="flex items-center gap-2">
                    {hasErrors
                      ? <AlertCircle  size={13} style={{ color: 'var(--danger-text)'  }} />
                      : <AlertTriangle size={13} style={{ color: 'var(--warning-text)' }} />
                    }
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {groupKey}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({groupErrors.length} issue{groupErrors.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronUp   size={13} style={{ color: 'var(--text-muted)' }} />
                    : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                  }
                </button>

                {/* Error items */}
                {isOpen && (
                  <div>
                    {groupErrors.map((e, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-2.5"
                        style={{
                          borderTop:  '1px solid var(--glass-border)',
                          background: 'var(--glass1)',
                        }}
                      >
                        {e.severity === 'error'
                          ? <AlertCircle  size={12} style={{ color: 'var(--danger-text)',  marginTop: 2, flexShrink: 0 }} />
                          : <AlertTriangle size={12} style={{ color: 'var(--warning-text)', marginTop: 2, flexShrink: 0 }} />
                        }
                        <div>
                          {e.col && (
                            <span
                              className="text-xs font-mono px-1.5 py-0.5 rounded mr-2"
                              style={{ background: 'var(--glass2)', color: 'var(--text-muted)' }}
                            >
                              {e.col}
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {e.message}
                          </span>
                        </div>
                      </div>
                    ))}
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