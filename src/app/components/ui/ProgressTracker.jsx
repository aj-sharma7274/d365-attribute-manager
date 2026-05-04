import React from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export default function ProgressTracker({ progress, results }) {
  if (!progress) return null

  const { current, total, row, status } = progress
  const pct          = Math.round((current / total) * 100)
  const successCount = results.filter(r => r.success).length
  const errorCount   = results.filter(r => !r.success).length

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Progress bar */}
      <div>
        <div className="flex justify-between mb-2">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Processing fields...
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {current}/{total}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--glass2)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width:      `${pct}%`,
              background: 'var(--gradient-primary)',
            }}
          />
        </div>
        <div className="flex gap-4 mt-2">
          <span style={{ fontSize: 11, color: 'var(--success-text)' }}>
            ✓ {successCount} succeeded
          </span>
          {errorCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--danger-text)' }}>
              ✕ {errorCount} failed
            </span>
          )}
        </div>
      </div>

      {/* Current item */}
      {row && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: 'var(--glass1)',
            border:     '1px solid var(--glass-border)',
          }}
        >
          {status === 'processing' && (
            <Loader size={14} className="animate-spin" style={{ color: 'var(--text-accent)' }} />
          )}
          {status === 'success' && (
            <CheckCircle size={14} style={{ color: 'var(--success-text)' }} />
          )}
          {status === 'error' && (
            <XCircle size={14} style={{ color: 'var(--danger-text)' }} />
          )}
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {row.SchemaName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              {row.EntitySchemaName} · {row._sheet}
            </span>
          </div>
        </div>
      )}

      {/* Recent results */}
      {results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {[...results].reverse().slice(0, 8).map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{
                background: r.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                border:     `1px solid ${r.success ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {r.success
                ? <CheckCircle size={12} style={{ color: 'var(--success-text)', flexShrink: 0 }} />
                : <XCircle     size={12} style={{ color: 'var(--danger-text)',  flexShrink: 0 }} />
              }
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {r.schemaName}
              </span>
              {!r.success && (
                <span style={{
                  fontSize:   10,
                  color:      'var(--danger-text)',
                  marginLeft: 'auto',
                  maxWidth:   200,
                  textAlign:  'right',
                }}>
                  {r.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}