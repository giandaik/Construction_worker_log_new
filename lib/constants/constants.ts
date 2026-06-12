/**
 * Application-wide constants
 * Centralized configuration for magic numbers and strings
 *
 * IMPORTANT: Always define constants here instead of hardcoding values.
 * This makes configuration changes easier and prevents magic number issues.
 */

// ========================================
// API & Pagination
// ========================================

/**
 * Default page size for paginated API responses
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Maximum page size allowed for API requests
 */
export const MAX_PAGE_SIZE = 100;

// ========================================
// Toast Notifications
// ========================================

/**
 * Toast message durations in milliseconds
 */
export const TOAST_DURATION = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 7000,
} as const;

// ========================================
// Sync Configuration
// ========================================

/**
 * Delay before triggering sync in milliseconds
 */
export const SYNC_DELAY_MS = 2000;

/**
 * Timeout for network requests in milliseconds
 */
export const REQUEST_TIMEOUT_MS = 30000;

// ========================================
// Form Defaults
// ========================================

/**
 * Default values for personnel form entries
 */
export const DEFAULT_PERSONNEL = {
  role: '',
  count: 1,
} as const;

/**
 * Default values for equipment form entries
 */
export const DEFAULT_EQUIPMENT = {
  type: '',
  count: 1,
  hours: 8,
} as const;

/**
 * Default values for material form entries
 */
export const DEFAULT_MATERIALS = {
  name: '',
  quantity: 0,
  unit: '',
} as const;

// ========================================
// Database Configuration
// ========================================

/**
 * Connection timeout for database operations in milliseconds
 */
export const DB_CONNECTION_TIMEOUT_MS = 10000;

/**
 * Maximum number of retry attempts for failed database operations
 */
export const DB_MAX_RETRIES = 3;

// ========================================
// File Size Limits
// ========================================

/**
 * Maximum file upload size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed file types for uploads
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

// ========================================
// Validation
// ========================================

/**
 * Minimum work description length
 */
export const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Maximum work description length
 */
export const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Maximum notes length
 */
export const MAX_NOTES_LENGTH = 2000;

export const SESSION_COOKIE_NAME = "cw_session";
