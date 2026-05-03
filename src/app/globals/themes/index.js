// D365 Attribute Manager — Theme Registry

import dark  from './dark.js'
import light from './light.js'
import { STORAGE_KEYS } from '../constants.js'

// All available themes — add more here in future
export const THEMES = { dark, light }

// Default theme
export const DEFAULT_THEME = 'dark'

// Get theme object by id
export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME]
}

// Apply theme CSS variables to document root
export function applyTheme(themeId) {
  const theme = getTheme(themeId)
  const root  = document.documentElement

  // Apply every token as a CSS variable
  Object.entries(theme).forEach(([key, value]) => {
    if (key === 'id' || key === 'label' || key === 'emoji') return
    root.style.setProperty(`--${camelToKebab(key)}`, value)
  })

  // Set data attribute for CSS selectors
  root.setAttribute('data-theme', theme.id)
}

// Save theme to storage
export async function saveTheme(themeId) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.THEME]: themeId })
  } catch { /* graceful fail */ }
}

// Load theme from storage
export async function loadTheme() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEYS.THEME])
    return stored[STORAGE_KEYS.THEME] || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// Helper: convert camelCase to kebab-case
function camelToKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}