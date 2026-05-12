import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
    Download, ArrowLeft, ArrowRight, Trash2,
    AlertTriangle, CheckCircle, XCircle,
    AlertCircle, RotateCcw, Shield
} from 'lucide-react'

import { generateBulkDeleteTemplate } from '../utils/templateGenerator.js'
import { bulkCheckDependencies, bulkDeleteAttributes } from '../utils/d365Api.js'

import StepWizard from '../components/ui/StepWizard.jsx'
import FileDropzone from '../components/ui/FileDropzone.jsx'
import ProgressTracker from '../components/ui/ProgressTracker.jsx'
import { useLogStore } from '../store/logStore.js'
import { useAuthStore } from '../store/authStore.js'

const STEPS = ['Download Template', 'Upload & Validate', 'Review & Confirm', 'Delete']

// ── Parse delete template ──────────────────────────────────────────────────────
function parseDeleteWorkbook(workbook) {
    const errors = []
    const rows = []

    const ws = workbook.Sheets['Fields to Delete']
    if (!ws) {
        errors.push('Sheet "Fields to Delete" not found. Please use the correct template.')
        return { rows, errors }
    }

    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const dataRows = allRows.slice(3).filter(row =>
        row.some(cell => String(cell ?? '').trim() !== '')
    )

    if (dataRows.length === 0) {
        errors.push('No data rows found. Please fill in the template.')
        return { rows, errors }
    }

    if (dataRows.length > 200) {
        errors.push(`Too many rows (${dataRows.length}). Maximum 200 fields per delete batch.`)
        return { rows, errors }
    }

    const seen = new Set()

    dataRows.forEach((rawRow, idx) => {
        const rowNum = idx + 4
        const EntitySchemaName = String(rawRow[0] ?? '').trim()
        const FieldSchemaName = String(rawRow[1] ?? '').trim()
        const Reason = String(rawRow[2] ?? '').trim()

        // Security: formula check
        if (EntitySchemaName.startsWith('=') || FieldSchemaName.startsWith('=')) {
            errors.push(`Row ${rowNum}: Formula detected and rejected.`)
            return
        }

        if (!EntitySchemaName) { errors.push(`Row ${rowNum}: Entity Schema Name is required.`); return }
        if (!FieldSchemaName) { errors.push(`Row ${rowNum}: Field Schema Name is required.`); return }

        // Validate format
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(EntitySchemaName))
            errors.push(`Row ${rowNum}: Entity name "${EntitySchemaName}" has invalid characters.`)
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(FieldSchemaName))
            errors.push(`Row ${rowNum}: Field name "${FieldSchemaName}" has invalid characters.`)

        // Duplicate check
        const key = `${EntitySchemaName}|${FieldSchemaName}`.toLowerCase()
        if (seen.has(key)) {
            errors.push(`Row ${rowNum}: Duplicate entry "${FieldSchemaName}" on "${EntitySchemaName}".`)
        } else {
            seen.add(key)
            rows.push({ EntitySchemaName, FieldSchemaName, Reason, _rowNum: rowNum })
        }
    })

    return { rows, errors }
}

