import { describe, expect, it } from 'bun:test'
import { isISO8601String } from '../../../../src/mcp/utils/response/validators.js'

describe('isISO8601String', () => {
  describe('valid ISO 8601 strings', () => {
    it('should accept timestamps with milliseconds', () => {
      const validTimestamps = [
        '2024-03-31T23:59:59.000Z',
        '2024-01-01T00:00:00.123Z',
        '2025-12-31T12:30:45.999Z',
      ]

      for (const timestamp of validTimestamps) {
        expect(isISO8601String(timestamp)).toBe(true)
      }
    })

    it('should accept timestamps without milliseconds', () => {
      const validTimestamps = [
        '2024-03-31T23:59:59Z',
        '2024-01-01T00:00:00Z',
        '2025-12-31T12:30:45Z',
      ]

      for (const timestamp of validTimestamps) {
        expect(isISO8601String(timestamp)).toBe(true)
      }
    })
  })

  describe('invalid ISO 8601 strings', () => {
    it('should reject invalid date formats', () => {
      const invalidTimestamps = [
        '2024-03-31T23:59:59', // Missing Z
        '2024-03-31 23:59:59Z', // Space instead of T
        '2024/03/31T23:59:59Z', // Wrong date separator
        '2024-13-31T23:59:59Z', // Invalid month
        '2024-03-32T23:59:59Z', // Invalid day
        '2024-03-31T24:59:59Z', // Invalid hour
        '2024-03-31T23:60:59Z', // Invalid minute
        '2024-03-31T23:59:60Z', // Invalid second
        '2024-03-31T23:59:59.1234Z', // Wrong milliseconds length
        'not-a-date',
        '',
      ]

      for (const timestamp of invalidTimestamps) {
        expect(isISO8601String(timestamp)).toBe(false)
      }
    })

    it('should reject timestamps with incorrect milliseconds format', () => {
      const invalidTimestamps = [
        '2024-03-31T23:59:59.1Z', // 1 digit milliseconds
        '2024-03-31T23:59:59.12Z', // 2 digit milliseconds
        '2024-03-31T23:59:59.1234Z', // 4 digit milliseconds
      ]

      for (const timestamp of invalidTimestamps) {
        expect(isISO8601String(timestamp)).toBe(false)
      }
    })

    it('should reject timestamps with non-UTC timezone', () => {
      const invalidTimestamps = [
        '2024-03-31T23:59:59+00:00',
        '2024-03-31T23:59:59-05:00',
        '2024-03-31T23:59:59.000+00:00',
      ]

      for (const timestamp of invalidTimestamps) {
        expect(isISO8601String(timestamp)).toBe(false)
      }
    })
  })
})
