/**
 * D365 API Client
 * All requests go through background → content script proxy
 * Cookie auth is handled automatically by browser
 */
import { D365_API_VERSION } from '../globals/constants.js'

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error('Chrome API unavailable'))
      return
    }
    chrome.runtime.sendMessage(
      { type: 'D365_API_REQUEST', payload: { method, path, body } },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (response?.error) {
          reject(new Error(response.message || response.error))
          return
        }
        if (!response?.ok) {
          const msg = response?.data?.error?.message || `API Error ${response?.status}`
          reject(new Error(msg))
          return
        }
        resolve(response.data)
      }
    )
  })
}

// ── Build OData attribute body per datatype ───────────────────────────────────
function buildAttributeBody(row) {
  const yesNo = (val, def = false) =>
    val ? val.toLowerCase() === 'yes' : def

  const label = (text) => ({
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [{
      '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
      Label: text,
      LanguageCode: 1033,
    }],
  })

  const base = {
    SchemaName: row.SchemaName,
    DisplayName: label(row.DisplayName),
    RequiredLevel: { Value: yesNo(row.IsRequired) ? 'ApplicationRequired' : 'None' },
    IsAuditEnabled: { Value: yesNo(row.IsAuditEnabled, false) },
    IsValidForAdvancedFind: { Value: yesNo(row.IsSearchable, true) },
  }

  if (row.Description) {
    base.Description = label(row.Description)
  }

  switch (row._sheet) {
    case 'Text (Single Line)':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        MaxLength: parseInt(row.MaxLength) || 100,
        FormatName: { Value: row.Format || 'Text' },
      }

    case 'Text (Multi Line)':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
        MaxLength: parseInt(row.MaxLength) || 2000,
      }

    case 'Whole Number':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        MinValue: parseInt(row.MinValue) || -2147483648,
        MaxValue: parseInt(row.MaxValue) || 2147483647,
        Format: row.Format || 'None',
      }

    case 'Decimal Number':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
        MinValue: parseFloat(row.MinValue) || 0,
        MaxValue: parseFloat(row.MaxValue) || 100000000000,
        Precision: parseInt(row.Precision) || 0,
      }

    case 'Floating Point':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DoubleAttributeMetadata',
        MinValue: parseFloat(row.MinValue) || 0,
        MaxValue: parseFloat(row.MaxValue) || 1e100,
        Precision: parseInt(row.Precision) || 0,
      }

    case 'Currency':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
        MinValue: parseFloat(row.MinValue) || 0,
        MaxValue: parseFloat(row.MaxValue) || 922337203685477,
        Precision: parseInt(row.Precision) || 2,
        PrecisionSource: parseInt(row.PrecisionSource) || 2,
      }

    case 'Date & Time':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        Format: row.Format || 'DateAndTime',
        DateTimeBehavior: { Value: row.DateTimeBehavior || 'UserLocal' },
      }

    case 'Choice (Option Set)':
    case 'Multi-Select Choice': {
      const isMulti = row._sheet === 'Multi-Select Choice'
      const type = isMulti
        ? 'Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata'
        : 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'

      const options = row.Options.split(',').map(p => {
        const [optLabel, optValue] = p.trim().split(':')
        return {
          Value: parseInt(optValue),
          Label: label(optLabel.trim()),
        }
      })

      return {
        ...base,
        '@odata.type': type,
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
          IsGlobal: false,
          OptionSetType: isMulti ? 'MultiSelect' : 'Picklist',
          Options: options,
        },
        DefaultFormValue: row.DefaultValue ? parseInt(row.DefaultValue) : null,
      }
    }

    case 'Yes No (Boolean)':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          TrueOption: { Value: 1, Label: label(row.TrueLabel || 'Yes') },
          FalseOption: { Value: 0, Label: label(row.FalseLabel || 'No') },
        },
        DefaultValue: row.DefaultValue === 'true',
      }

    case 'Lookup':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
      }

    case 'File':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.FileAttributeMetadata',
        MaxSizeInKB: parseInt(row.MaxSizeInKB) || 32768,
      }

    case 'Image':
      return {
        ...base,
        '@odata.type': 'Microsoft.Dynamics.CRM.ImageAttributeMetadata',
        IsPrimaryImage: yesNo(row.IsPrimaryImage),
        MaxSizeInKB: parseInt(row.MaxSizeInKB) || 10240,
        CanStoreFullImage: yesNo(row.CanStoreFullImage, true),
      }

    default:
      throw new Error(`Unknown sheet type: ${row._sheet}`)
  }
}

