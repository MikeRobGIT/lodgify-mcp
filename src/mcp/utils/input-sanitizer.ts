/**
 * Input Sanitization and Validation Utilities
 * Provides comprehensive input sanitization and validation for MCP tools
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

/**
 * Sanitize input by removing potentially dangerous content
 * and normalizing data types
 */
export function sanitizeInput<T extends Record<string, unknown>>(input: T): T {
  if (!input || typeof input !== 'object') {
    return input
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    // Skip undefined values
    if (value === undefined) {
      continue
    }

    // Handle null values
    if (value === null) {
      sanitized[key] = null
      continue
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeInput(value as Record<string, unknown>)
      continue
    }

    // Sanitize arrays
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? sanitizeInput(item) : sanitizeValue(item),
      )
      continue
    }

    // Sanitize individual values
    sanitized[key] = sanitizeValue(value)
  }

  return sanitized as T
}

/**
 * Sanitize individual values
 */
function sanitizeValue(value: unknown): unknown {
  // Handle strings
  if (typeof value === 'string') {
    // Remove potential script injection attempts
    let sanitized = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')

    // Trim whitespace
    sanitized = sanitized.trim()

    // Limit string length to prevent DoS
    const MAX_STRING_LENGTH = 10000
    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_STRING_LENGTH)
    }

    return sanitized
  }

  // Handle numbers
  if (typeof value === 'number') {
    // Check for NaN and Infinity
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid number value: must be a finite number')
    }

    // Limit number range to prevent overflow
    const MAX_SAFE_NUMBER = Number.MAX_SAFE_INTEGER
    const MIN_SAFE_NUMBER = Number.MIN_SAFE_INTEGER

    if (value > MAX_SAFE_NUMBER || value < MIN_SAFE_NUMBER) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Number value out of safe range: ${MIN_SAFE_NUMBER} to ${MAX_SAFE_NUMBER}`,
      )
    }

    return value
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value
  }

  // Handle dates
  if (value instanceof Date) {
    // Check for invalid dates
    if (Number.isNaN(value.getTime())) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid date value')
    }
    return value
  }

  // Default: return as-is for other types
  return value
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
): { valid: boolean; error?: string } {
  try {
    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Check if dates are valid
    if (Number.isNaN(start.getTime())) {
      return { valid: false, error: 'Invalid start date format' }
    }

    if (Number.isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid end date format' }
    }

    // Check if end date is after start date
    if (end <= start) {
      return { valid: false, error: 'End date must be after start date' }
    }

    // Check for reasonable date range (prevent DoS)
    const MAX_DAYS = 365 * 5 // 5 years
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > MAX_DAYS) {
      return { valid: false, error: `Date range exceeds maximum of ${MAX_DAYS} days` }
    }

    return { valid: true }
  } catch (_error) {
    return { valid: false, error: 'Invalid date format' }
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Validate phone number format (basic validation)
 */
export function validatePhone(phone: string): boolean {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-().]/g, '')
  // Check if it contains only digits and optional + at the start
  const phoneRegex = /^\+?\d{7,15}$/
  return phoneRegex.test(cleaned)
}

/**
 * Validate currency code (ISO 4217)
 */
export function validateCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code)
}

/**
 * Sanitize and validate property ID
 */
export function validatePropertyId(id: string | number): string {
  const idStr = String(id).trim()

  if (!idStr || idStr === '0') {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid property ID: must be a non-zero value')
  }

  // Check for reasonable ID format (numeric or alphanumeric)
  if (!/^[a-zA-Z0-9_-]+$/.test(idStr)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Invalid property ID format: must contain only letters, numbers, underscores, or hyphens',
    )
  }

  // Limit ID length
  if (idStr.length > 100) {
    throw new McpError(ErrorCode.InvalidParams, 'Property ID too long: maximum 100 characters')
  }

  return idStr
}

/**
 * Validate booking status
 */
export function validateBookingStatus(status: string): boolean {
  const validStatuses = ['booked', 'tentative', 'declined', 'confirmed', 'open']
  return validStatuses.includes(status.toLowerCase())
}

/**
 * Validate guest count
 */
export function validateGuestCount(adults: number, children?: number, infants?: number): void {
  if (adults < 1) {
    throw new McpError(ErrorCode.InvalidParams, 'At least one adult guest is required')
  }

  if (adults > 50) {
    throw new McpError(ErrorCode.InvalidParams, 'Guest count exceeds maximum: 50 adults')
  }

  if (children !== undefined && children < 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Number of children cannot be negative')
  }

  if (children !== undefined && children > 50) {
    throw new McpError(ErrorCode.InvalidParams, 'Children count exceeds maximum: 50')
  }

  if (infants !== undefined && infants < 0) {
    throw new McpError(ErrorCode.InvalidParams, 'Number of infants cannot be negative')
  }

  if (infants !== undefined && infants > 20) {
    throw new McpError(ErrorCode.InvalidParams, 'Infants count exceeds maximum: 20')
  }

  const totalGuests = adults + (children || 0) + (infants || 0)
  if (totalGuests > 100) {
    throw new McpError(ErrorCode.InvalidParams, 'Total guest count exceeds maximum: 100')
  }
}

/**
 * Validate price/amount
 */
export function validatePrice(price: number, fieldName: string = 'price'): void {
  if (price < 0) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${fieldName}: cannot be negative`)
  }

  if (price > 1000000) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} exceeds maximum: 1,000,000`)
  }

  // Check for reasonable decimal places (prevent precision issues)
  const decimalPlaces = (price.toString().split('.')[1] || '').length
  if (decimalPlaces > 2) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `${fieldName} has too many decimal places: maximum 2`,
    )
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, size?: number): void {
  if (page !== undefined) {
    if (page < 1) {
      throw new McpError(ErrorCode.InvalidParams, 'Page number must be at least 1')
    }

    if (page > 10000) {
      throw new McpError(ErrorCode.InvalidParams, 'Page number exceeds maximum: 10000')
    }
  }

  if (size !== undefined) {
    if (size < 1) {
      throw new McpError(ErrorCode.InvalidParams, 'Page size must be at least 1')
    }

    if (size > 100) {
      throw new McpError(ErrorCode.InvalidParams, 'Page size exceeds maximum: 100')
    }
  }
}
