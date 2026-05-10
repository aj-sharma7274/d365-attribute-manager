import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Download, Search, Database,
  Loader, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react'
import { useAuthStore } from '../store/authStore.js'
import { D365_API_VERSION } from '../globals/constants.js'

// ── API helper ────────────────────────────────────────────────────────────────
function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome API unavailable'))
      return
    }
    chrome.runtime.sendMessage(
      { type: 'D365_API_REQUEST', payload: { method, path, body } },
      (response) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
        if (response?.error) { reject(new Error(response.message || response.error)); return }
        if (!response?.ok) { reject(new Error(response?.data?.error?.message || `API Error ${response?.status}`)); return }
        resolve(response.data)
      }
    )
  })
}

// ── Fetch all schema data ─────────────────────────────────────────────────────
async function fetchEntitySchema(entityLogicalName, onStatus) {

  const safe = async (fn) => {
    try { return await fn() } catch { return null }
  }

  onStatus('Fetching entity info...')
  const entityData = await apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=MetadataId,SchemaName,LogicalName,DisplayName,DisplayCollectionName,Description,OwnershipType,IsActivity,IsAuditEnabled,IsAvailableOffline,IsChildEntity,IsConnectionsEnabled,IsDuplicateDetectionEnabled,IsEnabledForCharts,IsManaged,IsCustomEntity,IsCustomizable,IsPrivate,IsQuickCreateEnabled,IsReadOnlyInMobileClient,IsValidForAdvancedFind,ObjectTypeCode,PrimaryIdAttribute,PrimaryNameAttribute,EntitySetName,ChangeTrackingEnabled,CollectionSchemaName,HasActivities,HasNotes,HasFeedback,IntroducedVersion,IsMailMergeEnabled,IsImportable,IsKnowledgeManagementEnabled`
  )

onStatus('Fetching attributes...')
const attrData = await safe(() => apiRequest('GET',
  `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes`
))

  onStatus('Fetching views...')
  const viewData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/savedqueries?$filter=returnedtypecode eq '${entityLogicalName}'&$select=savedqueryid,name,description,querytype,fetchxml,layoutxml`
  ))

  onStatus('Fetching forms...')
  const formData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/systemforms?$filter=objecttypecode eq '${entityLogicalName}'&$select=formid,name,description,type,isdefault`
  ))

  onStatus('Fetching 1:N relationships...')
  const oneToManyData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencedAttribute,IsCustomRelationship,IsManaged`
  ))

  onStatus('Fetching N:1 relationships...')
  const manyToOneData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute,ReferencedAttribute,IsCustomRelationship,IsManaged`
  ))

  onStatus('Fetching N:N relationships...')
  const manyToManyData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IsCustomRelationship,IsManaged,IntersectEntityName`
  ))

  onStatus('Fetching business rules...')
  const businessRules = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/workflows?$select=workflowid,name,description,category,statecode,primaryentity,scope&$filter=primaryentity eq '${entityLogicalName}' and category eq 2`
  ))

  onStatus('Fetching keys...')
  const keysData = await safe(() => apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Keys?$select=SchemaName,DisplayName,KeyAttributes,IsManaged`
  ))

  return {
    entity: entityData,
    attributes: attrData?.value || [],
    views: viewData?.value || [],
    forms: formData?.value || [],
    oneToMany: oneToManyData?.value || [],
    manyToOne: manyToOneData?.value || [],
    manyToMany: manyToManyData?.value || [],
    businessRules: businessRules?.value || [],
    keys: keysData?.value || [],
  }
}

