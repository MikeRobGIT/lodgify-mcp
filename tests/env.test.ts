import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { getEnabledToolSetsFromEnv, loadEnvironment, normalizeBoolean } from '../src/env.js'

// Test the normalizeBoolean function directly
describe('Boolean Normalization', () => {
  it.each(['1', 'true', 'yes', 'on', 'TRUE', 'YES', 'ON', ' True ', ' Yes ', ' On ', '  1  '])(
    'should normalize truthy value "%s" to true',
    (input) => {
      expect(normalizeBoolean(input)).toBe(true)
    },
  )

  it.each([
    '0',
    'false',
    'no',
    'off',
    'FALSE',
    'NO',
    'OFF',
    ' False ',
    ' No ',
    ' Off ',
    '  0  ',
    '',
    '   ',
    'anything else',
  ])('should normalize falsy value "%s" to false', (input) => {
    expect(normalizeBoolean(input)).toBe(false)
  })

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
    // Test with all truthy values
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'

    const truthyValues = ['1', 'true', 'yes', 'on']
    for (const value of truthyValues) {
      process.env.DEBUG_HTTP = value
      const config = loadEnvironment({ allowTestKeys: true })
      expect(config.DEBUG_HTTP).toBe(true)
    }

    // Test with case variations and whitespace
    process.env.DEBUG_HTTP = ' TRUE '
    const config1 = loadEnvironment({ allowTestKeys: true })
    expect(config1.DEBUG_HTTP).toBe(true)

    process.env.DEBUG_HTTP = ' YES '
    const config2 = loadEnvironment({ allowTestKeys: true })
    expect(config2.DEBUG_HTTP).toBe(true)

    process.env.DEBUG_HTTP = ' ON '
    const config3 = loadEnvironment({ allowTestKeys: true })
    expect(config3.DEBUG_HTTP).toBe(true)

    // Test with all falsy values
    const falsyValues = ['0', 'false', 'no', 'off']
    for (const value of falsyValues) {
      process.env.DEBUG_HTTP = value
      const config = loadEnvironment({ allowTestKeys: true })
      expect(config.DEBUG_HTTP).toBe(false)
    }

    // Test with unknown values
    process.env.DEBUG_HTTP = 'anything else'
    const config4 = loadEnvironment({ allowTestKeys: true })
    expect(config4.DEBUG_HTTP).toBe(false)
  })

  it('should handle LODGIFY_READ_ONLY with various inputs', () => {
    // Test with all truthy values
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'

    const truthyValues = ['1', 'true', 'yes', 'on']
    for (const value of truthyValues) {
      process.env.LODGIFY_READ_ONLY = value
      const config = loadEnvironment({ allowTestKeys: true })
      expect(config.LODGIFY_READ_ONLY).toBe(true)
    }

    // Test with case variations and whitespace
    process.env.LODGIFY_READ_ONLY = ' TRUE '
    const config5 = loadEnvironment({ allowTestKeys: true })
    expect(config5.LODGIFY_READ_ONLY).toBe(true)

    process.env.LODGIFY_READ_ONLY = ' YES '
    const config6 = loadEnvironment({ allowTestKeys: true })
    expect(config6.LODGIFY_READ_ONLY).toBe(true)

    process.env.LODGIFY_READ_ONLY = ' ON '
    const config7 = loadEnvironment({ allowTestKeys: true })
    expect(config7.LODGIFY_READ_ONLY).toBe(true)

    // Test with all falsy values
    const falsyValues = ['0', 'false', 'no', 'off']
    for (const value of falsyValues) {
      process.env.LODGIFY_READ_ONLY = value
      const config = loadEnvironment({ allowTestKeys: true })
      expect(config.LODGIFY_READ_ONLY).toBe(false)
    }

    // Test with unknown values
    process.env.LODGIFY_READ_ONLY = 'anything else'
    const config8 = loadEnvironment({ allowTestKeys: true })
    expect(config8.LODGIFY_READ_ONLY).toBe(false)
  })

  it('should default boolean values when not set', () => {
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    delete process.env.DEBUG_HTTP
    delete process.env.LODGIFY_READ_ONLY

    const config = loadEnvironment({ allowTestKeys: true })
    expect(config.DEBUG_HTTP).toBe(false)
    expect(config.LODGIFY_READ_ONLY).toBe(false)
    expect(config.LODGIFY_ENABLED_TOOL_SETS).toBeUndefined()
  })

  it('should parse LODGIFY_ENABLED_TOOL_SETS csv list with deduplication', () => {
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'bookings, rates , quotes, bookings'

    const config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_ENABLED_TOOL_SETS).toEqual(['bookings', 'rates', 'quotes'])
  })

  it('should treat blank tool set configuration as undefined', () => {
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    process.env.LODGIFY_ENABLED_TOOL_SETS = '   '

    const config = loadEnvironment({ allowTestKeys: true })
    expect(config.LODGIFY_ENABLED_TOOL_SETS).toBeUndefined()
  })

  it('should throw for unknown tool set identifiers', () => {
    process.env.LODGIFY_API_KEY =
      'valid-sandbox-api-key-that-is-long-enough-to-pass-validation-12345'
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'bookings,unknown'

    expect(() => loadEnvironment({ allowTestKeys: true })).toThrow(/Unknown tool set/)
  })
})

describe('getEnabledToolSetsFromEnv', () => {
  const originalValue = process.env.LODGIFY_ENABLED_TOOL_SETS

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.LODGIFY_ENABLED_TOOL_SETS
    } else {
      process.env.LODGIFY_ENABLED_TOOL_SETS = originalValue
    }
  })

  it('should return undefined when not configured', () => {
    delete process.env.LODGIFY_ENABLED_TOOL_SETS
    expect(getEnabledToolSetsFromEnv()).toBeUndefined()
  })

  it('should parse values without requiring other env vars', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = 'properties, messaging'
    expect(getEnabledToolSetsFromEnv()).toEqual(['properties', 'messaging'])
  })

  it('should ignore empty values', () => {
    process.env.LODGIFY_ENABLED_TOOL_SETS = '  '
    expect(getEnabledToolSetsFromEnv()).toBeUndefined()
  })
})
