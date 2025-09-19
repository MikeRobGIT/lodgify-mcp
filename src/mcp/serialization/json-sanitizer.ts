/**
 * Response Sanitizer Utility
 * Ensures objects are properly serializable to JSON without losing data
 */

/**
 * Sanitizes an object to ensure it can be safely serialized to JSON
 * Handles circular references, non-serializable types, and special objects
 */
export function sanitizeForJson(obj: unknown): unknown {
  const seen = new WeakSet()
  const REDACTED_PLACEHOLDER = '[REDACTED]'
  const SENSITIVE_PATTERNS = [/api[-_]?key/i, /secret/i, /password/i, /token/i, /auth/i]

  function isSensitiveField(path: string): boolean {
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(path))
  }

  function sanitize(value: unknown, path = ''): unknown {
    // Handle primitives
    if (value === null) return null
    if (value === undefined) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    // Handle BigInt - convert to string for JSON serialization
    if (typeof value === 'bigint') {
      return value.toString()
    }

    // Handle dates
    if (value instanceof Date) {
      return value.toISOString()
    }

    // Handle regular expressions
    if (value instanceof RegExp) {
      return value.toString()
    }

    // Handle arrays
    if (Array.isArray(value)) {
      // Check for circular reference
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)

      const sanitized = value.map((item, index) => {
        const nextPath = path ? `${path}[${index}]` : `[${index}]`
        if (isSensitiveField(nextPath)) {
          return REDACTED_PLACEHOLDER
        }
        return sanitize(item, nextPath)
      })

      // Remove from seen set after processing
      seen.delete(value)
      return sanitized
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      // Check for circular reference
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)

      let result: unknown

      // Handle special object types that might have custom toString
      if (value.constructor && value.constructor.name !== 'Object') {
        // If it has a toJSON method, use it
        if (typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
          result = sanitize((value as { toJSON: () => unknown }).toJSON(), path)
          seen.delete(value)
          return result
        }
        // If it's a class instance with properties, extract them
        if (Object.keys(value).length > 0) {
          const sanitized: Record<string, unknown> = {}
          for (const [key, val] of Object.entries(value)) {
            // Skip functions and symbols
            if (typeof val !== 'function' && typeof val !== 'symbol') {
              const nextPath = path ? `${path}.${key}` : key
              if (isSensitiveField(nextPath)) {
                sanitized[key] = REDACTED_PLACEHOLDER
              } else {
                sanitized[key] = sanitize(val, nextPath)
              }
            }
          }
          seen.delete(value)
          return sanitized
        }
        // Otherwise, try to get a string representation
        seen.delete(value)
        return String(value)
      }

      // Handle plain objects
      const sanitized: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        // Skip functions and symbols
        if (typeof val !== 'function' && typeof val !== 'symbol') {
          const nextPath = path ? `${path}.${key}` : key
          if (isSensitiveField(nextPath)) {
            sanitized[key] = REDACTED_PLACEHOLDER
          } else {
            sanitized[key] = sanitize(val, nextPath)
          }
        }
      }

      // Remove from seen set after processing
      seen.delete(value)
      return sanitized
    }

    // Skip functions and symbols
    if (typeof value === 'function') {
      return '[Function]'
    }
    if (typeof value === 'symbol') {
      return '[Symbol]'
    }

    // Fallback to undefined (will be removed in JSON.stringify)
    return undefined
  }

  return sanitize(obj)
}

/**
 * Safely converts an object to a JSON string
 * Handles all edge cases and provides fallback for errors
 */
export function safeJsonStringify(obj: unknown, indent = 2): string {
  try {
    // First sanitize the object
    const sanitized = sanitizeForJson(obj)

    // Then stringify it
    return JSON.stringify(sanitized, null, indent)
  } catch (error) {
    // Log the error for debugging
    if (process.env.DEBUG_HTTP === '1') {
      console.error('Failed to stringify object:', error)
      console.error('Object type:', typeof obj)
      console.error(
        'Object constructor:',
        (obj as { constructor?: { name?: string } })?.constructor?.name,
      )
    }

    // Fallback response for any remaining issues
    return JSON.stringify(
      {
        error: 'Failed to serialize response',
        type: typeof obj,
        constructor: (obj as { constructor?: { name?: string } })?.constructor?.name || 'unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'The response contained data that could not be serialized to JSON',
      },
      null,
      indent,
    )
  }
}

/**
 * Debug helper to log object structure before serialization
 */
export function debugLogResponse(label: string, obj: unknown): void {
  if (process.env.DEBUG_HTTP === '1') {
    console.log(`[Response Debug] ${label}:`)
    console.log('  Type:', typeof obj)
    console.log('  Constructor:', (obj as { constructor?: { name?: string } })?.constructor?.name)
    console.log('  Is Array:', Array.isArray(obj))
    console.log('  Keys:', obj && typeof obj === 'object' ? Object.keys(obj).slice(0, 10) : 'N/A')
  }
}
