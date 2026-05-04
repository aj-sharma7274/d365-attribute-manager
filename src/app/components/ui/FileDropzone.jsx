import React, { useCallback, useState } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import clsx from 'clsx'

export default function FileDropzone({ onFile, disabled = false }) {
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)

  const handleFile = useCallback((f) => {
    if (!f) return

    // Security: validate file type
    const ext       = f.name.split('.').pop()?.toLowerCase()
    const validMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]
    if (ext !== 'xlsx' || (!validMime.includes(f.type) && f.type !== '')) {
      alert('Only .xlsx files are accepted.')
      return
    }

    // Security: limit file size (5MB)
    if (f.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5MB allowed.')
      return
    }

    setFile(f)
    onFile(f)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const clear = () => {
    setFile(null)
    onFile(null)
  }

  // File selected state
  if (file) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl"
        style={{
          background: 'var(--success-bg)',
          border:     '1px solid var(--success-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} style={{ color: 'var(--success-text)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {file.name}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        {!disabled && (
          <button
            onClick={clear}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={15} />
          </button>
        )}
      </div>
    )
  }

  return (
    <label
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-2xl cursor-pointer transition-all duration-200',
        disabled && 'pointer-events-none opacity-40'
      )}
      style={{
        padding:    '36px 24px',
        background: dragging ? 'var(--accent-bg)'    : 'var(--glass1)',
        border:     dragging
          ? '2px dashed var(--accent-primary)'
          : '2px dashed var(--glass-border)',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          background: dragging ? 'var(--accent-bg)' : 'var(--glass2)',
          border:     '1px solid var(--glass-border)',
        }}
      >
        <Upload size={22} style={{ color: dragging ? 'var(--text-accent)' : 'var(--text-muted)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Drop your Excel file here, or{' '}
          <span style={{ color: 'var(--text-accent)' }}>browse</span>
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          .xlsx only · Max 5MB · Formulas automatically rejected
        </p>
      </div>
      <input
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }}
      />
    </label>
  )
}