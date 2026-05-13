// D365 Attribute Manager — Global Constants
// Update version here for every release

export const APP_NAME        = 'D365 Power Kit'
export const APP_VERSION     = '1.0.0'
export const APP_DESCRIPTION = 'Power tools for Microsoft Dynamics 365'
export const GITHUB_URL      = 'https://github.com/aj-sharma7274/d365-power-kit'
export const ISSUES_URL      = 'https://github.com/aj-sharma7274/d365-power-kit/issues/new'

// API
export const D365_API_VERSION = 'v9.0'
export const API_TIMEOUT_MS   = 30000  // 30 seconds
export const MAX_BATCH_SIZE   = 500    // max rows per upload
export const MAX_FILE_SIZE_MB = 5      // max Excel upload size

// Security
export const TOKEN_TTL_MS         = 8 * 60 * 60 * 1000  // 8 hours
export const MAX_RESPONSE_SIZE_KB = 5120                  // 5MB max response
export const RATE_LIMIT_MS        = 200                   // min gap between API calls
export const MAX_MESSAGES_PER_MIN = 60                    // max messages to background

// Storage keys
export const STORAGE_KEYS = {
  THEME:   'd365am_theme',
  SESSION: 'd365am_session',
  LOGS:    'd365am_logs',
}

// Allowed D365 API path prefix — security whitelist
export const ALLOWED_API_PREFIX = 'api/data/'

// Valid dynamics.com hostname suffix
export const DYNAMICS_HOSTNAME_SUFFIX = '.dynamics.com'