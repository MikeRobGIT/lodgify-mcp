/**
 * Helper utility functions for Response Enhancer
 */

/**
 * Helper to safely get a nested property value
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Helper to safely get a string value
 */
export function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Helper to safely get a number value
 */
export function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

/**
 * Helper to safely get a string or convert number to string
 * This is useful for IDs that might be returned as numbers from the API
 */
export function getStringOrNumber(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  return undefined
}

/**
 * Helper to format status strings with proper capitalization
 * Converts status to title case (first letter uppercase, rest lowercase)
 */
export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}
