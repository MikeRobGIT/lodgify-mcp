/**
 * Error handling and formatting utilities
 */

import type {
  ErrorHandlerConfig,
  HttpErrorResponse,
  LodgifyApiError,
  LodgifyError,
} from './types.js'
import { isLodgifyApiError, isLodgifyError, mapApiErrorToLegacy } from './types.js'

/**
 * Error handler for formatting and processing errors
 */
export class ErrorHandler {
  private readonly includeStackTrace: boolean
  private readonly sanitizeSensitiveData: boolean
  private readonly statusMessages: Record<number, string>

  constructor(config?: ErrorHandlerConfig) {
    this.includeStackTrace = config?.includeStackTrace ?? false
    this.sanitizeSensitiveData = config?.sanitizeSensitiveData ?? true
    this.statusMessages = {
      400: 'Bad Request',
      401: 'Unauthorized - Check your API key',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      ...config?.customStatusMessages,
    }
  }

  /**
   * Format an HTTP error response into a LodgifyError
   */
  async formatHttpError(response: Response, path: string): Promise<LodgifyError> {
    let detail: unknown
    let parsedBody: unknown

    try {
      const text = await response.text()
      if (text) {
        parsedBody = JSON.parse(text)
        detail = parsedBody
      }
    } catch {
      // If parsing fails, detail remains undefined
    }

    // Check if the response contains a LodgifyApiError (new format)
    if (isLodgifyApiError(parsedBody)) {
      return mapApiErrorToLegacy(parsedBody as LodgifyApiError, response.status, path)
    }

    // Check if the response is already a LodgifyError (legacy format)
    if (isLodgifyError(parsedBody)) {
      return parsedBody as LodgifyError
    }

    // Default handling for other error formats
    const message =
      this.statusMessages[response.status] || `HTTP ${response.status} ${response.statusText}`

    return {
      error: true,
      message: `Lodgify ${response.status}: ${message}`,
      status: response.status,
      path,
      detail: this.sanitizeSensitiveData ? this.sanitizeData(detail) : detail,
    }
  }

  /**
   * Format a generic error into a LodgifyError
   */
  formatError(error: unknown, path: string): LodgifyError {
    // If it's already a LodgifyError (legacy format), return it
    if (isLodgifyError(error)) {
      return error as LodgifyError
    }

    // If it's a LodgifyApiError (new format), map it to legacy format
    if (isLodgifyApiError(error)) {
      return mapApiErrorToLegacy(error as LodgifyApiError, 500, path)
    }

    // If it has HTTP error properties
    if (this.isHttpError(error)) {
      const httpError = error as HttpErrorResponse
      const message =
        this.statusMessages[httpError.status] || `HTTP ${httpError.status} ${httpError.statusText}`

      return {
        error: true,
        message: `Lodgify ${httpError.status}: ${message}`,
        status: httpError.status,
        path,
        detail: this.sanitizeSensitiveData ? this.sanitizeData(httpError.body) : httpError.body,
      }
    }

    // For generic errors
    let message = 'An unexpected error occurred'
    const status = 500
    let detail: unknown

    if (error instanceof Error) {
      message = error.message
      if (this.includeStackTrace) {
        detail = {
          message: error.message,
          stack: error.stack,
        }
      }
    } else if (typeof error === 'string') {
      message = error
    } else {
      detail = error
    }

    return {
      error: true,
      message: `Lodgify ${status}: ${message}`,
      status,
      path,
      detail: this.sanitizeSensitiveData ? this.sanitizeData(detail) : detail,
    }
  }

  /**
   * Check if an error is a LodgifyError (backward compatibility wrapper)
   */
  isLodgifyError(error: unknown): error is LodgifyError {
    return isLodgifyError(error)
  }

  /**
   * Check if an error is an HTTP error response
   */
  private isHttpError(error: unknown): error is HttpErrorResponse {
    return (
      error !== null &&
      typeof error === 'object' &&
      'status' in error &&
      typeof (error as { status: unknown }).status === 'number'
    )
  }

  /**
   * Sanitize sensitive data from error details
   */
  private sanitizeData(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item))
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      // Never expose sensitive data in errors
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value)
      } else if (typeof value === 'string' && this.isSensitiveValue(value)) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  /**
   * Check if a key name suggests sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      'key',
      'password',
      'token',
      'secret',
      'auth',
      'credential',
      'apikey',
      'api_key',
    ]

    const lowerKey = key.toLowerCase()
    return sensitivePatterns.some((pattern) => lowerKey.includes(pattern))
  }

  /**
   * Check if a value appears to be sensitive
   */
  private isSensitiveValue(value: string): boolean {
    // Check for common API key patterns
    if (value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value)) {
      return true
    }

    // Check for JWT patterns
    if (value.startsWith('eyJ')) {
      return true
    }

    return false
  }

  /**
   * Create an error for rate limiting
   */
  createRateLimitError(path: string, retryAfter?: number): LodgifyError {
    const detail = retryAfter ? { retryAfter } : undefined

    return {
      error: true,
      message: 'Lodgify 429: Too Many Requests',
      status: 429,
      path,
      detail,
    }
  }

  /**
   * Create a validation error
   */
  createValidationError(path: string, message: string, detail?: unknown): LodgifyError {
    return {
      error: true,
      message: `Lodgify 400: ${message}`,
      status: 400,
      path,
      detail:
        detail !== undefined && this.sanitizeSensitiveData ? this.sanitizeData(detail) : detail,
    }
  }
}
