import { describe, expect, it } from 'bun:test'
import {
  sanitizeInput,
  validateDatePair,
  validateGuid,
} from '../../../src/mcp/utils/input-sanitizer.js'

describe('Input Sanitizer', () => {
  describe('sanitizeInput', () => {
    it('should handle null and undefined inputs', () => {
      expect(sanitizeInput(null)).toEqual(null)
      expect(sanitizeInput(undefined)).toEqual(undefined)
    })

    it('should preserve valid data types', () => {
      const input = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' },
      }
      expect(sanitizeInput(input)).toEqual(input)
    })

    it('should prevent XSS attacks in strings', () => {
      const xssAttempts = {
        scriptTag: '<script>alert("XSS")</script>',
        imgTag: '<img src=x onerror="alert(\'XSS\')">',
        eventHandler: '<div onclick="alert(\'XSS\')">Click me</div>',
        dataUri: '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>',
        jsProtocol: '<a href="javascript:alert(\'XSS\')">Click</a>',
        htmlEntities: '&lt;script&gt;alert("XSS")&lt;/script&gt;',
        unicodeBypass: '<\u0073cript>alert("XSS")</\u0073cript>',
        nullByte: '<script\x00>alert("XSS")</script>',
      }

      const sanitized = sanitizeInput(xssAttempts)

      // Verify dangerous content is escaped
      expect(sanitized.scriptTag).not.toContain('<script>')
      expect(sanitized.imgTag).not.toContain('onerror=')
      expect(sanitized.eventHandler).not.toContain('onclick=')
      expect(sanitized.dataUri).not.toContain('data:text/html')
      expect(sanitized.jsProtocol).not.toContain('javascript:')
      expect(sanitized.unicodeBypass).not.toContain('<script>')
      expect(sanitized.nullByte).not.toContain('<script')
    })

    it('should sanitize nested objects', () => {
      const input = {
        level1: {
          level2: {
            xss: '<script>alert("nested")</script>',
            safe: 'normal text',
          },
        },
      }
      const sanitized = sanitizeInput(input)
      expect(sanitized.level1.level2.xss).not.toContain('<script>')
      expect(sanitized.level1.level2.safe).toBe('normal text')
    })

    it('should sanitize arrays of strings', () => {
      const input = {
        messages: ['safe message', '<script>alert("XSS")</script>', 'another safe message'],
      }
      const sanitized = sanitizeInput(input)
      expect(sanitized.messages[1]).not.toContain('<script>')
      expect(sanitized.messages[0]).toBe('safe message')
    })

    it('should handle mixed content with HTML entities', () => {
      const input = {
        encoded: '&lt;div&gt;Already encoded&lt;/div&gt;',
        raw: '<div>Raw HTML</div>',
        mixed: 'Text with <b>bold</b> and <script>bad</script>',
      }
      const sanitized = sanitizeInput(input)
      // sanitizeInput only removes dangerous scripts, not all HTML
      expect(sanitized.raw).toContain('<div>') // Divs are safe
      expect(sanitized.mixed).not.toContain('<script>') // Scripts are removed
    })
  })

  describe('validateDatePair', () => {
    it('should validate correct date pairs', () => {
      const result = validateDatePair('2024-01-01', '2024-01-31')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid date formats', () => {
      const result = validateDatePair('01-01-2024', '31-01-2024')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('Invalid start_date format'))).toBe(true)
      expect(result.errors.some((e) => e.includes('Use YYYY-MM-DD format'))).toBe(true)
    })

    it('should reject end date before start date', () => {
      const result = validateDatePair('2024-02-01', '2024-01-01')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('must be after'))).toBe(true)
    })

    it('should reject same day for start and end', () => {
      // The function requires end date to be AFTER start date, not equal
      const result = validateDatePair('2024-01-15', '2024-01-15')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('must be after'))).toBe(true)
    })

    it('should handle missing dates', () => {
      const result1 = validateDatePair(undefined, '2024-01-01')
      expect(result1.isValid).toBe(false)
      expect(result1.errors[0]).toBe('start_date is required')

      const result2 = validateDatePair('2024-01-01', undefined)
      expect(result2.isValid).toBe(false)
      expect(result2.errors[0]).toBe('end_date is required')
    })

    it('should validate invalid calendar dates', () => {
      const result = validateDatePair('2024-02-30', '2024-03-01')
      expect(result.isValid).toBe(false)
      // The function still processes invalid dates but fails on date range comparison
      expect(result.errors.some((e) => e.includes('must be after'))).toBe(true)
    })

    it('should validate leap year dates', () => {
      const result1 = validateDatePair('2024-02-29', '2024-03-01')
      expect(result1.isValid).toBe(true)

      const result2 = validateDatePair('2023-02-29', '2023-03-01')
      expect(result2.isValid).toBe(false)
      // JavaScript Date constructor adjusts invalid dates (2023-02-29 becomes 2023-03-01)
      // This causes the end date to not be after the adjusted start date
      expect(result2.errors.some((e) => e.includes('must be after'))).toBe(true)
    })
  })

  describe('validateGuid', () => {
    it('should validate correct GUID formats', () => {
      const validGuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '00000000-0000-0000-0000-000000000000',
        'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
      ]

      validGuids.forEach((guid) => {
        expect(validateGuid(guid)).toBe(true)
      })
    })

    it('should reject invalid GUID formats', () => {
      const invalidGuids = [
        '550e8400-e29b-41d4-a716', // Too short
        '550e8400e29b41d4a716446655440000', // No hyphens
        '550e8400-e29b-41d4-a716-44665544000g', // Invalid character
        'not-a-guid',
        '',
        '123',
        '550e8400-e29b-41d4-a716-446655440000-extra', // Too long
      ]

      invalidGuids.forEach((guid) => {
        expect(validateGuid(guid)).toBe(false)
      })
    })

    it('should handle non-string inputs gracefully', () => {
      // validateGuid uses regex test on input, which will fail for non-strings
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(validateGuid(null as any)).toBe(false)
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(validateGuid(undefined as any)).toBe(false)
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(validateGuid(123 as any)).toBe(false)
      // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input types
      expect(validateGuid({} as any)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle extremely long strings', () => {
      const longString = `${'a'.repeat(10000)}<script>alert("XSS")</script>`
      const input = { long: longString }
      const sanitized = sanitizeInput(input)
      expect(sanitized.long).not.toContain('<script>')
      expect(sanitized.long.length).toBeGreaterThan(9000)
    })

    it('should handle special characters in property names', () => {
      const input = {
        'normal-key': 'value1',
        'key.with.dots': 'value2',
        'key[with][brackets]': 'value3',
        key$with$special: 'value4',
      }
      const sanitized = sanitizeInput(input)
      expect(sanitized).toEqual(input)
    })

    it('should handle circular references', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference handling
      const obj: any = { a: 'test' }
      obj.circular = obj

      // Should handle circular references by replacing them with a placeholder
      const result = sanitizeInput(obj)
      expect(result.a).toBe('test')
      expect(result.circular).toBe('[Circular Reference]')
    })

    it('should sanitize URL query parameters', () => {
      const input = {
        url: 'https://example.com?param=<script>alert("XSS")</script>',
        callback: 'https://example.com/callback?token=abc123&action=<img src=x onerror="alert()">',
      }
      const sanitized = sanitizeInput(input)
      expect(sanitized.url).not.toContain('<script>')
      expect(sanitized.callback).not.toContain('onerror=')
    })

    it('should handle various numeric formats', () => {
      const input = {
        integer: 123,
        float: 123.456,
        negative: -789,
        zero: 0,
        stringNumber: '456',
      }
      const sanitized = sanitizeInput(input)
      expect(sanitized.integer).toBe(123)
      expect(sanitized.float).toBe(123.456)
      expect(sanitized.negative).toBe(-789)
      expect(sanitized.zero).toBe(0)
      expect(sanitized.stringNumber).toBe('456')
    })

    it('should throw error for NaN and Infinity', () => {
      // The sanitizeValue function throws McpError for NaN and Infinity
      const inputWithNaN = { value: NaN }
      const inputWithInfinity = { value: Infinity }

      expect(() => sanitizeInput(inputWithNaN)).toThrow()
      expect(() => sanitizeInput(inputWithInfinity)).toThrow()
    })
  })
})