export default function BulkDeletePage() {
    const navigate = useNavigate()
    const { addLog } = useLogStore()
    const { orgUrl } = useAuthStore()

    const [step, setStep] = useState(0)
    const [file, setFile] = useState(null)
    const [parseErrors, setParseErrors] = useState([])
    const [parsedRows, setParsedRows] = useState([])
    const [checkResults, setCheckResults] = useState([])
    const [checking, setChecking] = useState(false)
    const [checkProgress, setCheckProgress] = useState(null)
    const [progress, setProgress] = useState(null)
    const [deleteResults, setDeleteResults] = useState([])
    const [deleting, setDeleting] = useState(false)
    const [done, setDone] = useState(false)

    // ── Step 1: Download template ──────────────────────────────────────────────
    const handleDownload = () => {
        generateBulkDeleteTemplate()
        toast.success('Delete template downloaded!')
    }

    // ── Step 2: Upload + parse ─────────────────────────────────────────────────
    const handleFile = useCallback((f) => {
        setFile(f)
        setParseErrors([])
        setParsedRows([])
    }, [])

    const handleValidate = useCallback(() => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result)
                const wb = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false })
                const { rows, errors } = parseDeleteWorkbook(wb)

                setParseErrors(errors)
                setParsedRows(rows)

                if (errors.length > 0) {
                    toast.error(`${errors.length} error${errors.length !== 1 ? 's' : ''} found. Fix and re-upload.`)
                    return
                }

                if (rows.length === 0) {
                    toast.error('No valid rows found.')
                    return
                }

                toast.success(`${rows.length} fields parsed. Checking dependencies...`)
                setStep(2)
                runDependencyCheck(rows)

            } catch (err) {
                toast.error('Failed to read Excel file.')
                console.error('[D365AM]', err.message)
            }
        }
        reader.readAsArrayBuffer(file)
    }, [file])

    // ── Dependency check ───────────────────────────────────────────────────────
    const runDependencyCheck = useCallback(async (rows) => {
        setChecking(true)
        setCheckResults([])
        setCheckProgress(null)

        try {
            const results = await bulkCheckDependencies(rows, (prog) => {
                setCheckProgress(prog)
            })
            setCheckResults(results)
        } catch (err) {
            toast.error(`Dependency check failed: ${err.message}`)
        } finally {
            setChecking(false)
        }
    }, [])

    // ── Step 3: Delete ─────────────────────────────────────────────────────────
    const handleDelete = useCallback(async () => {
        const safeFields = checkResults.filter(r => r.safe)
        if (safeFields.length === 0) {
            toast.error('No safe fields to delete.')
            return
        }

        setDeleting(true)
        setDeleteResults([])
        setStep(3)

        try {
            const results = await bulkDeleteAttributes(safeFields, (prog) => {
                setProgress(prog)
                if (prog.status !== 'processing') {
                    setDeleteResults(prev => [...prev, {
                        success: prog.status === 'success',
                        schemaName: prog.row.FieldSchemaName,
                        error: prog.error,
                        row: prog.row,
                    }])
                }
            })

            const successCount = results.filter(r => r.success).length
            const errorCount = results.filter(r => !r.success).length

            if (errorCount === 0) {
                toast.success(`${successCount} fields deleted successfully!`)
            } else {
                toast(`${successCount} deleted, ${errorCount} failed.`, { icon: '⚠️' })
            }
            // Log all results
            for (const r of results) {
                await addLog({
                    operation: 'DELETE',
                    status: r.success ? 'success' : 'error',
                    entity: r.row?.EntitySchemaName || '',
                    schemaName: r.schemaName || '',
                    fieldType: '',
                    solution: '',
                    error: r.error || null,
                    orgUrl,
                })
            }
            setDone(true)
        } catch (err) {
            toast.error(`Delete failed: ${err.message}`)
        } finally {
            setDeleting(false)
        }
    }, [checkResults])

    const reset = () => {
        setStep(0); setFile(null); setParseErrors([]); setParsedRows([])
        setCheckResults([]); setChecking(false); setCheckProgress(null)
        setProgress(null); setDeleteResults([]); setDeleting(false); setDone(false)
    }

    // Categorize check results
    const safeFields = checkResults.filter(r => r.safe)
    const unsafeFields = checkResults.filter(r => r.exists && !r.safe && !r.isSystem)
    const systemFields = checkResults.filter(r => r.isSystem)
    const missingFields = checkResults.filter(r => !r.exists)

    return (
        <div className="space-y-6 max-w-3xl animate-fade-in">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-xl transition-all"
                    style={{
                        background: 'var(--glass1)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-muted)',
                    }}
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <h1 className="font-display font-bold text-2xl"
                        style={{ color: 'var(--text-primary)' }}>
                        Bulk Delete Fields
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        Safely remove multiple D365 attributes with dependency checking
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
                            Step 1 — Download Delete Template
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            Fill in the entity and field names you want to delete.
                        </p>
                    </div>

                    {/* Warning */}
                    <div
                        className="flex items-start gap-3 p-4 rounded-xl"
                        style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                    >
                        <AlertTriangle size={16} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger-text)' }}>
                                Deletion is permanent and cannot be undone
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Always export a solution backup before bulk deleting fields.
                                The extension will check for dependencies before deleting anything.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={handleDownload} className="btn-primary">
                            <Download size={15} />
                            Download Delete Template (.xlsx)
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
                            Step 2 — Upload Delete List
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            Upload your filled template. Dependencies will be checked automatically.
                        </p>
                    </div>

                    <FileDropzone onFile={handleFile} />

                    {/* Parse errors */}
                    {parseErrors.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold" style={{ color: 'var(--danger-text)' }}>
                                {parseErrors.length} error{parseErrors.length !== 1 ? 's' : ''} found:
                            </p>
                            {parseErrors.map((e, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 px-3 py-2 rounded-lg"
                                    style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                                >
                                    <AlertCircle size={13} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e}</span>
                                </div>
                            ))}
                        </div>
                    )}

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
                            Validate & Check Dependencies
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Step 2: Review & Confirm ── */}
            {step === 2 && (
                <div className="card space-y-5">
                    <div>
                        <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            Step 3 — Review & Confirm
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            {checking
                                ? 'Checking dependencies...'
                                : `Review the results below. Only safe fields will be deleted.`}
                        </p>
                    </div>

                    {/* Checking progress */}
                    {checking && checkProgress && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                                <span>Checking field {checkProgress.current} of {checkProgress.total}...</span>
                                <span>{checkProgress.row?.FieldSchemaName}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--glass2)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${Math.round((checkProgress.current / checkProgress.total) * 100)}%`,
                                        background: 'var(--gradient-primary)',
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Results summary */}
                    {!checking && checkResults.length > 0 && (
                        <>
                            {/* Summary pills */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'Safe to Delete', count: safeFields.length, color: 'success' },
                                    { label: 'Has Dependencies', count: unsafeFields.length, color: 'warning' },
                                    { label: 'System Fields', count: systemFields.length, color: 'danger' },
                                    { label: 'Not Found', count: missingFields.length, color: 'danger' },
                                ].map(({ label, count, color }) => (
                                    <div
                                        key={label}
                                        className="text-center p-3 rounded-xl"
                                        style={{
                                            background: `var(--${color}-bg)`,
                                            border: `1px solid var(--${color}-border)`,
                                        }}
                                    >
                                        <div className="text-xl font-bold font-mono"
                                            style={{ color: `var(--${color}-text)` }}>
                                            {count}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {label}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Field list */}
                            <div className="space-y-2 max-h-72 overflow-y-auto">

                                {/* Safe fields */}
                                {safeFields.map((r, i) => (
                                    <FieldRow key={i} icon={<CheckCircle size={14} style={{ color: 'var(--success-text)' }} />}
                                        bg="var(--success-bg)" border="var(--success-border)"
                                        entity={r.row.EntitySchemaName} field={r.row.FieldSchemaName}
                                        tag="Safe to delete" tagColor="var(--success-text)"
                                    />
                                ))}

                                {/* Unsafe fields */}
                                {unsafeFields.map((r, i) => (
                                    <div key={i}>
                                        <FieldRow
                                            icon={<AlertTriangle size={14} style={{ color: 'var(--warning-text)' }} />}
                                            bg="var(--warning-bg)" border="var(--warning-border)"
                                            entity={r.row.EntitySchemaName} field={r.row.FieldSchemaName}
                                            tag={`${r.dependencies.length} dependenc${r.dependencies.length !== 1 ? 'ies' : 'y'} — SKIPPED`}
                                            tagColor="var(--warning-text)"
                                        />
                                        {/* Dependency removal steps */}
                                        {r.dependencies.length > 0 && (
                                            <div
                                                className="mx-4 mb-2 p-3 rounded-b-xl space-y-2"
                                                style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)', borderTop: 'none' }}
                                            >
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    How to remove dependencies:
                                                </p>
                                                {r.dependencies.map((dep, di) => (
                                                    <div key={di} className="space-y-1">
                                                        <p style={{ fontSize: 11, color: 'var(--warning-text)', fontWeight: 500 }}>
                                                            {di + 1}. {dep.typeName}
                                                        </p>
                                                        {dep.steps.map((s, si) => (
                                                            <p key={si} style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 12 }}>
                                                                → {s}
                                                            </p>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* System fields */}
                                {systemFields.map((r, i) => (
                                    <FieldRow key={i} icon={<Shield size={14} style={{ color: 'var(--danger-text)' }} />}
                                        bg="var(--danger-bg)" border="var(--danger-border)"
                                        entity={r.row.EntitySchemaName} field={r.row.FieldSchemaName}
                                        tag="System field — cannot delete" tagColor="var(--danger-text)"
                                    />
                                ))}

                                {/* Missing fields */}
                                {missingFields.map((r, i) => (
                                    <FieldRow key={i} icon={<XCircle size={14} style={{ color: 'var(--danger-text)' }} />}
                                        bg="var(--danger-bg)" border="var(--danger-border)"
                                        entity={r.row.EntitySchemaName} field={r.row.FieldSchemaName}
                                        tag="Field not found" tagColor="var(--danger-text)"
                                    />
                                ))}
                            </div>

                            {/* Confirmation */}
                            {safeFields.length > 0 && (
                                <div
                                    className="p-4 rounded-xl"
                                    style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
                                >
                                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--danger-text)' }}>
                                        ⚠️ You are about to permanently delete {safeFields.length} field{safeFields.length !== 1 ? 's' : ''}
                                    </p>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        This cannot be undone. Fields with dependencies will be skipped automatically.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Actions */}
                    {!checking && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep(1); setCheckResults([]) }}
                                className="btn-secondary"
                            >
                                <ArrowLeft size={14} /> Cancel
                            </button>
                            {safeFields.length > 0 && (
                                <button
                                    onClick={handleDelete}
                                    className="btn-danger"
                                    style={{ fontWeight: 600 }}
                                >
                                    <Trash2 size={14} />
                                    Delete {safeFields.length} Safe Field{safeFields.length !== 1 ? 's' : ''}
                                </button>
                            )}
                            {safeFields.length === 0 && !checking && checkResults.length > 0 && (
                                <div
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                                    style={{ background: 'var(--glass1)', color: 'var(--text-muted)' }}
                                >
                                    No safe fields to delete
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Step 3: Deleting ── */}
            {step === 3 && (
                <div className="card space-y-5">
                    <div>
                        <h2 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            {done ? '✓ Done!' : 'Step 4 — Deleting Fields...'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                            {done
                                ? 'Deletion complete.'
                                : 'Do not close this tab. Deleting fields from D365...'}
                        </p>
                    </div>

                    <ProgressTracker progress={progress} results={deleteResults} />

                    {done && (
                        <div className="flex gap-3">
                            <button onClick={reset} className="btn-secondary">
                                <RotateCcw size={14} /> Start New Batch
                            </button>
                            <button onClick={() => navigate('/logs')} className="btn-primary">
                                View Logs
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Field row component ────────────────────────────────────────────────────────
function FieldRow({ icon, bg, border, entity, field, tag, tagColor }) {
    return (
        <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ background: bg, border: `1px solid ${border}` }}
        >
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {field}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {entity}
                    </span>
                </div>
            </div>
            <span style={{ fontSize: 11, color: tagColor, textAlign: 'right', maxWidth: 200 }}>
                {tag}
            </span>
        </div>
    )
}