// ── Build Excel workbook ──────────────────────────────────────────────────────
// ── Build Excel workbook ──────────────────────────────────────────────────────
function buildExcelWorkbook(data, entityName) {
  const wb = XLSX.utils.book_new()
  const e  = data.entity

  const lbl = (obj) => obj?.UserLocalizedLabel?.Label || obj?.LocalizedLabels?.[0]?.Label || ''
  const yn  = (val) => val === true ? 'Yes' : val === false ? 'No' : ''

  const req = (val) => {
    const map = {
      None:                'Optional',
      SystemRequired:      'System Required',
      ApplicationRequired: 'Business Required',
      Recommended:         'Recommended',
    }
    return map[val?.Value] || val?.Value || ''
  }

  // ── Friendly attribute type names ─────────────────────────────────────────
  const ATTR_TYPE_MAP = {
    String:                     'Single Line of Text',
    Memo:                       'Multiple Lines of Text',
    Integer:                    'Whole Number',
    Decimal:                    'Decimal Number',
    Double:                     'Floating Point Number',
    Money:                      'Currency',
    DateTime:                   'Date and Time',
    Boolean:                    'Yes/No',
    Picklist:                   'Choice',
    MultiSelectPicklist:        'Choices (Multi-Select)',
    Lookup:                     'Lookup',
    Owner:                      'Owner',
    Customer:                   'Customer',
    File:                       'File',
    Image:                      'Image',
    Uniqueidentifier:           'Unique Identifier',
    BigInt:                     'Big Integer',
    Virtual:                    'Virtual',
    CalendarRules:              'Calendar Rules',
    EntityName:                 'Entity Name',
    ManagedProperty:            'Managed Property',
    Status:                     'Status',
    State:                      'Status Reason',
    PartyList:                  'Party List',
  }

  const friendlyType = (a) => {
    const raw = a.AttributeTypeName?.Value || a.AttributeType || ''
    return ATTR_TYPE_MAP[raw] || raw
  }

  // ── View type map ─────────────────────────────────────────────────────────
  const VIEW_TYPE_MAP = {
    0:    'Public View',
    1:    'Advanced Find View',
    2:    'Associated View',
    4:    'Quick Find View',
    8:    'Lookup View',
    16:   'SMS Summary View',
    32:   'Outlook Filters',
    64:   'Outlook Templates',
    128:  'Outlook Quick Find',
    256:  'Outlook Offline Filters',
    512:  'Offline Filters',
    1024: 'Lookup Preview',
    1039: 'System View',
    2048: 'Inactive Associated View',
    4096: 'Outlook Filters',
    8192: 'Filtered Lookup View',
  }

  // ── Form type map ─────────────────────────────────────────────────────────
  const FORM_TYPE_MAP = {
    0:   'Dashboard',
    1:   'Main Form',
    2:   'Preview Form',
    3:   'Mobile Express Form',
    4:   'Quick View Form',
    5:   'Quick Create Form',
    6:   'Dialog',
    7:   'Task Flow Mobile Form',
    8:   'Interactive Experience Form',
    9:   'Card Form',
    10:  'Main Interactive Form',
    11:  'Other',
    100: 'Other',
  }

  // ── Sheet 1: Entity Overview ──────────────────────────────────────────────
  const entityRows = [
    ['D365 Entity Schema Export'],
    ['Generated',                   new Date().toLocaleString()],
    ['Entity',                      entityName],
    [''],
    ['BASIC INFORMATION'],
    ['Display Name',                lbl(e.DisplayName)],
    ['Plural Display Name',         lbl(e.DisplayCollectionName)],
    ['Schema Name',                 e.SchemaName],
    ['Logical Name',                e.LogicalName],
    ['Collection Schema Name',      e.CollectionSchemaName],
    ['Entity Set Name (API)',        e.EntitySetName],
    ['Object Type Code',            e.ObjectTypeCode],
    ['Description',                 lbl(e.Description)],
    [''],
    ['OWNERSHIP & TYPE'],
    ['Ownership Type',              e.OwnershipType === 'UserOwned' ? 'User or Team' : e.OwnershipType === 'OrganizationOwned' ? 'Organization' : e.OwnershipType || ''],
    ['Is Custom Entity',            yn(e.IsCustomEntity)],
    ['Is Managed',                  yn(e.IsManaged)],
    ['Is Activity',                 yn(e.IsActivity)],
    ['Is Child Entity',             yn(e.IsChildEntity)],
    ['Is Private',                  yn(e.IsPrivate)],
    ['Introduced Version',          e.IntroducedVersion],
    [''],
    ['PRIMARY FIELDS'],
    ['Primary ID Attribute',        e.PrimaryIdAttribute],
    ['Primary Name Attribute',      e.PrimaryNameAttribute],
    [''],
    ['CAPABILITIES'],
    ['Has Activities',              yn(e.HasActivities)],
    ['Has Notes / Attachments',     yn(e.HasNotes)],
    ['Has Feedback',                yn(e.HasFeedback)],
    ['Connections Enabled',         yn(e.IsConnectionsEnabled)],
    ['Knowledge Management',        yn(e.IsKnowledgeManagementEnabled)],
    ['Mail Merge Enabled',          yn(e.IsMailMergeEnabled)],
    ['Charts Enabled',              yn(e.IsEnabledForCharts)],
    ['Quick Create Enabled',        yn(e.IsQuickCreateEnabled)],
    ['Duplicate Detection',         yn(e.IsDuplicateDetectionEnabled)],
    ['Valid for Import',            yn(e.IsImportable)],
    [''],
    ['AUDITING & TRACKING'],
    ['Audit Enabled',               yn(e.IsAuditEnabled?.Value)],
    ['Change Tracking',             yn(e.ChangeTrackingEnabled)],
    [''],
    ['MOBILE & OFFLINE'],
    ['Read-only in Mobile',         yn(e.IsReadOnlyInMobileClient)],
    ['Available Offline',           yn(e.IsAvailableOffline)],
    [''],
    ['SEARCH & CUSTOMIZATION'],
    ['Valid for Advanced Find',     yn(e.IsValidForAdvancedFind)],
    ['Customizable',                yn(e.IsCustomizable?.Value)],
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(entityRows)
  ws1['!cols'] = [{ wch: 30 }, { wch: 50 }]

  // Bold section headers
  entityRows.forEach((row, i) => {
    if (row.length === 1 && row[0] && row[0] !== 'D365 Entity Schema Export') {
      const cell = XLSX.utils.encode_cell({ r: i, c: 0 })
      if (ws1[cell]) {
        ws1[cell].s = {
          font: { bold: true, color: { rgb: '1E3A8A' } },
          fill: { fgColor: { rgb: 'DBEAFE' }, patternType: 'solid' },
        }
      }
    }
  })

  XLSX.utils.book_append_sheet(wb, ws1, '1. Entity Info')

  // ── Sheet 2: Attributes ───────────────────────────────────────────────────
  const attrHeaders = [
    'Display Name',
    'Schema Name',
    'Logical Name',
    'Data Type',
    'Required Level',
    'Max Length',
    'Min Value',
    'Max Value',
    'Precision',
    'Format',
    'Date Behavior',
    'Default Value',
    'Audit Enabled',
    'Searchable',
    'Is Custom',
    'Is Managed',
    'Is Primary ID',
    'Is Primary Name',
    'Valid for Create',
    'Valid for Update',
    'Valid for Read',
    'Is Secured',
    'Introduced Version',
    'Description',
  ]

  const attrRows = data.attributes.map(a => [
    lbl(a.DisplayName),
    a.SchemaName,
    a.LogicalName,
    friendlyType(a),
    req(a.RequiredLevel),
    a.MaxLength        ?? '',
    a.MinValue         ?? '',
    a.MaxValue         ?? '',
    a.Precision        ?? '',
    a.FormatName?.Value || a.Format?.Value || a.Format || '',
    a.DateTimeBehavior?.Value || '',
    a.DefaultValue     ?? '',
    yn(a.IsAuditEnabled?.Value),
    yn(a.IsValidForAdvancedFind?.Value),
    yn(a.IsCustomAttribute),
    yn(a.IsManaged),
    yn(a.IsPrimaryId),
    yn(a.IsPrimaryName),
    yn(a.IsValidForCreate),
    yn(a.IsValidForUpdate),
    yn(a.IsValidForRead),
    yn(a.IsSecured),
    a.IntroducedVersion || '',
    lbl(a.Description),
  ])

  const ws2 = XLSX.utils.aoa_to_sheet([attrHeaders, ...attrRows])
  ws2['!cols'] = attrHeaders.map(h => ({ wch: Math.min(40, Math.max(16, h.length + 2)) }))
  ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws2['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: attrRows.length, c: attrHeaders.length - 1 },
    }),
  }
  XLSX.utils.book_append_sheet(wb, ws2, '2. Columns')

  // ── Sheet 3: Views ────────────────────────────────────────────────────────
  const viewHeaders = [
    'Name', 'View Type', 'Status', 'Description', 'Columns in View', 'FetchXML',
  ]

  const viewRows = data.views.map(v => {
    // Extract column names from layoutxml
    let columns = ''
    try {
      const matches = (v.layoutxml || '').match(/name="([^"]+)"/g) || []
      columns = matches
        .map(m => m.replace(/name="|"/g, ''))
        .filter(c => !c.startsWith('#'))
        .join(', ')
    } catch { }

    // Truncate fetchXML if too long
    const fetchXml  = v.fetchxml || ''
    const truncated = fetchXml.length > 30000
      ? fetchXml.slice(0, 30000) + '... [TRUNCATED]'
      : fetchXml

    const status = v.statecode === 0 || v.statecode === '0' ? 'Active' : 'Inactive'

    return [
      v.name || '',
      VIEW_TYPE_MAP[v.querytype] || `Type ${v.querytype}`,
      status,
      v.description || '',
      columns,
      truncated,
    ]
  })

  const ws3 = XLSX.utils.aoa_to_sheet([viewHeaders, ...viewRows])
  ws3['!cols'] = [
    { wch: 40 }, { wch: 22 }, { wch: 10 },
    { wch: 30 }, { wch: 60 }, { wch: 80 },
  ]
  ws3['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws3, '3. Views')

  // ── Sheet 4: Forms ────────────────────────────────────────────────────────
  const formHeaders = [
    'Name', 'Form Type', 'Status', 'Is Default', 'Form ID',
  ]

  const formRows = data.forms.map(f => {
    const status    = f.statecode === 0 || f.statecode === '0' ? 'Active' : 'Inactive'
    const isDefault = f.isdefault === true || f.isdefault === 'true' ? 'Yes' : 'No'

    return [
      f.name || '',
      FORM_TYPE_MAP[f.type] || `Type ${f.type}`,
      status,
      isDefault,
      f.formid || '',
    ]
  })

  const ws4 = XLSX.utils.aoa_to_sheet([formHeaders, ...formRows])
  ws4['!cols'] = [
    { wch: 40 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 38 },
  ]
  ws4['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws4, '4. Forms')

  // ── Sheet 5: Relationships ────────────────────────────────────────────────
  const relHeaders = [
    'Relationship Type',
    'Schema Name',
    'Primary Entity',
    'Related Entity',
    'Referencing Attribute',
    'Referenced Attribute',
    'Is Custom',
    'Is Managed',
  ]

  const relRows = []

  data.oneToMany.forEach(r => relRows.push([
    '1:N — One to Many',
    r.SchemaName || '',
    r.ReferencedEntity  || '',
    r.ReferencingEntity || '',
    r.ReferencingAttribute || '',
    r.ReferencedAttribute  || '',
    yn(r.IsCustomRelationship),
    yn(r.IsManaged),
  ]))

  data.manyToOne.forEach(r => relRows.push([
    'N:1 — Many to One',
    r.SchemaName || '',
    r.ReferencedEntity  || '',
    r.ReferencingEntity || '',
    r.ReferencingAttribute || '',
    r.ReferencedAttribute  || '',
    yn(r.IsCustomRelationship),
    yn(r.IsManaged),
  ]))

  data.manyToMany.forEach(r => relRows.push([
    'N:N — Many to Many',
    r.SchemaName || '',
    r.Entity1LogicalName || '',
    r.Entity2LogicalName || '',
    r.IntersectEntityName || '',
    '',
    yn(r.IsCustomRelationship),
    yn(r.IsManaged),
  ]))

  const ws5 = XLSX.utils.aoa_to_sheet([relHeaders, ...relRows])
  ws5['!cols'] = [
    { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 22 },
    { wch: 28 }, { wch: 28 }, { wch: 10 }, { wch: 10 },
  ]
  ws5['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws5, '5. Relationships')

  // ── Sheet 6: Business Rules ───────────────────────────────────────────────
  const brHeaders = ['Name', 'Status', 'Scope', 'Description', 'Rule ID']
  const scopeMap  = {
    1: 'Entity',
    2: 'All Forms',
    3: 'Specific Form',
  }

  const brRows = data.businessRules.map(r => [
    r.name || '',
    r.statecode === 1 ? 'Active' : 'Draft',
    scopeMap[r.scope] || r.scope || '',
    r.description || '',
    r.workflowid  || '',
  ])

  const ws6 = XLSX.utils.aoa_to_sheet([brHeaders, ...brRows])
  ws6['!cols'] = [
    { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 38 },
  ]
  ws6['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws6, '6. Business Rules')

  // ── Sheet 7: Keys ─────────────────────────────────────────────────────────
  const keyHeaders = ['Display Name', 'Schema Name', 'Key Attributes', 'Is Managed']

  const keyRows = data.keys.map(k => [
    lbl(k.DisplayName),
    k.SchemaName || '',
    (k.KeyAttributes || []).join(', '),
    yn(k.IsManaged),
  ])

  const ws7 = XLSX.utils.aoa_to_sheet([keyHeaders, ...keyRows])
  ws7['!cols'] = [
    { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 12 },
  ]
  ws7['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws7, '7. Keys')

  return wb
}

// ── Download workbook ─────────────────────────────────────────────────────────
function downloadWorkbook(wb, entityName) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `D365_Schema_${entityName}_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExportSchemaPage() {
  const navigate = useNavigate()
  const { orgUrl } = useAuthStore()

  const [search, setSearch] = useState('')
  const [entities, setEntities] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loadingEntities, setLoadingEntities] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [exportDone, setExportDone] = useState(false)
  const [error, setError] = useState(null)

  // ── Load entity list ──────────────────────────────────────────────────────
  const loadEntities = useCallback(async () => {
    setLoadingEntities(true)
    setError(null)
    setEntities([])
    setFiltered([])

    try {
      const result = await apiRequest('GET',
        `api/data/${D365_API_VERSION}/EntityDefinitions?$select=LogicalName,SchemaName,DisplayName,IsCustomEntity,IsManaged,ObjectTypeCode`
      )
      const list = (result?.value || [])
        .map(e => ({
          logicalName: e.LogicalName,
          schemaName: e.SchemaName,
          displayName: e.DisplayName?.UserLocalizedLabel?.Label || e.LogicalName,
          isCustom: e.IsCustomEntity,
          isManaged: e.IsManaged,
          typeCode: e.ObjectTypeCode,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))

      setEntities(list)
      setFiltered(list)
      toast.success(`${list.length} entities loaded`)
    } catch (err) {
      setError(err.message)
      toast.error(`Failed to load entities: ${err.message}`)
    } finally {
      setLoadingEntities(false)
    }
  }, [])

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = (val) => {
    setSearch(val)
    const q = val.toLowerCase().trim()
    setFiltered(
      q
        ? entities.filter(e =>
          e.displayName.toLowerCase().includes(q) ||
          e.logicalName.toLowerCase().includes(q) ||
          e.schemaName.toLowerCase().includes(q)
        )
        : entities
    )
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!selectedEntity) return
    setExporting(true)
    setExportDone(false)
    setExportStatus('')
    setError(null)

    try {
      const data = await fetchEntitySchema(
        selectedEntity.logicalName,
        (status) => setExportStatus(status)
      )

      setExportStatus('Building Excel workbook...')
      const wb = buildExcelWorkbook(data, selectedEntity.logicalName)

      setExportStatus('Downloading...')
      downloadWorkbook(wb, selectedEntity.logicalName)

      setExportDone(true)
      toast.success(`Schema exported for ${selectedEntity.displayName}!`)
    } catch (err) {
      setError(err.message)
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
      setExportStatus('')
    }
  }, [selectedEntity])

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl transition-all"
          style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
            Export Schema
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Export complete entity metadata to a structured Excel workbook
          </p>
        </div>
      </div>

      {/* What gets exported */}
      <div className="card">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          What gets exported
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { sheet: '1', label: 'Entity Info', desc: 'All settings, capabilities, audit' },
            { sheet: '2', label: 'Columns', desc: 'All attributes with full schema' },
            { sheet: '3', label: 'Views', desc: 'Views with columns and FetchXML' },
            { sheet: '4', label: 'Forms', desc: 'All forms with type and status' },
            { sheet: '5', label: 'Relationships', desc: '1:N, N:1, N:N relationships' },
            { sheet: '6', label: 'Business Rules', desc: 'Rules with scope and status' },
            { sheet: '7', label: 'Keys', desc: 'Alternate keys and attributes' },
          ].map(({ sheet, label, desc }) => (
            <div key={sheet} className="p-3 rounded-xl"
              style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--accent-bg)', color: 'var(--text-accent)' }}>
                  {sheet}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {label}
                </span>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Entity selector */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Select Entity
          </h2>
          <button onClick={loadEntities} disabled={loadingEntities}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-2">
            {loadingEntities
              ? <Loader size={13} className="animate-spin" />
              : <RefreshCw size={13} />
            }
            {entities.length > 0 ? 'Refresh' : 'Load Entities'}
          </button>
        </div>

        {/* Search box */}
        {entities.length > 0 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }} />
            <input
              className="input pl-9"
              placeholder="Search by display name or schema name..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
        )}

        {/* Entity list */}
        {entities.length > 0 && (
          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                No entities match "{search}"
              </p>
            )}
            {filtered.map(entity => (
              <button
                key={entity.logicalName}
                onClick={() => { setSelectedEntity(entity); setExportDone(false); setError(null) }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-left"
                style={{
                  background: selectedEntity?.logicalName === entity.logicalName
                    ? 'var(--accent-bg)' : 'var(--glass1)',
                  border: `1px solid ${selectedEntity?.logicalName === entity.logicalName
                    ? 'var(--accent-border)' : 'var(--glass-border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Database size={14} style={{
                    color: selectedEntity?.logicalName === entity.logicalName
                      ? 'var(--text-accent)' : 'var(--text-muted)',
                  }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {entity.displayName}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {entity.logicalName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entity.isCustom && <span className="badge-blue" style={{ fontSize: 10 }}>Custom</span>}
                  {entity.isManaged && <span className="badge-amber" style={{ fontSize: 10 }}>Managed</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {entities.length === 0 && !loadingEntities && (
          <div className="text-center py-8">
            <Database size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Click "Load Entities" to fetch all entities from your D365 org
            </p>
          </div>
        )}

        {loadingEntities && (
          <div className="text-center py-8">
            <Loader size={24} className="animate-spin mx-auto mb-3"
              style={{ color: 'var(--text-accent)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading entities...</p>
          </div>
        )}
      </div>

      {/* Export panel */}
      {selectedEntity && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Export: {selectedEntity.displayName}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {selectedEntity.logicalName}
              </p>
            </div>
            {exportDone && <CheckCircle size={20} style={{ color: 'var(--success-text)' }} />}
          </div>

          {/* Status */}
          {exporting && exportStatus && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--glass1)', border: '1px solid var(--glass-border)' }}>
              <Loader size={14} className="animate-spin" style={{ color: 'var(--text-accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{exportStatus}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}>
              <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: 'var(--danger-text)' }}>{error}</p>
            </div>
          )}

          {/* Success */}
          {exportDone && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
              <CheckCircle size={14} style={{ color: 'var(--success-text)' }} />
              <p style={{ fontSize: 12, color: 'var(--success-text)' }}>
                Schema exported! Check your downloads folder.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleExport} disabled={exporting} className="btn-primary">
              {exporting
                ? <><Loader size={14} className="animate-spin" /> Exporting...</>
                : <><Download size={14} /> Export Schema to Excel</>
              }
            </button>
            {exportDone && (
              <button
                onClick={() => { setSelectedEntity(null); setExportDone(false); setError(null) }}
                className="btn-secondary"
              >
                Export Another Entity
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}