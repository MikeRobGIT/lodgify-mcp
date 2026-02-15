/**
 * Daily Rates Pricing Tests
 *
 * Tests for the lodgify_daily_rates MCP tool - CRITICAL USER-FACING FEATURE
 * Property managers depend on this to check daily pricing rates for revenue management
 *
 * User Impact: Without reliable rate checking, managers cannot:
 * - Set competitive pricing
 * - Understand seasonal rate variations
 * - Plan revenue optimization strategies
 * - Quote accurate prices to guests
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { DailyRatesResponse } from '../../src/api/v2/rates/types.js'
import { getRateTools } from '../../src/mcp/tools/rate-tools.js'

describe('Daily Rates Tool - Critical Pricing Information Feature', () => {
  let mockClient: {
    rates: {
      getDailyRates: ReturnType<typeof mock>
      getRateSettings: ReturnType<typeof mock>
    }
    updateRatesV1: ReturnType<typeof mock>
    createBookingQuote: ReturnType<typeof mock>
    getQuote: ReturnType<typeof mock>
    isReadOnly: () => boolean
  }
  let tools: ReturnType<typeof getRateTools>
  let dailyRatesTool: ReturnType<typeof getRateTools>[0]

  beforeEach(() => {
    // Create mock client
    mockClient = {
      rates: {
        getDailyRates: mock(),
        getRateSettings: mock(),
      },
      updateRatesV1: mock(),
      createBookingQuote: mock(),
      getQuote: mock(),
      isReadOnly: () => false,
    }

    // Get tools with mock client
    tools = getRateTools(() => mockClient)
    const tool = tools.find((t) => t.name === 'lodgify_daily_rates')
    if (!tool) throw new Error('Tool not found')
    dailyRatesTool = tool
  })

  afterEach(() => {
    // Clean up mocks
    mock.restore()
  })

  describe('lodgify_daily_rates - Revenue Management for Property Managers', () => {
    describe('Successful Rate Retrieval', () => {
      it('should retrieve daily rates for a room type across date range', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            {
              date: '2024-06-01',
              price: 150.0,
              available: true,
              minStay: 2,
              currency: 'USD',
            },
            {
              date: '2024-06-02',
              price: 150.0,
              available: true,
              minStay: 2,
              currency: 'USD',
            },
            {
              date: '2024-06-03',
              price: 175.0,
              available: true,
              minStay: 2,
              currency: 'USD',
            },
          ],
          averageRate: 158.33,
          lowestRate: 150.0,
          highestRate: 175.0,
          currency: 'USD',
        }

        // Configure mock to return rates data
        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 751902,
          houseId: 684855,
          startDate: '2024-06-01',
          endDate: '2024-06-03',
        })

        // Verify the API was called with correct parameters
        expect(mockClient.rates.getDailyRates).toHaveBeenCalledWith({
          RoomTypeId: '751902',
          HouseId: '684855',
          StartDate: '2024-06-01',
          EndDate: '2024-06-03',
        })

        // Parse the response
        const content = JSON.parse(result.content[0].text)

        // Verify the response includes the rates data (ignoring validation metadata)
        expect(content.data.rates).toEqual(mockResponse.rates)
        expect(content.data.averageRate).toBe(mockResponse.averageRate)
        expect(content.data.rates).toHaveLength(3)
        expect(content.data.averageRate).toBe(158.33)
      })

      it('should handle weekend pricing increases for revenue optimization', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-06-07', price: 150.0, available: true, minStay: 2, currency: 'USD' }, // Friday
            { date: '2024-06-08', price: 225.0, available: true, minStay: 3, currency: 'USD' }, // Saturday
            { date: '2024-06-09', price: 225.0, available: true, minStay: 3, currency: 'USD' }, // Sunday
          ],
          averageRate: 200.0,
          lowestRate: 150.0,
          highestRate: 225.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-07',
          endDate: '2024-06-09',
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates[1].price).toBe(225.0) // Weekend rate higher
        expect(content.data.rates[1].minStay).toBe(3) // Weekend minimum stay requirement
      })

      it('should show seasonal pricing variations for planning', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-07-01', price: 350.0, available: true, minStay: 7, currency: 'USD' }, // Peak summer
            { date: '2024-07-15', price: 375.0, available: true, minStay: 7, currency: 'USD' },
            { date: '2024-09-15', price: 125.0, available: true, minStay: 2, currency: 'USD' }, // Off-season
          ],
          averageRate: 283.33,
          lowestRate: 125.0,
          highestRate: 375.0,
          currency: 'USD',
          seasonalModifier: 'HIGH_SEASON',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 789,
          houseId: 101,
          startDate: '2024-07-01',
          endDate: '2024-09-15',
        })

        // Verify seasonal pricing differences
        const content = JSON.parse(result.content[0].text)
        expect(content.data.highestRate / content.data.lowestRate).toBeGreaterThan(2) // 3x price difference
        expect(content.data.rates[0].minStay).toBe(7) // Peak season requires week-long stays
      })
    })

    describe('Date Validation and Normalization', () => {
      it('should validate date format and reject invalid dates', async () => {
        await expect(
          dailyRatesTool.handler({
            roomTypeId: 123,
            houseId: 456,
            startDate: 'June 1st, 2024', // Invalid format
            endDate: '2024-06-03',
          }),
        ).rejects.toThrow(/Date must be in YYYY-MM-DD format/)
      })

      it('should reject end date before start date', async () => {
        await expect(
          dailyRatesTool.handler({
            roomTypeId: 123,
            houseId: 456,
            startDate: '2024-06-10',
            endDate: '2024-06-05', // End before start
          }),
        ).rejects.toThrow(/Invalid date range|end.*before.*start/i)
      })

      it('should handle same-day rate queries', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-06-01', price: 150.0, available: true, minStay: 1, currency: 'USD' },
          ],
          averageRate: 150.0,
          lowestRate: 150.0,
          highestRate: 150.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-01', // Same day
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates).toHaveLength(1)
        expect(content.data.rates[0].date).toBe('2024-06-01')
      })
    })

    describe('Availability and Restrictions', () => {
      it('should show unavailable dates for booking prevention', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-06-01', price: 150.0, available: true, minStay: 2, currency: 'USD' },
            { date: '2024-06-02', price: 150.0, available: false, minStay: 2, currency: 'USD' }, // Booked
            { date: '2024-06-03', price: 150.0, available: true, minStay: 2, currency: 'USD' },
          ],
          averageRate: 150.0,
          lowestRate: 150.0,
          highestRate: 150.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-03',
        })

        // Verify unavailable dates are marked
        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates[1].available).toBe(false)
        expect(content.data.rates[0].available).toBe(true)
        expect(content.data.rates[2].available).toBe(true)
      })

      it('should show minimum stay requirements for operational planning', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-12-23', price: 450.0, available: true, minStay: 5, currency: 'USD' }, // Holiday minimum
            { date: '2024-12-24', price: 500.0, available: true, minStay: 5, currency: 'USD' },
            { date: '2024-12-25', price: 500.0, available: true, minStay: 5, currency: 'USD' },
          ],
          averageRate: 483.33,
          lowestRate: 450.0,
          highestRate: 500.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-12-23',
          endDate: '2024-12-25',
        })

        // All holiday dates should have 5-night minimum
        const content = JSON.parse(result.content[0].text)
        content.data.rates.forEach((rate) => {
          expect(rate.minStay).toBe(5)
        })
      })
    })

    describe('Currency and International Properties', () => {
      it('should handle multi-currency rates for international properties', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-06-01', price: 140.0, available: true, minStay: 2, currency: 'EUR' },
            { date: '2024-06-02', price: 140.0, available: true, minStay: 2, currency: 'EUR' },
          ],
          averageRate: 140.0,
          lowestRate: 140.0,
          highestRate: 140.0,
          currency: 'EUR',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-02',
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.currency).toBe('EUR')
        expect(content.data.rates[0].currency).toBe('EUR')
      })
    })

    describe('Error Handling', () => {
      it('should handle property not found errors gracefully', async () => {
        mockClient.rates.getDailyRates.mockRejectedValue(
          new Error('404: Property or room type not found'),
        )

        await expect(
          dailyRatesTool.handler({
            roomTypeId: 99999,
            houseId: 99999,
            startDate: '2024-06-01',
            endDate: '2024-06-03',
          }),
        ).rejects.toThrow(/not found/i)
      })

      it('should handle network timeouts for reliability', async () => {
        mockClient.rates.getDailyRates.mockRejectedValue(new Error('Network timeout'))

        await expect(
          dailyRatesTool.handler({
            roomTypeId: 123,
            houseId: 456,
            startDate: '2024-06-01',
            endDate: '2024-06-03',
          }),
        ).rejects.toThrow(/timeout/i)
      })

      it('should handle rate limiting responses', async () => {
        mockClient.rates.getDailyRates.mockRejectedValue(new Error('429: Rate limit exceeded'))

        await expect(
          dailyRatesTool.handler({
            roomTypeId: 123,
            houseId: 456,
            startDate: '2024-06-01',
            endDate: '2024-06-03',
          }),
        ).rejects.toThrow(/429|rate limit/i)
      })
    })

    describe('Edge Cases', () => {
      it('should handle rates with no availability data', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-06-01', price: 150.0, currency: 'USD' } as any, // Missing availability
            { date: '2024-06-02', price: 150.0, currency: 'USD' } as any,
          ],
          averageRate: 150.0,
          lowestRate: 150.0,
          highestRate: 150.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-02',
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates).toHaveLength(2)
        expect(content.data.rates[0].price).toBe(150.0)
      })

      it('should handle empty rate response', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [],
          averageRate: 0,
          lowestRate: 0,
          highestRate: 0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-02',
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates).toHaveLength(0)
        expect(content.data.averageRate).toBe(0)
      })

      it('should handle very long date ranges for annual planning', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: Array.from({ length: 365 }, (_, i) => ({
            date: `2024-${String(Math.floor(i / 31) + 1).padStart(2, '0')}-${String((i % 31) + 1).padStart(2, '0')}`,
            price: 150 + (i % 7) * 25, // Varying prices
            available: true,
            minStay: 2,
            currency: 'USD',
          })),
          averageRate: 175.0,
          lowestRate: 150.0,
          highestRate: 300.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        })

        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates.length).toBe(365)
        expect(content.data.lowestRate).toBeLessThan(content.data.highestRate)
      })
    })

    describe('Business-Critical Scenarios', () => {
      it('should provide accurate rates for immediate booking decisions', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            {
              date: '2024-06-01',
              price: 150.0,
              available: true,
              minStay: 2,
              currency: 'USD',
              surcharge: 25.0,
            },
          ],
          averageRate: 175.0,
          lowestRate: 150.0,
          highestRate: 150.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-06-01',
          endDate: '2024-06-01',
        })

        // Property managers need to see all pricing components
        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates[0].price).toBe(150.0)
        expect(content.data.rates[0].surcharge).toBe(25.0)
        expect(content.data.rates[0].available).toBe(true)
      })

      it('should handle special event pricing for revenue maximization', async () => {
        const mockResponse: DailyRatesResponse = {
          rates: [
            { date: '2024-07-03', price: 200.0, available: true, minStay: 3, currency: 'USD' },
            {
              date: '2024-07-04',
              price: 500.0,
              available: true,
              minStay: 3,
              currency: 'USD',
              note: 'Independence Day',
            },
            { date: '2024-07-05', price: 450.0, available: true, minStay: 3, currency: 'USD' },
          ],
          averageRate: 383.33,
          lowestRate: 200.0,
          highestRate: 500.0,
          currency: 'USD',
        }

        mockClient.rates.getDailyRates.mockResolvedValue(mockResponse)

        const result = await dailyRatesTool.handler({
          roomTypeId: 123,
          houseId: 456,
          startDate: '2024-07-03',
          endDate: '2024-07-05',
        })

        // Verify special event pricing spike
        const content = JSON.parse(result.content[0].text)
        expect(content.data.rates[1].price).toBe(500.0) // July 4th premium
        expect(content.data.rates[1].price).toBeGreaterThan(content.data.rates[0].price * 2) // More than double
      })
    })
  })
})
