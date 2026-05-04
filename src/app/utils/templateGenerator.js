/**
 * D365 Attribute Manager — Excel Template Generator
 * Generates downloadable .xlsx with one sheet per field datatype
 * Uses SheetJS community edition (Apache 2.0)
 * Security: No formulas, no macros, no external links
 */
import * as XLSX from 'xlsx'

// ── Common columns for ALL field types ───────────────────────────────────────
export const COMMON_COLS = [
  { key: 'SolutionName', label: 'Solution Name *', example: 'MySolution', note: 'Exact unique name of your solution' },
  { key: 'EntitySchemaName', label: 'Entity Schema Name *', example: 'account', note: 'Logical name e.g. account, contact, new_myentity' },
  { key: 'DisplayName', label: 'Field Display Name *', example: 'My Custom Field', note: 'Label shown to users in D365' },
  { key: 'SchemaName', label: 'Field Schema Name *', example: 'new_mycustomfield', note: 'Must start with publisher prefix e.g. new_. No spaces.' },
  { key: 'Description', label: 'Description', example: 'Stores my data', note: 'Optional. Max 2000 characters.' },
  { key: 'IsRequired', label: 'Required? (Yes/No)', example: 'No', note: 'Yes = Business Required. No = Optional.' },
  { key: 'IsAuditEnabled', label: 'Audit Enabled? (Yes/No)', example: 'Yes', note: 'Track changes to this field.' },
  { key: 'IsSearchable', label: 'Searchable? (Yes/No)', example: 'Yes', note: 'Include in Quick Find / Search.' },
]

// ── Sheet definitions — one per datatype ─────────────────────────────────────
export const DATATYPE_SHEETS = [
  {
    name: 'Text (Single Line)',
    apiType: 'StringAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MaxLength', label: 'Max Length *', example: '100', note: 'Min: 1, Max: 4000' },
      { key: 'Format', label: 'Format', example: 'Text', note: 'Text | Email | Phone | Url | TickerSymbol' },
    ],
  },
  {
    name: 'Text (Multi Line)',
    apiType: 'MemoAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MaxLength', label: 'Max Length *', example: '2000', note: 'Min: 1, Max: 1,048,576' },
      { key: 'Format', label: 'Format', example: 'TextArea', note: 'TextArea | RichText' },
    ],
  },
  {
    name: 'Whole Number',
    apiType: 'IntegerAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MinValue', label: 'Min Value', example: '0', note: 'Default: -2,147,483,648' },
      { key: 'MaxValue', label: 'Max Value', example: '1000000', note: 'Default: 2,147,483,647' },
      { key: 'Format', label: 'Format', example: 'None', note: 'None | Duration | TimeZone | Language | Locale' },
    ],
  },
  {
    name: 'Decimal Number',
    apiType: 'DecimalAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MinValue', label: 'Min Value', example: '0', note: 'Optional. Default: -100,000,000,000' },
      { key: 'MaxValue', label: 'Max Value', example: '1000', note: 'Optional. Default: 100,000,000,000' },
      { key: 'Precision', label: 'Precision (default: 0)', example: '2', note: 'Optional. 0 to 10 decimal places. Leave blank for 0.' },
    ],
  },
  {
    name: 'Floating Point',
    apiType: 'DoubleAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MinValue', label: 'Min Value', example: '0', note: 'Optional. Default: -1e+100' },
      { key: 'MaxValue', label: 'Max Value', example: '1000', note: 'Optional. Default: 1e+100' },
      { key: 'Precision', label: 'Precision (default: 0)', example: '5', note: 'Optional. 0 to 10 decimal places. Leave blank for 0.' },
    ],
  },
  {
    name: 'Currency',
    apiType: 'MoneyAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MinValue', label: 'Min Value', example: '0', note: 'Default: -922,337,203,685,477' },
      { key: 'MaxValue', label: 'Max Value', example: '1000', note: 'Default: 922,337,203,685,477' },
      { key: 'Precision', label: 'Precision *', example: '2', note: '0 to 4 decimal places' },
      { key: 'PrecisionSource', label: 'Precision Source', example: '2', note: '0=Attribute, 1=Organization, 2=Currency' },
    ],
  },
  {
    name: 'Date & Time',
    apiType: 'DateTimeAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'Format', label: 'Format *', example: 'DateAndTime', note: 'DateAndTime | DateOnly' },
      { key: 'DateTimeBehavior', label: 'Behavior *', example: 'UserLocal', note: 'UserLocal | DateOnly | TimeZoneIndependent' },
    ],
  },
  {
    name: 'Choice (Option Set)',
    apiType: 'PicklistAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'UseExistingOptionSet', label: 'Use Existing Global Set? (Yes/No)', example: 'No', note: 'Yes = reuse existing global option set by name below' },
      { key: 'CreateAsGlobalSet', label: 'Create as Global Set? (Yes/No)', example: 'No', note: 'Yes = create a new global option set (reusable across entities)' },
      { key: 'OptionSetName', label: 'Global Option Set Name', example: 'new_customertype', note: 'Required if Use Existing = Yes OR Create as Global = Yes' },
      { key: 'Options', label: 'Options (Label:Value) *', example: 'Active:1,Inactive:2,Pending:3', note: 'Required if not using existing set. Format: Label:Value,Label:Value' },
      { key: 'DefaultValue', label: 'Default Value', example: '1', note: 'Optional. Must match one of the Values above' },
    ],
  },
  {
    name: 'Multi-Select Choice',
    apiType: 'MultiSelectPicklistAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'UseExistingOptionSet', label: 'Use Existing Set? (Yes/No)', example: 'No', note: 'Yes = reuse global option set. No = create new.' },
      { key: 'OptionSetName', label: 'Global Option Set Name', example: '', note: 'Only if Use Existing = Yes' },
      { key: 'Options', label: 'Options (Label:Value) *', example: 'Red:1,Green:2,Blue:3', note: 'Label:Value pairs, comma separated.' },
    ],
  },
  {
    name: 'Yes No (Boolean)',
    apiType: 'BooleanAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'TrueLabel', label: 'True Label (default: Yes)', example: 'Yes', note: 'Optional. Display label for true value. Default: Yes' },
      { key: 'FalseLabel', label: 'False Label (default: No)', example: 'No', note: 'Optional. Display label for false value. Default: No' },
      { key: 'DefaultValue', label: 'Default Value', example: 'false', note: 'Optional. true or false' },
    ],
  },
  {
    name: 'Lookup',
    apiType: 'LookupAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'TargetEntity', label: 'Target Entity *', example: 'account', note: 'Logical name of related entity' },
      { key: 'RelationshipSchemaName', label: 'Relationship Name', example: 'new_contact_account', note: 'Auto-generated if blank' },
      { key: 'MenuBehavior', label: 'Related Menu Behavior', example: 'UseCollectionName', note: 'UseCollectionName | UseLabel | DoNotDisplay' },
    ],
  },
  {
    name: 'File',
    apiType: 'FileAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'MaxSizeInKB', label: 'Max File Size (KB) *', example: '32768', note: 'Min: 1, Max: 131,072 KB (128 MB)' },
    ],
  },
  {
    name: 'Image',
    apiType: 'ImageAttributeMetadata',
    cols: [
      ...COMMON_COLS,
      { key: 'IsPrimaryImage', label: 'Primary Image? (Yes/No)', example: 'No', note: 'Only one primary image per entity' },
      { key: 'MaxSizeInKB', label: 'Max Size (KB)', example: '10240', note: 'Default: 10,240 KB' },
      { key: 'CanStoreFullImage', label: 'Store Full Image? (Yes/No)', example: 'Yes', note: 'Store original resolution' },
    ],
  },
]

