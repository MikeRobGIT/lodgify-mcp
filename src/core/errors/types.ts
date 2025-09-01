/**
 * Error handling types
 */

/**
 * Standard error structure for Lodgify API errors
 */
export interface LodgifyError {
  error: true
  message: string
  status: number
  path: string
  detail?: unknown
}

/**
 * Validation result for input validation
 */
export interface ValidationResult {
  isValid: boolean
  sanitized?: string
  error?: string
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  includeStackTrace?: boolean
  sanitizeSensitiveData?: boolean
  customStatusMessages?: Record<number, string>
}

/**
 * HTTP error response
 */
export interface HttpErrorResponse {
  status: number
  statusText: string
  headers?: Headers
  body?: unknown
}
