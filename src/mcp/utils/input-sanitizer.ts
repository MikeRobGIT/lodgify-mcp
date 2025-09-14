/**
 * Input Sanitization and Validation Utilities
 * Provides comprehensive input sanitization and validation for MCP tools
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

// Module-level constants for configuration
/**
 * Maximum allowed string length to prevent DoS attacks
 * Can be adjusted based on application requirements
 */
export const DEFAULT_MAX_STRING_LENGTH = 10000

/**
 * Maximum allowed date range in days (5 years by default)
 * Prevents excessive date ranges that could cause performance issues
 */
export const MAX_DATE_RANGE_DAYS = 365 * 5 // 5 years

/**
 * Valid booking statuses recognized by the system
 */
export const VALID_BOOKING_STATUSES = [
  'booked',
  'tentative',
  'declined',
  'confirmed',
  'open',
] as const

export type ValidBookingStatus = (typeof VALID_BOOKING_STATUSES)[number]

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
    // Enhanced XSS protection with more comprehensive patterns
    let sanitized = value
      // Remove script tags with any attributes or content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocol in any case variation
      .replace(/javascript:/gi, '')
      // Remove data: URLs that could contain scripts
      .replace(/data:text\/html[^,]*,/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript:/gi, '')
      // Remove on* event handlers with various spacing patterns
      .replace(/on\w+\s*=\s*(["']).*?\1/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
      // Remove iframe tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      // Remove object tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      // Remove embed tags
      .replace(/<embed\b[^>]*>/gi, '')
      // Remove meta refresh tags
      .replace(/<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '')
      // Remove base tags that could hijack URLs
      .replace(/<base\b[^>]*>/gi, '')
      // Remove link tags with javascript
      .replace(/<link[^>]+href\s*=\s*["']?javascript:[^>]*>/gi, '')

    // Trim whitespace
    sanitized = sanitized.trim()

    // Limit string length to prevent DoS
    if (sanitized.length > DEFAULT_MAX_STRING_LENGTH) {
      sanitized = sanitized.substring(0, DEFAULT_MAX_STRING_LENGTH)
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
 * Validate date pair (start and end dates)
 * Returns specific error messages for each validation failure
 */
export function validateDatePair(
  startDate: string | undefined,
  endDate: string | undefined,
  startFieldName = 'start_date',
  endFieldName = 'end_date',
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check if dates are provided
  if (!startDate) {
    errors.push(`${startFieldName} is required`)
    return { isValid: false, errors }
  }

  if (!endDate) {
    errors.push(`${endFieldName} is required`)
    return { isValid: false, errors }
  }

  // Validate date formats (assuming YYYY-MM-DD format)
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateFormatRegex.test(startDate)) {
    errors.push(`Invalid ${startFieldName} format: ${startDate}. Use YYYY-MM-DD format.`)
  }

  if (!dateFormatRegex.test(endDate)) {
    errors.push(`Invalid ${endFieldName} format: ${endDate}. Use YYYY-MM-DD format.`)
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  // Validate date range
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (Number.isNaN(start.getTime())) {
    errors.push(`Invalid ${startFieldName}: ${startDate}`)
  }

  if (Number.isNaN(end.getTime())) {
    errors.push(`Invalid ${endFieldName}: ${endDate}`)
  }

  if (errors.length === 0 && end <= start) {
    errors.push(
      `Invalid date range: ${endFieldName} (${endDate}) must be after ${startFieldName} (${startDate})`,
    )
  }

  return { isValid: errors.length === 0, errors }
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
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > MAX_DATE_RANGE_DAYS) {
      return { valid: false, error: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days` }
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
 * Validate GUID/UUID format
 * Validates standard UUID v4 format (8-4-4-4-12 hexadecimal characters)
 */
export function validateGuid(guid: string): boolean {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return guidRegex.test(guid)
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
  return VALID_BOOKING_STATUSES.includes(status.toLowerCase() as ValidBookingStatus)
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
