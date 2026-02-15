/**
 * Tests for validateQuoteParams function
 * This function is critical for ensuring quote parameters are properly formatted
 * before being sent to the Lodgify API, directly impacting pricing accuracy
 */

import { describe, expect, it } from 'bun:test'
import { validateQuoteParams } from '../src/mcp/tools/helper-tools.js'

describe('validateQuoteParams - Critical Quote Parameter Validation', () => {
  describe('Date Parameter Mapping', () => {
    it('should map from/to to arrival/departure for v2 API compatibility', () => {
      const params = {
        from: '2025-03-15',
        to: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-03-15')
      expect(result.departure).toBe('2025-03-20')
      expect(result.from).toBeUndefined()
      expect(result.to).toBeUndefined()
    })

    it('should keep arrival/departure if already present', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-03-15')
      expect(result.departure).toBe('2025-03-20')
    })

    it('should prefer arrival/departure over from/to if both are present', () => {
      const params = {
        from: '2025-03-10',
        to: '2025-03-12',
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-03-15')
      expect(result.departure).toBe('2025-03-20')
      // from/to are preserved in the result, just not used for dates
      expect(result.from).toBe('2025-03-10')
      expect(result.to).toBe('2025-03-12')
    })
  })

  describe('Required Parameter Validation', () => {
    it('should throw error when arrival date is missing', () => {
      const params = {
        departure: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params)).toThrow(
        'Quote requires both "arrival" and "departure" date parameters'
      )
    })

    it('should throw error when departure date is missing', () => {
      const params = {
        arrival: '2025-03-15',
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params)).toThrow(
        'Quote requires both "arrival" and "departure" date parameters'
      )
    })

    it('should throw error when both dates are missing', () => {
      const params = {
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params)).toThrow(
        'Quote requires both "arrival" and "departure" date parameters'
      )
    })
  })

  describe('Date Validation', () => {
    it('should validate date formats when skipDateValidation is false', () => {
      const params = {
        arrival: 'invalid-date',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params, false)).toThrow()
    })

    it('should skip date validation when skipDateValidation is true', () => {
      const params = {
        arrival: 'pre-validated-date',
        departure: 'another-validated-date',
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params, true)).not.toThrow()
    })

    it('should reject departure before arrival when validation is enabled', () => {
      const params = {
        arrival: '2025-03-20',
        departure: '2025-03-15',
        'guest_breakdown[adults]': 2,
      }

      expect(() => validateQuoteParams(params, false)).toThrow()
    })
  })

  describe('Guest Breakdown Defaults', () => {
    it('should add default adults when not provided', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
      }

      const result = validateQuoteParams(params, true)

      expect(result['guest_breakdown[adults]']).toBe(2)
    })

    it('should add default children when not provided', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 3,
      }

      const result = validateQuoteParams(params, true)

      expect(result['guest_breakdown[children]']).toBe(0)
    })

    it('should preserve existing guest breakdown values', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 4,
        'guest_breakdown[children]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result['guest_breakdown[adults]']).toBe(4)
      expect(result['guest_breakdown[children]']).toBe(2)
    })

    it('should handle adults parameter as alternative to guest_breakdown[adults]', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        adults: 3,
      }

      const result = validateQuoteParams(params, true)

      // The function checks for guest_breakdown[adults] or adults, but only adds guest_breakdown[adults] if neither exists
      // Since adults exists, it doesn't add guest_breakdown[adults]
      expect(result['guest_breakdown[adults]']).toBeUndefined()
      expect(result.adults).toBe(3)
      // But children default is still added
      expect(result['guest_breakdown[children]']).toBe(0)
    })
  })

  describe('Room Type Configuration', () => {
    it('should calculate and set room type People parameter', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'roomTypes[0].Id': 12345,
        'guest_breakdown[adults]': 2,
        'guest_breakdown[children]': 1,
      }

      const result = validateQuoteParams(params, true)

      expect(result['roomTypes[0].People']).toBe(3) // 2 adults + 1 child
      expect(result['roomTypes[0].guest_breakdown.adults']).toBe(2)
      expect(result['roomTypes[0].guest_breakdown.children']).toBe(1)
    })

    it('should use existing People parameter if already set', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'roomTypes[0].Id': 12345,
        'roomTypes[0].People': 5,
        'guest_breakdown[adults]': 2,
        'guest_breakdown[children]': 1,
      }

      const result = validateQuoteParams(params, true)

      expect(result['roomTypes[0].People']).toBe(5) // Preserves existing value
      expect(result['roomTypes[0].guest_breakdown.adults']).toBe(2)
      expect(result['roomTypes[0].guest_breakdown.children']).toBe(1)
    })

    it('should handle room type without guest breakdown gracefully', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'roomTypes[0].Id': 12345,
      }

      const result = validateQuoteParams(params, true)

      expect(result['roomTypes[0].People']).toBe(2) // Default
      expect(result['roomTypes[0].guest_breakdown.adults']).toBe(2)
      expect(result['roomTypes[0].guest_breakdown.children']).toBe(0)
    })

    it('should not add room type parameters when room ID is not provided', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'guest_breakdown[adults]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result['roomTypes[0].People']).toBeUndefined()
      expect(result['roomTypes[0].guest_breakdown.adults']).toBeUndefined()
    })
  })

  describe('Optional Parameter Defaults', () => {
    it('should set default includeExtras to false when not provided', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
      }

      const result = validateQuoteParams(params, true)

      expect(result.includeExtras).toBe(false)
    })

    it('should set default includeBreakdown to true when not provided', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
      }

      const result = validateQuoteParams(params, true)

      expect(result.includeBreakdown).toBe(true)
    })

    it('should preserve explicitly set false values for optional parameters', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        includeExtras: false,
        includeBreakdown: false,
      }

      const result = validateQuoteParams(params, true)

      expect(result.includeExtras).toBe(false)
      expect(result.includeBreakdown).toBe(false)
    })

    it('should preserve explicitly set true values for optional parameters', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        includeExtras: true,
        includeBreakdown: true,
      }

      const result = validateQuoteParams(params, true)

      expect(result.includeExtras).toBe(true)
      expect(result.includeBreakdown).toBe(true)
    })
  })

  describe('Complex Real-World Scenarios', () => {
    it('should handle full quote request with all parameters', () => {
      const params = {
        from: '2025-06-01',
        to: '2025-06-07',
        'roomTypes[0].Id': 54321,
        'guest_breakdown[adults]': 4,
        'guest_breakdown[children]': 2,
        includeExtras: true,
        includeBreakdown: true,
        someCustomParam: 'value',
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-06-01')
      expect(result.departure).toBe('2025-06-07')
      expect(result['roomTypes[0].Id']).toBe(54321)
      expect(result['roomTypes[0].People']).toBe(6)
      expect(result['roomTypes[0].guest_breakdown.adults']).toBe(4)
      expect(result['roomTypes[0].guest_breakdown.children']).toBe(2)
      expect(result.includeExtras).toBe(true)
      expect(result.includeBreakdown).toBe(true)
      expect(result.someCustomParam).toBe('value')
    })

    it('should handle minimal quote request with only required fields', () => {
      const params = {
        from: '2025-04-10',
        to: '2025-04-12',
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-04-10')
      expect(result.departure).toBe('2025-04-12')
      expect(result['guest_breakdown[adults]']).toBe(2)
      expect(result['guest_breakdown[children]']).toBe(0)
      expect(result.includeExtras).toBe(false)
      expect(result.includeBreakdown).toBe(true)
    })

    it('should preserve all original parameters while adding defaults', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        propertyId: 'prop-123',
        specialRequest: 'Late check-in',
        'guest_breakdown[adults]': 2,
      }

      const result = validateQuoteParams(params, true)

      expect(result.arrival).toBe('2025-03-15')
      expect(result.departure).toBe('2025-03-20')
      expect(result.propertyId).toBe('prop-123')
      expect(result.specialRequest).toBe('Late check-in')
      expect(result['guest_breakdown[children]']).toBe(0)
    })

    it('should handle edge case with zero guests gracefully', () => {
      const params = {
        arrival: '2025-03-15',
        departure: '2025-03-20',
        'roomTypes[0].Id': 12345,
        'guest_breakdown[adults]': 0,
        'guest_breakdown[children]': 0,
      }

      const result = validateQuoteParams(params, true)

      // Should still set People to default minimum when calculation yields 0
      expect(result['roomTypes[0].People']).toBe(2)
    })
  })
})