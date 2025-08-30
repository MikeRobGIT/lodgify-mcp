import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { loadEnvironment, normalizeBoolean } from '../src/env.js'

// Test the normalizeBoolean function directly
describe('Boolean Normalization', () => {
  it.each(['1', 'true', 'TRUE', ' True ', '  1  '])(
    'should normalize truthy value "%s" to true',
    (input) => {
      expect(normalizeBoolean(input)).toBe(true)
    },
  )

  it.each(['0', 'false', 'FALSE', ' False ', '  0  ', '', '   ', 'anything else'])(
    'should normalize falsy value "%s" to false',
    (input) => {
      expect(normalizeBoolean(input)).toBe(false)
    },
  )

  it('should handle null and undefined', () => {
    expect(normalizeBoolean(null)).toBe(false)
    expect(normalizeBoolean(undefined)).toBe(false)
  })

  it('should handle non-string inputs', () => {
    expect(normalizeBoolean(1)).toBe(true) // "1" after string conversion
    expect(normalizeBoolean(0)).toBe(false) // "0" after string conversion
    expect(normalizeBoolean(true)).toBe(true) // "true" after string conversion
    expect(normalizeBoolean(false)).toBe(false) // "false" after string conversion
    expect(normalizeBoolean({})).toBe(false) // "[object Object]" after string conversion
    expect(normalizeBoolean([])).toBe(false) // "" after string conversion
  })
})

// Test the environment loading with various boolean inputs
describe('Environment Loading with Boolean Normalization', () => {
  // Capture original environment snapshot
  const originalEnvSnapshot = new Map<string, string | undefined>()

  beforeAll(() => {
    // Capture all current environment variables
    for (const [key, value] of Object.entries(process.env)) {
      originalEnvSnapshot.set(key, value)
    }
  })

  afterEach(() => {
    // Restore environment by only modifying changed/added keys
    // Delete keys that were added during tests
    for (const key of Object.keys(process.env)) {
      if (!originalEnvSnapshot.has(key)) {
        delete process.env[key]
      }
    }

    // Restore original values for keys that were modified
    for (const [key, originalValue] of originalEnvSnapshot) {
      process.env[key] = originalValue
    }
  })

  it('should handle DEBUG_HTTP with various inputs', () => {
    // Test with truthy values
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    process.env.DEBUG_HTTP = '1'
    let config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(true)

    process.env.DEBUG_HTTP = 'true'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(true)

    process.env.DEBUG_HTTP = ' TRUE '
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(true)

    // Test with falsy values
    process.env.DEBUG_HTTP = '0'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(false)

    process.env.DEBUG_HTTP = 'false'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(false)

    process.env.DEBUG_HTTP = 'anything else'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(false)
  })

  it('should handle LODGIFY_READ_ONLY with various inputs', () => {
    // Test with truthy values
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    process.env.LODGIFY_READ_ONLY = '1'
    let config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(true)

    process.env.LODGIFY_READ_ONLY = 'true'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(true)

    process.env.LODGIFY_READ_ONLY = ' TRUE '
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(true)

    // Test with falsy values
    process.env.LODGIFY_READ_ONLY = '0'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(false)

    process.env.LODGIFY_READ_ONLY = 'false'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(false)

    process.env.LODGIFY_READ_ONLY = 'anything else'
    config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_READ_ONLY).toBe(false)
  })

  it('should default boolean values when not set', () => {
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    delete process.env.DEBUG_HTTP
    delete process.env.LODGIFY_READ_ONLY

    const config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(false)
    expect(config.LODGIFY_READ_ONLY).toBe(false)
  })
})
