/**
 * Error message sanitization utilities
 * Prevents sensitive information leakage in error messages
 */

/**
 * Sanitizes error messages to prevent sensitive information leakage
 * @param message - The error message to sanitize
 * @returns Sanitized error message safe for client consumption
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove API keys - handle various patterns
  let sanitized = message
    .replace(/api[_-]?key[=:\s]+[\w-]+/gi, 'api_key=***')
    .replace(/authorization[=:\s]+bearer\s+[\w-]+/gi, 'authorization=Bearer ***')
    .replace(/x-api-key[=:\s]+[\w-]+/gi, 'x-api-key=***')

  // Remove URLs with credentials
  sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@[^\s]+/g, 'https://***:***@hostname')

  // Remove tokens and secrets
  sanitized = sanitized
    .replace(/token[=:\s]+[\w.-]+/gi, 'token=***')
    .replace(/secret[=:\s]+[\w.-]+/gi, 'secret=***')
    .replace(/password[=:\s]+[\w.-]+/gi, 'password=***')

  return sanitized
}

/**
 * Extracts safe error details while removing sensitive information
 * @param errorDetails - Raw error details object
 * @returns Sanitized error details safe for client consumption
 */
export function sanitizeErrorDetails(errorDetails: unknown): unknown {
  if (!errorDetails || typeof errorDetails !== 'object') {
    return errorDetails
  }

  // Type guard to ensure errorDetails is a proper object
  const errorObj = errorDetails as Record<string, unknown>
  const sanitized: Record<string, unknown> = { ...errorObj }

  // Remove sensitive fields
  const sensitiveFields = [
    'apiKey',
    'api_key',
    'authorization',
    'x-api-key',
    'token',
    'secret',
    'password',
  ]
  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '***'
    }
  })

  // Sanitize nested objects
  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key]
    if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorDetails(value)
    }
  })

  return sanitized
}
