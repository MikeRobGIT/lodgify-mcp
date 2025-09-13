/**
 * Authentication error class
 */

import { AuthErrorType } from '../types/index.js'

/**
 * Custom error class for authentication failures
 */
export class AuthError extends Error {
  public readonly type: AuthErrorType
  public readonly statusCode: number
  public readonly details?: unknown

  constructor(message: string, type: AuthErrorType, details?: unknown) {
    super(message)
    this.name = 'AuthError'
    this.type = type
    this.details = details
    this.statusCode = this.getStatusCode(type)

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError)
    }
  }

  /**
   * Map error type to HTTP status code
   */
  private getStatusCode(type: AuthErrorType): number {
    switch (type) {
      case AuthErrorType.INVALID_TOKEN:
      case AuthErrorType.EXPIRED_TOKEN:
      case AuthErrorType.INVALID_CREDENTIALS:
        return 401 // Unauthorized

      case AuthErrorType.MISSING_TOKEN:
        return 401 // Unauthorized

      case AuthErrorType.INSUFFICIENT_SCOPE:
        return 403 // Forbidden

      case AuthErrorType.PROVIDER_ERROR:
        return 502 // Bad Gateway

      case AuthErrorType.CONFIGURATION_ERROR:
        return 500 // Internal Server Error

      default:
        return 500
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: this.type,
      message: this.message,
      details: this.details,
    }
  }

  /**
   * Get WWW-Authenticate header value for 401 responses
   */
  getWWWAuthenticateHeader(): string | null {
    switch (this.type) {
      case AuthErrorType.INVALID_TOKEN:
        return 'Bearer error="invalid_token"'
      case AuthErrorType.EXPIRED_TOKEN:
        return 'Bearer error="invalid_token", error_description="Token expired"'
      case AuthErrorType.MISSING_TOKEN:
        return 'Bearer'
      case AuthErrorType.INSUFFICIENT_SCOPE:
        return 'Bearer error="insufficient_scope"'
      default:
        return null
    }
  }
}

/**
 * Check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError
}
