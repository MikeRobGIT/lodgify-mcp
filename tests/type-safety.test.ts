/**
 * Type Safety Comprehensive Tests
 * Tests Zod schema validation and type safety improvements
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import {
  DailyRatesResponseSchema,
  RateOperationResponseSchema,
  RateSettingsResponseSchema,
  safeParseDailyRates,
  safeParseRateOperation,
  safeParseRateSettings,
} from '../src/api/v2/rates/schemas.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { createMockFetch, createMockResponse } from './utils.js'

describe('Type Safety Comprehensive Tests', () => {
  let client: LodgifyOrchestrator
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    client = new LodgifyOrchestrator({ apiKey: 'test-api-key' })
  })

  describe('Zod Schema Validation', () => {
    describe('DailyRatesResponseSchema', () => {
      test('should validate correct daily rates response', () => {
        const validResponse = {
          property_id: 123,
          currency: 'USD',
          rates: [
            {
              date: '2025-11-20',
              rate: 150.0,
              available: true,
            },
          ],
        }

        const result = DailyRatesResponseSchema.safeParse(validResponse)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.property_id).toBe(123)
          expect(result.data.currency).toBe('USD')
          expect(result.data.rates).toHaveLength(1)
        }
      })

      test('should reject invalid daily rates response', () => {
        const invalidResponse = {
          // Invalid structure - not an array and missing required object fields
          rates: [],
        }

        const result = DailyRatesResponseSchema.safeParse(invalidResponse)
        expect(result.success).toBe(false)
        if (!result.success) {
          // The union will fail with invalid_union error
          expect(result.error.errors[0].code).toBe('invalid_union')
        }
      })

      test('should validate optional fields correctly', () => {
        const responseWithOptionals = {
          property_id: 123,
          currency: 'EUR',
          room_type_id: 456,
          rates: [
            {
              date: '2025-11-20',
              rate: 120.0,
              currency: 'EUR',
              min_stay: 2,
              max_stay: 7,
              available: false,
              room_type_id: 456,
              property_id: 123,
            },
          ],
          total_entries: 1,
          date_range: {
            from: '2025-11-20',
            to: '2025-11-25',
          },
        }

        const result = DailyRatesResponseSchema.safeParse(responseWithOptionals)
        expect(result.success).toBe(true)
      })

      test('should validate date format strictly', () => {
        const invalidDateResponse = {
          property_id: 123,
          currency: 'USD',
          rates: [
            {
              date: '2025/11/20', // Invalid format
              rate: 150.0,
            },
          ],
        }

        const result = DailyRatesResponseSchema.safeParse(invalidDateResponse)
        expect(result.success).toBe(false)
      })
    })

    describe('RateSettingsResponseSchema', () => {
      test('should validate correct rate settings response', () => {
        const validResponse = {
          property_id: 123,
          currency: 'USD',
          default_rate: 100.0,
        }

        const result = RateSettingsResponseSchema.safeParse(validResponse)
        expect(result.success).toBe(true)
      })

      test('should validate complex rate settings with all fields', () => {
        const complexResponse = {
          property_id: 123,
          currency: 'USD',
          default_rate: 100.0,
          minimum_stay: 2,
          maximum_stay: 14,
          check_in_days: [1, 2, 3, 4, 5], // Monday to Friday
          check_out_days: [0, 6], // Sunday and Saturday
          rate_type: 'per_night' as const,
          pricing_model: 'dynamic' as const,
          tax_settings: {
            tax_rate: 0.1, // 10%
            tax_inclusive: false,
            tax_name: 'VAT',
          },
          seasonal_rates: [
            {
              name: 'Summer Season',
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              rate_multiplier: 1.5,
            },
          ],
          last_updated: '2025-01-01T00:00:00Z',
        }

        const result = RateSettingsResponseSchema.safeParse(complexResponse)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.tax_settings?.tax_rate).toBe(0.1)
          expect(result.data.seasonal_rates).toHaveLength(1)
        }
      })

      test('should validate enum values correctly', () => {
        const invalidEnumResponse = {
          property_id: 123,
          currency: 'USD',
          rate_type: 'per_hour', // Invalid enum value
        }

        const result = RateSettingsResponseSchema.safeParse(invalidEnumResponse)
        expect(result.success).toBe(false)
      })
    })

    describe('RateOperationResponseSchema', () => {
      test('should validate rate creation response', () => {
        const createResponse = {
          rate_id: 'rate-789',
          property_id: 123,
          from: '2025-11-20',
          to: '2025-11-25',
          rate: 150.0,
          currency: 'USD',
          success: true,
        }

        const result = RateOperationResponseSchema.safeParse(createResponse)
        expect(result.success).toBe(true)
      })

      test('should accept numeric rate_id', () => {
        const numericIdResponse = {
          rate_id: 789,
          property_id: 123,
          from: '2025-11-20',
          to: '2025-11-25',
          rate: 150.0,
          currency: 'USD',
          success: true,
        }

        const result = RateOperationResponseSchema.safeParse(numericIdResponse)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Runtime Type Validation', () => {
    test('should throw detailed error for invalid daily rates response', async () => {
      mockFetch = createMockFetch([createMockResponse(200, { invalid: 'response' })])
      global.fetch = mockFetch

      await expect(
        client.getDailyRates({
          propertyId: '123',
          from: '2025-11-20',
          to: '2025-11-25',
        }),
      ).rejects.toThrow(/Invalid daily rates response format/)
    })

    test('should handle flexible rate settings response', async () => {
      // Rate settings schema is flexible to accommodate various API responses
      mockFetch = createMockFetch([createMockResponse(200, { custom: 'fields' })])
      global.fetch = mockFetch

      // Should not throw - the schema allows flexible responses
      const result = await client.getRateSettings({ propertyId: '123' })
      expect(result).toBeDefined()
    })

    test('should successfully process valid responses', async () => {
      mockFetch = createMockFetch([
        createMockResponse(200, {
          property_id: 123,
          currency: 'USD',
          rates: [{ date: '2025-11-20', rate: 200 }],
        }),
      ])
      global.fetch = mockFetch

      const result = await client.getDailyRates({
        propertyId: '123',
        from: '2025-11-20',
        to: '2025-11-25',
      })

      expect(result.property_id).toBe(123)
      expect(result.currency).toBe('USD')
      expect(result.rates).toHaveLength(1)
    })
  })

  describe('Safe Parsing Helpers', () => {
    test('safeParseDailyRates should return success for valid data', () => {
      const validData = {
        property_id: 123,
        currency: 'USD',
        rates: [{ date: '2025-11-20', rate: 150 }],
      }

      const result = safeParseDailyRates(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.property_id).toBe(123)
      }
    })

    test('safeParseDailyRates should return error for invalid data', () => {
      const invalidData = { invalid: 'data' }

      const result = safeParseDailyRates(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    test('safeParseRateSettings should handle valid settings', () => {
      const validSettings = {
        property_id: 123,
        currency: 'USD',
        default_rate: 100,
      }

      const result = safeParseRateSettings(validSettings)
      expect(result.success).toBe(true)
    })

    test('safeParseRateOperation should validate operation responses', () => {
      const validOperation = {
        rate_id: 'rate-123',
        property_id: 123,
        from: '2025-11-20',
        to: '2025-11-25',
        rate: 150,
        currency: 'USD',
        success: true,
      }

      const result = safeParseRateOperation(validOperation)
      expect(result.success).toBe(true)
    })
  })

  describe('Type Inference', () => {
    test('should provide proper TypeScript types', async () => {
      mockFetch = createMockFetch([
        createMockResponse(200, {
          property_id: 123,
          currency: 'USD',
          rates: [{ date: '2025-11-20', rate: 200 }],
        }),
      ])
      global.fetch = mockFetch

      const rates = await client.getDailyRates({
        propertyId: '123',
        from: '2025-11-20',
        to: '2025-11-25',
      })

      // TypeScript should infer the correct types
      expect(typeof rates.property_id).toBe('number')
      expect(typeof rates.currency).toBe('string')
      expect(Array.isArray(rates.rates)).toBe(true)
      expect(typeof rates.rates[0].date).toBe('string')
      expect(typeof rates.rates[0].rate).toBe('number')
    })
  })

  describe('Edge Cases and Error Conditions', () => {
    test('should handle empty arrays gracefully', () => {
      const emptyRatesResponse = {
        property_id: 123,
        currency: 'USD',
        rates: [],
      }

      const result = safeParseDailyRates(emptyRatesResponse)
      expect(result.success).toBe(true)
    })

    test('should validate currency code length', () => {
      const invalidCurrencyResponse = {
        property_id: 123,
        currency: 'DOLLAR', // Too long
        rates: [],
      }

      const result = safeParseDailyRates(invalidCurrencyResponse)
      expect(result.success).toBe(false)
    })

    test('should validate positive numbers for rates', () => {
      const negativeRateResponse = {
        property_id: 123,
        currency: 'USD',
        rates: [
          {
            date: '2025-11-20',
            rate: -100, // Negative rate
          },
        ],
      }

      const result = safeParseDailyRates(negativeRateResponse)
      expect(result.success).toBe(false)
    })

    test('should validate integer constraints', () => {
      const invalidIntegerResponse = {
        property_id: 123.5, // Should be integer
        currency: 'USD',
        rates: [],
      }

      const result = safeParseDailyRates(invalidIntegerResponse)
      expect(result.success).toBe(false)
    })
  })
})