// ── Build instructions sheet ──────────────────────────────────────────────────
function buildInstructionsSheet() {
  const rows = [
    ['D365 Attribute Manager — Bulk Create Template'],
    [''],
    ['HOW TO USE'],
    ['Step 1', 'Pick the sheet for your field type (e.g. "Text (Single Line)")'],
    ['Step 2', 'Fill data from ROW 4 onward. Rows 1-3 are headers — do not edit.'],
    ['Step 3', 'Columns marked * are REQUIRED'],
    ['Step 4', 'You can fill multiple sheets — all will be processed'],
    ['Step 5', 'Save and upload in the Bulk Create page'],
    ['Step 6', 'Extension validates ALL data before making any D365 changes'],
    [''],
    ['SCHEMA NAME RULES'],
    ['', '• Must start with publisher prefix e.g. new_myfieldname'],
    ['', '• Only letters, numbers, underscores — NO spaces'],
    ['', '• Must be unique within the entity. Max 100 characters.'],
    [''],
    ['OPTION SET FORMAT'],
    ['', '• Format: Label:Value,Label:Value,...'],
    ['', '• Example: Active:1,Inactive:2,Pending:3'],
    ['', '• Values must be positive integers'],
    [''],
    ['SECURITY'],
    ['', '• All data validated locally before any API call'],
    ['', '• Formulas and macros are automatically rejected'],
    ['', '• Data sent only to your own D365 org'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 70 }]
  return ws
}

// ── Build a single datatype sheet ─────────────────────────────────────────────
function buildDataSheet(sheetDef) {
  const { cols } = sheetDef
  const aoa = []

  // Row 0: Headers
  aoa.push(cols.map(c => c.label))
  // Row 1: Notes
  aoa.push(cols.map(c => `ℹ️ ${c.note}`))
  // Row 2: Examples
  aoa.push(cols.map(c => c.example ? `e.g. ${c.example}` : ''))
  // Rows 3-22: Empty data rows
  for (let i = 0; i < 20; i++) {
    aoa.push(cols.map(() => ''))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = cols.map(c => ({
    wch: Math.min(42, Math.max(18, c.label.length + 2, c.note.length / 2))
  }))
  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 32 },
    { hpt: 20 },
    ...Array(20).fill({ hpt: 18 }),
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 3 }
  return ws
}

// ── Main export function ──────────────────────────────────────────────────────
export function generateBulkCreateTemplate() {
  const wb = XLSX.utils.book_new()

  // Instructions sheet first
  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions')

  // One sheet per datatype
  DATATYPE_SHEETS.forEach(sheet => {
    XLSX.utils.book_append_sheet(wb, buildDataSheet(sheet), sheet.name)
  })

  // Trigger download
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'D365_BulkCreate_Template.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}