import { describe, expect, it } from 'bun:test'
import { isISO8601String, toISO8601String } from '../../../../src/mcp/utils/response/validators.js'

describe('ISO 8601 Edge Cases', () => {
  describe('Date constructor round-trip consistency', () => {
    it('should handle dates that lose milliseconds when parsed', () => {
      // These are valid ISO 8601 dates without milliseconds
      const datesWithoutMillis = [
        '2024-03-31T23:59:59Z',
        '2024-01-01T00:00:00Z',
        '2025-12-31T12:30:45Z',
        '2024-06-15T14:30:00Z',
      ]

      for (const dateStr of datesWithoutMillis) {
        // Verify the date is valid
        expect(isISO8601String(dateStr)).toBe(true)

        // Verify round-trip through Date constructor
        const date = new Date(dateStr)
        expect(date.toISOString()).toBe(dateStr.replace('Z', '.000Z'))

        // Verify our validator still accepts the original
        expect(isISO8601String(dateStr)).toBe(true)
      }
    })

    it('should handle dates that preserve milliseconds', () => {
      const datesWithMillis = [
        '2024-03-31T23:59:59.999Z',
        '2024-01-01T00:00:00.000Z',
        '2025-12-31T12:30:45.123Z',
        '2024-06-15T14:30:00.456Z',
      ]

      for (const dateStr of datesWithMillis) {
        // Verify the date is valid
        expect(isISO8601String(dateStr)).toBe(true)

        // Verify round-trip through Date constructor
        const date = new Date(dateStr)
        expect(date.toISOString()).toBe(dateStr)

        // Verify our validator accepts it
        expect(isISO8601String(dateStr)).toBe(true)
      }
    })

    it('should handle dates with zero milliseconds explicitly', () => {
      const dateWithZeroMillis = '2024-03-31T23:59:59.000Z'
      const dateWithoutMillis = '2024-03-31T23:59:59Z'

      // Both should be valid
      expect(isISO8601String(dateWithZeroMillis)).toBe(true)
      expect(isISO8601String(dateWithoutMillis)).toBe(true)

      // They represent the same instant
      const date1 = new Date(dateWithZeroMillis)
      const date2 = new Date(dateWithoutMillis)
      expect(date1.getTime()).toBe(date2.getTime())

      // But toISOString always includes milliseconds
      expect(date1.toISOString()).toBe(dateWithZeroMillis)
      expect(date2.toISOString()).toBe(dateWithZeroMillis)
    })
  })

  describe('toISO8601String converter', () => {
    it('should accept and return valid timestamps without milliseconds', () => {
      const input = '2024-03-31T23:59:59Z'
      const result = toISO8601String(input)
      expect(result).toBe(input)
    })

    it('should accept and return valid timestamps with milliseconds', () => {
      const input = '2024-03-31T23:59:59.123Z'
      const result = toISO8601String(input)
      expect(result).toBe(input)
    })

    it('should throw for invalid timestamps', () => {
      const invalidInputs = [
        '2024-03-31T23:59:59', // Missing Z
        '2024-03-31', // Date only
        'not-a-date',
        '',
      ]

      for (const input of invalidInputs) {
        expect(() => toISO8601String(input)).toThrow()
      }
    })
  })

  describe('Real-world usage patterns', () => {
    it('should handle timestamps from various sources', () => {
      // From Date.now()
      const now = new Date()
      const nowISO = now.toISOString()
      expect(isISO8601String(nowISO)).toBe(true)

      // From manual construction
      const manual = '2024-03-31T23:59:59Z'
      expect(isISO8601String(manual)).toBe(true)

      // From API responses (often without milliseconds)
      const apiResponse = '2024-03-31T23:59:59Z'
      expect(isISO8601String(apiResponse)).toBe(true)

      // From database (often with milliseconds)
      const dbTimestamp = '2024-03-31T23:59:59.123Z'
      expect(isISO8601String(dbTimestamp)).toBe(true)
    })

    it('should handle edge times correctly', () => {
      const edgeCases = [
        '2024-01-01T00:00:00Z', // Start of year
        '2024-01-01T00:00:00.000Z', // Start of year with millis
        '2024-12-31T23:59:59Z', // End of year
        '2024-12-31T23:59:59.999Z', // End of year with millis
        '2024-02-29T12:00:00Z', // Leap year
        '2024-02-29T12:00:00.500Z', // Leap year with millis
      ]

      for (const timestamp of edgeCases) {
        expect(isISO8601String(timestamp)).toBe(true)
      }
    })
  })
})
