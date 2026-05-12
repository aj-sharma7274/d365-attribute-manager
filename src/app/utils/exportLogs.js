/**
 * Export audit logs to Excel
 */
import * as XLSX from 'xlsx'

export function exportLogsToExcel(logs) {
  const headers = [
    'Timestamp',
    'Operation',
    'Status',
    'Entity',
    'Field Schema Name',
    'Field Type',
    'Solution',
    'Org URL',
    'Error',
    'Entry Hash',
  ]

  const rows = logs.map(log => [
    new Date(log.timestamp).toLocaleString(),
    log.operation,
    log.status,
    log.entity,
    log.schemaName,
    log.fieldType,
    log.solution,
    log.orgUrl,
    log.error || '',
    log.hash,
  ])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  ws['!cols'] = [
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 30 },
    { wch: 25 },
    { wch: 20 },
    { wch: 35 },
    { wch: 40 },
    { wch: 65 },
  ]
  ws['!freeze']     = { xSplit: 0, ySplit: 1 }
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    }),
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs')

  // Summary sheet
  const successCount = logs.filter(l => l.status    === 'success').length
  const errorCount   = logs.filter(l => l.status    === 'error').length
  const createCount  = logs.filter(l => l.operation === 'CREATE').length
  const deleteCount  = logs.filter(l => l.operation === 'DELETE').length

  const summaryRows = [
    ['D365 Attribute Manager — Audit Log Export'],
    ['Generated',          new Date().toLocaleString()],
    [''],
    ['SUMMARY'],
    ['Total Entries',       logs.length],
    ['Successful',          successCount],
    ['Failed',              errorCount],
    ['Create Operations',   createCount],
    ['Delete Operations',   deleteCount],
    [''],
    ['SECURITY NOTE'],
    ['Each entry contains a SHA-256 hash chained to the previous entry.'],
    ['This provides tamper-evidence — any modification breaks the chain.'],
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 22 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Trigger download
  const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `D365_AuditLogs_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}