// ── Create single attribute ───────────────────────────────────────────────────
export async function createAttribute(row) {
  const entity = row.EntitySchemaName.toLowerCase()
  const body = buildAttributeBody(row)
  const path = `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entity}')/Attributes`

  const result = await apiRequest('POST', path, body)

  // Add to solution if solution name provided
  if (row.SolutionName && result) {
    try {
      await addAttributeToSolution(row.SolutionName, row.EntitySchemaName, row.SchemaName)
    } catch (err) {
      console.warn('[D365AM] Could not add to solution:', err.message)
    }
  }

  return { success: true, schemaName: row.SchemaName }
}

// ── Add attribute to solution ─────────────────────────────────────────────────
async function addAttributeToSolution(solutionName, entitySchemaName, attributeSchemaName) {
  // First get the solution id
  const solResult = await apiRequest('GET',
    `api/data/${D365_API_VERSION}/solutions?$select=solutionid&$filter=uniquename eq '${solutionName}'`
  )
  if (!solResult?.value?.length) {
    throw new Error(`Solution "${solutionName}" not found`)
  }
  const solutionId = solResult.value[0].solutionid

  // Get entity metadata id
  const entResult = await apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entitySchemaName.toLowerCase()}')?$select=MetadataId`
  )
  if (!entResult?.MetadataId) {
    throw new Error(`Entity "${entitySchemaName}" metadata not found`)
  }

  // Get attribute metadata id
  const attrResult = await apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entitySchemaName.toLowerCase()}')/Attributes(LogicalName='${attributeSchemaName.toLowerCase()}')?$select=MetadataId`
  )
  if (!attrResult?.MetadataId) {
    throw new Error(`Attribute "${attributeSchemaName}" metadata not found`)
  }

  // Add to solution as component type 2 (Attribute)
  await apiRequest('POST',
    `api/data/${D365_API_VERSION}/AddSolutionComponent`,
    {
      ComponentId: attrResult.MetadataId,
      ComponentType: 2,
      SolutionUniqueName: solutionName,
      AddRequiredComponents: false,
      DoNotIncludeSubcomponents: false,
      IncludedComponentSettingsValues: null,
    }
  )
}
// ── Bulk create with progress callback ───────────────────────────────────────
export async function bulkCreateAttributes(rows, onProgress) {
  const results = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress?.({ current: i + 1, total: rows.length, row, status: 'processing' })

    try {
      const res = await createAttribute(row)
      results.push({ ...res, row })
      onProgress?.({ current: i + 1, total: rows.length, row, status: 'success' })
    } catch (err) {
      results.push({ success: false, schemaName: row.SchemaName, error: err.message, row })
      onProgress?.({ current: i + 1, total: rows.length, row, status: 'error', error: err.message })
    }

    // Rate limiting — small delay between calls
    if (i < rows.length - 1) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return results
}

// ── Delete attribute ──────────────────────────────────────────────────────────
export async function deleteAttribute(entityLogicalName, attributeLogicalName) {
  const path = `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')`
  await apiRequest('DELETE', path)
  return { success: true, schemaName: attributeLogicalName }
}

