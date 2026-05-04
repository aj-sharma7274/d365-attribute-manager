/**
 * D365 Attribute Manager — Validation Engine
 * Validates all Excel rows BEFORE any D365 API call
 * Security: sanitizes inputs, rejects formulas, checks all rules
 */
import * as XLSX from 'xlsx'
import { DATATYPE_SHEETS } from './templateGenerator.js'

// ── Allowed values ────────────────────────────────────────────────────────────
const ALLOWED = {
  yesNo: ['yes', 'no'],
  stringFormats: ['text', 'email', 'phone', 'url', 'tickersymbol'],
  memoFormats: ['textarea', 'richtext'],
  intFormats: ['none', 'duration', 'timezone', 'language', 'locale'],
  dateFormats: ['dateandtime', 'dateonly'],
  dateBehaviors: ['userlocal', 'dateonly', 'timezoneindependent'],
  menuBehaviors: ['usecollectionname', 'uselabel', 'donotdisplay'],
  boolDefaults: ['true', 'false'],
  httpMethods: ['get', 'post', 'patch', 'delete'],
}

const SCHEMA_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/
const PREFIX_REGEX = /^[a-z0-9]+_[a-zA-Z]/
const OPTION_REGEX = /^[^:,]+:[1-9][0-9]*$/

// ── Sanitize a cell value ─────────────────────────────────────────────────────
function sanitize(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  // Security: reject formula injection
  if (str.trim().startsWith('=') ||
    str.trim().startsWith('+') ||
    str.trim().startsWith('-') ||
    str.trim().startsWith('@')) {
    return '__FORMULA_REJECTED__'
  }
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .replace(/[<>"'`]/g, '')                             // strip HTML injection
    .trim()
    .slice(0, 2000)
}

// ── Parse a raw row into a clean object ───────────────────────────────────────
function parseRow(rawRow, colDefs) {
  const obj = {}
  colDefs.forEach((col, i) => {
    obj[col.key] = sanitize(rawRow[i])
  })
  return obj
}

// ── Validate a single row ─────────────────────────────────────────────────────
function validateRow(row, sheetName, rowNum, seenSchemaNames) {
  const errors = []

  const err = (col, msg, severity = 'error') => {
    errors.push({ sheet: sheetName, row: rowNum, col, message: msg, severity })
  }

  // Formula injection check
  Object.entries(row).forEach(([key, val]) => {
    if (val === '__FORMULA_REJECTED__') {
      err(key, `Formula detected and rejected in column "${key}". Use plain text only.`)
    }
  })

  // ── Common field validation ──────────────────────────────────────────────

  // Solution Name
  if (!row.SolutionName) {
    err('SolutionName', 'Solution Name is required.')
  } else if (!SCHEMA_REGEX.test(row.SolutionName)) {
    err('SolutionName', `"${row.SolutionName}" is not a valid solution name. Letters, numbers, underscores only.`)
  }

  // Entity Schema Name
  if (!row.EntitySchemaName) {
    err('EntitySchemaName', 'Entity Schema Name is required.')
  } else if (!SCHEMA_REGEX.test(row.EntitySchemaName)) {
    err('EntitySchemaName', `"${row.EntitySchemaName}" contains invalid characters.`)
  }

  // Display Name
  if (!row.DisplayName) {
    err('DisplayName', 'Field Display Name is required.')
  } else if (row.DisplayName.length > 200) {
    err('DisplayName', `Display Name too long (${row.DisplayName.length} chars, max 200).`)
  }

  // Schema Name
  if (!row.SchemaName) {
    err('SchemaName', 'Field Schema Name is required.')
  } else {
    if (!SCHEMA_REGEX.test(row.SchemaName)) {
      err('SchemaName', `"${row.SchemaName}" contains invalid characters. Use letters, numbers, underscores only.`)
    } else if (!PREFIX_REGEX.test(row.SchemaName)) {
      err('SchemaName', `"${row.SchemaName}" must start with a publisher prefix e.g. new_, cr123_`, 'warning')
    } else if (row.SchemaName.length > 100) {
      err('SchemaName', `Schema Name too long (${row.SchemaName.length} chars, max 100).`)
    }

    // Duplicate detection within batch
    const dupKey = `${row.EntitySchemaName}|${row.SchemaName}`.toLowerCase()
    if (seenSchemaNames.has(dupKey)) {
      err('SchemaName', `Duplicate schema name "${row.SchemaName}" on entity "${row.EntitySchemaName}" in this batch.`)
    } else {
      seenSchemaNames.add(dupKey)
    }
  }

  // Yes/No fields
  for (const field of ['IsRequired', 'IsAuditEnabled', 'IsSearchable']) {
    if (row[field] && !ALLOWED.yesNo.includes(row[field].toLowerCase())) {
      err(field, `"${row[field]}" is invalid. Must be "Yes" or "No".`)
    }
  }

  // ── Datatype-specific validation ─────────────────────────────────────────
  const sheet = DATATYPE_SHEETS.find(s => s.name === sheetName)
  if (!sheet) return errors

  switch (sheet.apiType) {

    case 'StringAttributeMetadata': {
      if (!row.MaxLength) {
        err('MaxLength', 'Max Length is required.')
      } else {
        const n = parseInt(row.MaxLength)
        if (isNaN(n) || n < 1 || n > 4000)
          err('MaxLength', `Max Length must be 1–4000. Got "${row.MaxLength}".`)
      }
      if (row.Format && !ALLOWED.stringFormats.includes(row.Format.toLowerCase()))
        err('Format', `Invalid format "${row.Format}". Allowed: ${ALLOWED.stringFormats.join(', ')}.`)
      break
    }

    case 'MemoAttributeMetadata': {
      if (row.MaxLength) {
        const n = parseInt(row.MaxLength)
        if (isNaN(n) || n < 1 || n > 1048576)
          err('MaxLength', `Max Length must be 1–1,048,576. Got "${row.MaxLength}".`)
      }
      if (row.Format && !ALLOWED.memoFormats.includes(row.Format.toLowerCase()))
        err('Format', `Invalid format "${row.Format}". Allowed: ${ALLOWED.memoFormats.join(', ')}.`)
      break
    }

    case 'IntegerAttributeMetadata': {
      if (row.MinValue && isNaN(parseInt(row.MinValue)))
        err('MinValue', `Min Value must be an integer. Got "${row.MinValue}".`)
      if (row.MaxValue && isNaN(parseInt(row.MaxValue)))
        err('MaxValue', `Max Value must be an integer. Got "${row.MaxValue}".`)
      if (row.MinValue && row.MaxValue &&
        parseInt(row.MinValue) >= parseInt(row.MaxValue))
        err('MinValue', 'Min Value must be less than Max Value.')
      if (row.Format && !ALLOWED.intFormats.includes(row.Format.toLowerCase()))
        err('Format', `Invalid format "${row.Format}". Allowed: ${ALLOWED.intFormats.join(', ')}.`)
      break
    }

    case 'DecimalAttributeMetadata':
    case 'DoubleAttributeMetadata': {
      if (row.Precision) {
        const p = parseInt(row.Precision)
        if (isNaN(p) || p < 0 || p > 10)
          err('Precision', `Precision must be 0–10. Got "${row.Precision}".`)
      }
      if (row.MinValue && isNaN(parseFloat(row.MinValue)))
        err('MinValue', 'Min Value must be a number.')
      if (row.MaxValue && isNaN(parseFloat(row.MaxValue)))
        err('MaxValue', 'Max Value must be a number.')
      if (row.MinValue && row.MaxValue &&
        parseFloat(row.MinValue) >= parseFloat(row.MaxValue))
        err('MinValue', 'Min Value must be less than Max Value.')
      break
    }

    case 'MoneyAttributeMetadata': {
      if (row.Precision) {
        const p = parseInt(row.Precision)
        if (isNaN(p) || p < 0 || p > 4)
          err('Precision', `Currency Precision must be 0–4. Got "${row.Precision}".`)
      }
      if (row.PrecisionSource && !['0', '1', '2'].includes(row.PrecisionSource.trim()))
        err('PrecisionSource', `Precision Source must be 0, 1, or 2. Got "${row.PrecisionSource}".`)
      break
    }

    case 'DateTimeAttributeMetadata': {
      if (!row.Format) {
        err('Format', 'Date Format is required.')
      } else if (!ALLOWED.dateFormats.includes(row.Format.toLowerCase())) {
        err('Format', `Invalid format "${row.Format}". Allowed: ${ALLOWED.dateFormats.join(', ')}.`)
      }
      if (!row.DateTimeBehavior) {
        err('DateTimeBehavior', 'Date Behavior is required.')
      } else if (!ALLOWED.dateBehaviors.includes(row.DateTimeBehavior.toLowerCase())) {
        err('DateTimeBehavior', `Invalid behavior "${row.DateTimeBehavior}". Allowed: ${ALLOWED.dateBehaviors.join(', ')}.`)
      }
      break
    }

    case 'PicklistAttributeMetadata':
    case 'MultiSelectPicklistAttributeMetadata': {
      const useExisting = row.UseExistingOptionSet?.toLowerCase()
      const createAsGlobal = row.CreateAsGlobalSet?.toLowerCase()

      if (useExisting === 'yes') {
        if (!row.OptionSetName)
          err('OptionSetName', 'Global Option Set Name is required when Use Existing = Yes.')
        else if (!SCHEMA_REGEX.test(row.OptionSetName))
          err('OptionSetName', `"${row.OptionSetName}" is not a valid option set name.`)
      } else if (createAsGlobal === 'yes') {
        if (!row.OptionSetName)
          err('OptionSetName', 'Global Option Set Name is required when Create as Global = Yes.')
        else if (!SCHEMA_REGEX.test(row.OptionSetName))
          err('OptionSetName', `"${row.OptionSetName}" is not a valid option set name.`)
        if (!row.Options)
          err('Options', 'Options are required when creating a new global option set.')
      } else {
        if (!row.Options) {
          err('Options', 'Options are required. Format: Label:Value,Label:Value,...')
        } else {
          const pairs = row.Options.split(',').map(p => p.trim())
          const values = new Set()
          if (pairs.length < 2)
            err('Options', 'At least 2 options are required.', 'warning')
          pairs.forEach((pair, i) => {
            if (!OPTION_REGEX.test(pair)) {
              err('Options', `Option ${i + 1} "${pair}" is invalid. Format: Label:Value (Value must be positive integer).`)
            } else {
              const val = pair.split(':')[1]
              if (values.has(val)) err('Options', `Duplicate option value "${val}".`)
              values.add(val)
            }
          })
          if (row.DefaultValue && !values.has(row.DefaultValue.trim()))
            err('DefaultValue', `Default value "${row.DefaultValue}" must match one of the option values.`)
        }
      }
      break
    }

    case 'BooleanAttributeMetadata': {
      // TrueLabel and FalseLabel are optional — default to Yes/No in API
      if (row.DefaultValue && !ALLOWED.boolDefaults.includes(row.DefaultValue.toLowerCase()))
        err('DefaultValue', `Default Value must be "true" or "false". Got "${row.DefaultValue}".`)
      break
    }

    case 'LookupAttributeMetadata': {
      if (!row.TargetEntity) {
        err('TargetEntity', 'Target Entity is required for Lookup fields.')
      } else if (!SCHEMA_REGEX.test(row.TargetEntity)) {
        err('TargetEntity', `"${row.TargetEntity}" is not a valid entity schema name.`)
      }
      if (row.RelationshipSchemaName && !SCHEMA_REGEX.test(row.RelationshipSchemaName))
        err('RelationshipSchemaName', `"${row.RelationshipSchemaName}" is not a valid relationship name.`)
      if (row.MenuBehavior && !ALLOWED.menuBehaviors.includes(row.MenuBehavior.toLowerCase()))
        err('MenuBehavior', `Invalid menu behavior "${row.MenuBehavior}". Allowed: ${ALLOWED.menuBehaviors.join(', ')}.`)
      break
    }

    case 'FileAttributeMetadata': {
      if (!row.MaxSizeInKB) {
        err('MaxSizeInKB', 'Max File Size is required.')
      } else {
        const kb = parseInt(row.MaxSizeInKB)
        if (isNaN(kb) || kb < 1 || kb > 131072)
          err('MaxSizeInKB', `Max Size must be 1–131,072 KB. Got "${row.MaxSizeInKB}".`)
      }
      break
    }

    case 'ImageAttributeMetadata': {
      if (row.IsPrimaryImage && !ALLOWED.yesNo.includes(row.IsPrimaryImage.toLowerCase()))
        err('IsPrimaryImage', '"Primary Image" must be "Yes" or "No".')
      if (row.CanStoreFullImage && !ALLOWED.yesNo.includes(row.CanStoreFullImage.toLowerCase()))
        err('CanStoreFullImage', '"Store Full Image" must be "Yes" or "No".')
      if (row.MaxSizeInKB) {
        const kb = parseInt(row.MaxSizeInKB)
        if (isNaN(kb) || kb < 1 || kb > 131072)
          err('MaxSizeInKB', `Max Size must be 1–131,072 KB. Got "${row.MaxSizeInKB}".`)
      }
      break
    }
  }

  return errors
}

// ── Main: parse + validate uploaded workbook ──────────────────────────────────
export function validateWorkbook(workbook) {
  const results = {
    totalRows: 0,
    errorCount: 0,
    warningCount: 0,
    errors: [],
    parsedSheets: {},
    isValid: false,
  }

  // Security: limit sheet count
  if (workbook.SheetNames.length > 20) {
    results.errors.push({
      sheet: 'File', row: 0, col: '',
      message: 'File has too many sheets (max 20). This may be a malicious file.',
      severity: 'error',
    })
    return results
  }

  const seenSchemaNames = new Set()
  // Strip emojis from sheet names for matching
  function stripEmoji(str) {
    return str.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[\u2600-\u27BF]/gu, '').trim()
  }

  const sheetMap = Object.fromEntries(DATATYPE_SHEETS.map(s => [s.name, s]))

  for (const sheetName of workbook.SheetNames) {
    // Skip instructions sheet
    if (sheetName === 'Instructions') continue

    // Try exact match first, then emoji-stripped match
    const sheetDef = sheetMap[sheetName] || sheetMap[stripEmoji(sheetName)]
    if (!sheetDef) continue

    // Use the matched name for error reporting
    const matchedName = sheetDef.name

    const ws = workbook.Sheets[sheetName]
    if (!ws || !ws['!ref']) continue

    // Parse all rows
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Skip header rows (0=labels, 1=notes, 2=examples)
    const dataRows = allRows.slice(3).filter(row =>
      row.some(cell => String(cell ?? '').trim() !== '')
    )

    if (dataRows.length === 0) continue

    // Security: limit rows per sheet
    if (dataRows.length > 500) {
      results.errors.push({
        sheet: sheetDef.name, row: 0, col: '',
        message: `Sheet "${sheetName}" has ${dataRows.length} rows. Maximum 500 rows per upload.`,
        severity: 'error',
      })
      continue
    }

    results.parsedSheets[sheetDef.name] = []

    dataRows.forEach((rawRow, idx) => {
      const rowNum = idx + 4 // 1-indexed, after 3 header rows
      results.totalRows++

      const row = parseRow(rawRow, sheetDef.cols)
      const rowErrors = validateRow(row, sheetDef.name, rowNum, seenSchemaNames)

      results.errors.push(...rowErrors)
      results.errorCount += rowErrors.filter(e => e.severity === 'error').length
      results.warningCount += rowErrors.filter(e => e.severity === 'warning').length

      // Only add to parsedSheets if no hard errors
      if (rowErrors.filter(e => e.severity === 'error').length === 0) {
        results.parsedSheets[sheetDef.name].push({
          ...row,
          _sheet: sheetDef.name,
          _rowNum: rowNum,
        })
      }
    })
  }

  results.isValid = results.totalRows > 0 && results.errorCount === 0
  return results
}