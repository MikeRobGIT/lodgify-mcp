import { describe, expect, it } from 'bun:test'
import { isISO8601String } from '../../../../src/mcp/utils/response/validators.js'

describe('Issue Fix: ISO 8601 validator should accept timestamps without milliseconds', () => {
  it('should accept valid ISO 8601 timestamps that omit milliseconds', () => {
    // These are the types of timestamps that were failing before the fix
    const timestampsWithoutMilliseconds = [
      '2024-03-31T23:59:59Z', // The specific example from the issue
      '2024-01-01T00:00:00Z',
      '2025-12-31T12:30:45Z',
    ]

    // Before the fix, these would fail because:
    // - new Date('2024-03-31T23:59:59Z').toISOString() returns '2024-03-31T23:59:59.000Z'
    // - The validator was comparing '2024-03-31T23:59:59.000Z' === '2024-03-31T23:59:59Z'
    // - This comparison would always fail

    for (const timestamp of timestampsWithoutMilliseconds) {
      // This should now pass after our fix
      expect(isISO8601String(timestamp)).toBe(true)

      // Verify the underlying issue: Date.toISOString() always adds .000Z
      const date = new Date(timestamp)
      expect(date.toISOString()).toBe(timestamp.replace('Z', '.000Z'))

      // But our validator should still accept the original format
      expect(isISO8601String(timestamp)).toBe(true)
    }
  })

  it('should still accept timestamps with milliseconds', () => {
    // These should continue to work as before
    const timestampsWithMilliseconds = [
      '2024-03-31T23:59:59.000Z',
      '2024-03-31T23:59:59.123Z',
      '2024-03-31T23:59:59.999Z',
    ]

    for (const timestamp of timestampsWithMilliseconds) {
      expect(isISO8601String(timestamp)).toBe(true)
    }
  })

  it('demonstrates the exact fix: comparing based on millisecond presence', () => {
    const withoutMillis = '2024-03-31T23:59:59Z'
    const withMillis = '2024-03-31T23:59:59.000Z'

    // Both are valid
    expect(isISO8601String(withoutMillis)).toBe(true)
    expect(isISO8601String(withMillis)).toBe(true)

    // They represent the same time
    const date1 = new Date(withoutMillis)
    const date2 = new Date(withMillis)
    expect(date1.getTime()).toBe(date2.getTime())

    // The fix handles the comparison appropriately:
    // - For input without '.': compares against date.toISOString().replace('.000Z', 'Z')
    // - For input with '.': compares against date.toISOString() directly
  })
})