// ── Get entities ──────────────────────────────────────────────────────────────
export async function getEntities() {
  return apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions?$select=LogicalName,SchemaName,DisplayName,IsCustomEntity`
  )
}

// ── Get attributes for entity ─────────────────────────────────────────────────
export async function getEntityAttributes(entityLogicalName) {
  return apiRequest('GET',
    `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,SchemaName,DisplayName,AttributeType,RequiredLevel,IsAuditEnabled,IsCustomAttribute`
  )
}

// ── Test connection ───────────────────────────────────────────────────────────
export function testConnection() {
  return apiRequest('GET',
    `api/data/${D365_API_VERSION}/accounts?$top=1&$select=name,accountid`
  )
}

// ── Check field dependencies ──────────────────────────────────────────────────
export async function checkFieldDependencies(entityLogicalName, attributeLogicalName) {
  try {
    // Check if field is custom
    const attrResult = await apiRequest('GET',
      `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')?$select=LogicalName,SchemaName,IsCustomAttribute,DisplayName`
    )

    if (!attrResult) {
      return { exists: false, isSystem: false, dependencies: [], safe: false, error: 'Field not found' }
    }

    const isSystem = !attrResult.IsCustomAttribute

    // Check dependencies via RetrieveDependenciesForDelete
    let dependencies = []
    try {
      const depResult = await apiRequest('GET',
        `api/data/${D365_API_VERSION}/RetrieveDependenciesForDelete(ComponentType=2,ObjectId=${attrResult.MetadataId})`
      )
      dependencies = mapDependencies(depResult?.value || [])
    } catch {
      // Some orgs don't support this endpoint — treat as unknown
      dependencies = []
    }

    return {
      exists: true,
      isSystem,
      isCustom: attrResult.IsCustomAttribute,
      displayName: attrResult.DisplayName?.UserLocalizedLabel?.Label || attributeLogicalName,
      metadataId: attrResult.MetadataId,
      dependencies,
      safe: !isSystem && dependencies.length === 0,
    }
  } catch (err) {
    return {
      exists: false,
      isSystem: false,
      dependencies: [],
      safe: false,
      error: err.message,
    }
  }
}
// Map dependency type codes to readable names + removal steps
const DEP_TYPES = {
  1:   { name: 'Entity',          steps: ['Remove entity from solution'] },
  2:   { name: 'Attribute',       steps: ['Delete dependent attribute first'] },
  9:   { name: 'Form',            steps: ['Open the form', 'Remove this field from the form layout', 'Save and publish the form'] },
  26:  { name: 'View (SavedQuery)', steps: ['Open the view', 'Remove this field from view columns and filters', 'Save and publish the view'] },
  29:  { name: 'Workflow',        steps: ['Open the workflow/flow', 'Remove references to this field', 'Save and activate the workflow'] },
  48:  { name: 'Business Rule',   steps: ['Open the business rule', 'Remove conditions/actions using this field', 'Save and activate the rule'] },
  92:  { name: 'Modern Flow',     steps: ['Open Power Automate', 'Edit the flow', 'Remove steps referencing this field', 'Save the flow'] },
  29:  { name: 'Cloud Flow',      steps: ['Open Power Automate', 'Edit the cloud flow', 'Remove field references', 'Save'] },
  9006:{ name: 'Model-driven App',steps: ['Open the app in App Designer', 'Remove field references', 'Save and publish'] },
}

function mapDependencies(rawDeps) {
  return rawDeps.map(dep => {
    const typeInfo = DEP_TYPES[dep.DependentComponentType] || {
      name:  `Component (type ${dep.DependentComponentType})`,
      steps: ['Manually remove the dependency in D365 customizations'],
    }
    return {
      type:        dep.DependentComponentType,
      typeName:    typeInfo.name,
      componentId: dep.DependentComponentObjectId,
      steps:       typeInfo.steps,
    }
  })
}
// ── Bulk check dependencies ───────────────────────────────────────────────────
export async function bulkCheckDependencies(rows, onProgress) {
  const results = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    onProgress?.({ current: i + 1, total: rows.length, row })

    const check = await checkFieldDependencies(
      row.EntitySchemaName.toLowerCase(),
      row.FieldSchemaName.toLowerCase()
    )
    results.push({ ...check, row })

    // Small delay between checks
    if (i < rows.length - 1) {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  return results
}

// ── Delete single attribute ───────────────────────────────────────────────────
export async function deleteSingleAttribute(entityLogicalName, attributeLogicalName) {
  const path = `api/data/${D365_API_VERSION}/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attributeLogicalName}')`
  await apiRequest('DELETE', path)
  return { success: true, schemaName: attributeLogicalName }
}

// ── Bulk delete with progress ─────────────────────────────────────────────────
export async function bulkDeleteAttributes(safeFields, onProgress) {
  const results = []
  for (let i = 0; i < safeFields.length; i++) {
    const item = safeFields[i]
    onProgress?.({ current: i + 1, total: safeFields.length, row: item.row, status: 'processing' })

    try {
      await deleteSingleAttribute(
        item.row.EntitySchemaName.toLowerCase(),
        item.row.FieldSchemaName.toLowerCase()
      )
      results.push({ success: true, schemaName: item.row.FieldSchemaName, row: item.row })
      onProgress?.({ current: i + 1, total: safeFields.length, row: item.row, status: 'success' })
    } catch (err) {
      results.push({ success: false, schemaName: item.row.FieldSchemaName, error: err.message, row: item.row })
      onProgress?.({ current: i + 1, total: safeFields.length, row: item.row, status: 'error', error: err.message })
    }

    if (i < safeFields.length - 1) {
      await new Promise(r => setTimeout(r, 300))
    }
  }
  return results
}