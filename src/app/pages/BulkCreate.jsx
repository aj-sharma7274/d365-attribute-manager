import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
  Download, ArrowLeft, ArrowRight,
  Play, RotateCcw, FileSpreadsheet, CheckCircle
} from 'lucide-react'

import { generateBulkCreateTemplate } from '../utils/templateGenerator.js'
import { validateWorkbook }           from '../utils/validator.js'
import { bulkCreateAttributes }       from '../utils/d365Api.js'
import { useAuthStore }               from '../store/authStore.js'

import StepWizard        from '../components/ui/StepWizard.jsx'
import FileDropzone      from '../components/ui/FileDropzone.jsx'
import ValidationReport  from '../components/ui/ValidationReport.jsx'
import ProgressTracker   from '../components/ui/ProgressTracker.jsx'

const STEPS = ['Download Template', 'Upload File', 'Validate', 'Process']

const SHEET_TYPES = [
  'Text (Single Line)',  'Text (Multi Line)',
  'Whole Number',        'Decimal Number',
  'Floating Point',      'Currency',
  'Date & Time',         'Choice (Option Set)',
  'Multi-Select Choice', 'Yes No (Boolean)',
  'Lookup',              'File',
  'Image',
]

export default function BulkCreatePage() {
  const navigate         = useNavigate()
  const { orgUrl }       = useAuthStore()

  const [step,           setStep]           = useState(0)
  const [file,           setFile]           = useState(null)
  const [validation,     setValidation]     = useState(null)
  const [allRows,        setAllRows]        = useState([])
  const [progress,       setProgress]       = useState(null)
  const [processResults, setProcessResults] = useState([])
  const [processing,     setProcessing]     = useState(false)
  const [done,           setDone]           = useState(false)

  // ── Step 1: Download template ──────────────────────────────────────────────
  const handleDownload = () => {
    generateBulkCreateTemplate()
    toast.success('Template downloaded!')
  }

  // ── Step 2: File selected ──────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    setFile(f)
    setValidation(null)
    setAllRows([])
  }, [])

  // ── Step 3: Validate ───────────────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        // Security: disable formula evaluation
        const wb   = XLSX.read(data, {
          type:        'array',
          cellFormula: false,
          cellHTML:    false,
        })
        const results = validateWorkbook(wb)
        setValidation(results)

        if (results.totalRows === 0) {
          toast.error('No data rows found. Please fill in the template.')
          return
        }

        const rows = Object.values(results.parsedSheets).flat()
        setAllRows(rows)
        setStep(2)

        if (results.isValid) {
          toast.success(`${results.totalRows} rows validated — no errors!`)
        } else {
          toast.error(`${results.errorCount} error${results.errorCount !== 1 ? 's' : ''} found. Fix in Excel and re-upload.`)
        }
      } catch (err) {
        toast.error('Failed to read Excel file. Ensure it is a valid .xlsx file.')
        console.error('[D365AM] Excel parse error:', err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [file])

  // ── Step 4: Process ────────────────────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!validation?.isValid || allRows.length === 0) return

    setProcessing(true)
    setProcessResults([])
    setStep(3)

    try {
      const results = await bulkCreateAttributes(allRows, (prog) => {
        setProgress(prog)
        if (prog.status !== 'processing') {
          setProcessResults(prev => [...prev, {
            success:    prog.status === 'success',
            schemaName: prog.row.SchemaName,
            error:      prog.error,
            row:        prog.row,
          }])
        }
      })

      const successCount = results.filter(r => r.success).length
      const errorCount   = results.filter(r => !r.success).length

      if (errorCount === 0) {
        toast.success(`All ${successCount} fields created successfully!`)
      } else {
        toast(`${successCount} succeeded, ${errorCount} failed.`, { icon: '⚠️' })
      }
      setDone(true)
    } catch (err) {
      toast.error(`Process failed: ${err.message}`)
      setProcessing(false)
    }
  }, [validation, allRows])

  const reset = () => {
    setStep(0); setFile(null); setValidation(null)
    setAllRows([]); setProgress(null); setProcessResults([])
    setProcessing(false); setDone(false)
  }

  // Sheet summary for step 2
  const sheetSummary = validation
    ? Object.entries(validation.parsedSheets)
        .map(([name, rows]) => ({ name, count: rows.length }))
        .filter(s => s.count > 0)
    : []

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl transition-all"
          style={{
            background: 'var(--glass1)',
            border:     '1px solid var(--glass-border)',
            color:      'var(--text-muted)',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display font-bold text-2xl"
            style={{ color: 'var(--text-primary)' }}>
            Bulk Create Fields
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Create multiple D365 attributes at once using an Excel template
          </p>
        </div>
      </div>

      {/* Step wizard */}
      <StepWizard steps={STEPS} currentStep={step} />

      {/* ── Step 0: Download Template ── */}
      {step === 0 && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Step 1 — Download Template
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              The template has one sheet per field type. Fill your fields and upload it back.
            </p>
          </div>

          {/* Sheet type list */}
          <div className="grid grid-cols-3 gap-2">
            {SHEET_TYPES.map(type => (
              <div
                key={type}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: 'var(--glass1)',
                  border:     '1px solid var(--glass-border)',
                }}
              >
                <FileSpreadsheet size={12} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{type}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleDownload} className="btn-primary">
              <Download size={15} />
              Download Template (.xlsx)
            </button>
            <button onClick={() => setStep(1)} className="btn-secondary">
              Skip — I already have the template
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Step 2 — Upload Filled Template
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              All data is validated locally before anything is sent to D365.
            </p>
          </div>

          <FileDropzone onFile={handleFile} />

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-secondary">
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={handleValidate}
              disabled={!file}
              className="btn-primary"
            >
              <CheckCircle size={15} />
              Validate File
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Validation Results ── */}
      {step === 2 && validation && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Step 3 — Validation Results
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {validation.isValid
                ? 'All rows passed validation. Review and proceed.'
                : 'Errors found below. Fix in Excel and re-upload.'
              }
            </p>
          </div>

          {/* Sheet summary */}
          {validation.isValid && sheetSummary.length > 0 && (
            <div className="space-y-2">
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Fields to create
              </p>
              <div className="grid grid-cols-3 gap-2">
                {sheetSummary.map(s => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between px-3 py-2 rounded-xl"
                    style={{
                      background: 'var(--accent-bg)',
                      border:     '1px solid var(--accent-border)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'monospace' }}>
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}
              >
                <span style={{ fontSize: 12, color: 'var(--success-text)' }}>
                  Total: <strong>{allRows.length} fields</strong> across {sheetSummary.length} type{sheetSummary.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          <ValidationReport results={validation} />

          <div className="flex gap-3">
            <button
              onClick={() => { setStep(1); setValidation(null) }}
              className="btn-secondary"
            >
              <ArrowLeft size={14} /> Re-upload
            </button>
            {validation.isValid && (
              <button onClick={handleProcess} className="btn-primary">
                <Play size={14} />
                Create {allRows.length} Fields in D365
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Processing ── */}
      {step === 3 && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {done ? '✓ Done!' : 'Step 4 — Creating Fields...'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {done
                ? 'Operation complete. Check logs for full details.'
                : 'Do not close this tab. Creating fields in D365...'
              }
            </p>
          </div>

          <ProgressTracker progress={progress} results={processResults} />

          {done && (
            <div className="flex gap-3">
              <button onClick={reset} className="btn-secondary">
                <RotateCcw size={14} /> Start New Batch
              </button>
              <button
                onClick={() => navigate('/logs')}
                className="btn-primary"
              >
                View Logs
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}