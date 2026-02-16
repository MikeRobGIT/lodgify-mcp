/**
 * Tests for QuotesClient - Critical user-facing pricing calculation
 *
 * The quote calculation feature is absolutely essential for users.
 * Without accurate quotes, users cannot:
 * - Know the price before booking
 * - Compare different date ranges
 * - Plan their vacation budget
 * - Make informed booking decisions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseApiClient } from '../../../src/api/base-client.js'
import { QuotesClient } from '../../../src/api/v2/quotes/client.js'
import type { QuoteRequest } from '../../../src/api/v2/quotes/types.js'

describe('QuotesClient - Critical Quote Calculation Feature', () => {
  let client: QuotesClient
  let mockBaseClient: Pick<BaseApiClient, 'request' | 'getFullUrl' | 'getHeaders'>

  beforeEach(() => {
    // Create mock base client
    mockBaseClient = {
      request: vi.fn(),
      getFullUrl: vi.fn((path: string) => `https://api.lodgify.com/v2/quote/${path}`),
      getHeaders: vi.fn(() => ({ 'X-ApiKey': 'test-key' })),
    }

    client = new QuotesClient(mockBaseClient)
  })

  describe('Quote calculation for bookings - Most critical user feature', () => {
    it('should calculate a basic quote for property booking', async () => {
      const mockResponse = {
        total: 1500.0,
        currency: 'USD',
        breakdown: {
          accommodation: 1200.0,
          taxes: 150.0,
          fees: 100.0,
          discount: 50.0,
        },
        availability: 'available',
        minStay: 3,
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: '2025-03-15',
        to: '2025-03-18',
        guestBreakdown: {
          adults: 2,
          children: 0,
        },
        roomTypes: [{ Id: 123 }],
      }

      const result = await client.getQuote('property-456', request)

      expect(result).toEqual(mockResponse)
      expect(mockBaseClient.request).toHaveBeenCalledWith(
        'GET',
        'quote/property-456',
        expect.objectContaining({
          params: expect.objectContaining({
            from: '2025-03-15',
            to: '2025-03-18',
            'guest_breakdown[adults]': 2,
            'guest_breakdown[children]': 0,
            'roomTypes[0].Id': 123,
          }),
        }),
      )
    })

    it('should calculate quote with multiple room types for large groups', async () => {
      const mockResponse = {
        total: 3500.0,
        currency: 'EUR',
        roomDetails: [
          { roomTypeId: 123, rate: 1500.0 },
          { roomTypeId: 456, rate: 2000.0 },
        ],
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: '2025-06-01',
        to: '2025-06-07',
        guestBreakdown: {
          adults: 8,
          children: 3,
          infants: 1,
        },
        roomTypes: [
          { Id: 123, quantity: 1 },
          { Id: 456, quantity: 2 },
        ],
        currency: 'EUR',
        includeBreakdown: true,
        includeExtras: true,
      }

      const result = await client.getQuote('villa-789', request)

      expect(result).toEqual(mockResponse)
      expect(mockBaseClient.request).toHaveBeenCalledWith(
        'GET',
        'quote/villa-789',
        expect.objectContaining({
          params: expect.objectContaining({
            from: '2025-06-01',
            to: '2025-06-07',
            'guest_breakdown[adults]': 8,
            'guest_breakdown[children]': 3,
            'guest_breakdown[infants]': 1,
            'roomTypes[0].Id': 123,
            'roomTypes[0].quantity': 1,
            'roomTypes[1].Id': 456,
            'roomTypes[1].quantity': 2,
            currency: 'EUR',
            includeBreakdown: true,
            includeExtras: true,
          }),
        }),
      )
    })

    it('should handle quote with only adults (no children/infants)', async () => {
      const mockResponse = {
        total: 800.0,
        currency: 'USD',
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: '2025-04-10',
        to: '2025-04-12',
        guestBreakdown: {
          adults: 2,
        },
        roomTypes: [{ Id: 999 }],
      }

      const result = await client.getQuote('apt-101', request)

      expect(result).toEqual(mockResponse)
      // Should NOT include children/infants if not specified
      const callParams = mockBaseClient.request.mock.calls[0][2].params
      expect(callParams).not.toHaveProperty('guest_breakdown[children]')
      expect(callParams).not.toHaveProperty('guest_breakdown[infants]')
    })

    it('should reject quote request with missing property ID', async () => {
      const request: QuoteRequest = {
        from: '2025-03-15',
        to: '2025-03-18',
        guestBreakdown: { adults: 2 },
        roomTypes: [{ Id: 123 }],
      }

      await expect(client.getQuote('', request)).rejects.toThrow('Property ID is required')
    })

    it('should reject quote with invalid request object', async () => {
      await expect(
        client.getQuote('property-123', null as unknown as QuoteRequest),
      ).rejects.toThrow('Valid quote request object is required')
      await expect(
        client.getQuote('property-123', undefined as unknown as QuoteRequest),
      ).rejects.toThrow('Valid quote request object is required')
      await expect(client.getQuote('property-123', 'invalid' as any)).rejects.toThrow(
        'Valid quote request object is required',
      )
    })

    it('should handle API errors gracefully for better user experience', async () => {
      mockBaseClient.request.mockRejectedValue(new Error('Property not available for these dates'))

      const request: QuoteRequest = {
        from: '2025-03-15',
        to: '2025-03-18',
        guestBreakdown: { adults: 2 },
        roomTypes: [{ Id: 123 }],
      }

      await expect(client.getQuote('property-456', request)).rejects.toThrow(
        'Property not available for these dates',
      )
    })
  })

  describe('Raw quote API for flexibility', () => {
    it('should support raw parameters for custom integrations', async () => {
      const mockResponse = { customField: 'value' }
      mockBaseClient.request.mockResolvedValue(mockResponse)

      const params = {
        from: '2025-05-01',
        to: '2025-05-05',
        'guest_breakdown[adults]': 4,
        'roomTypes[0].Id': 777,
        customParam: 'special',
      }

      const result = await client.getQuoteRaw('property-999', params)

      expect(result).toEqual(mockResponse)
      expect(mockBaseClient.request).toHaveBeenCalledWith(
        'GET',
        'quote/property-999',
        expect.objectContaining({ params }),
      )
    })

    it('should reject raw quote with missing property ID', async () => {
      await expect(client.getQuoteRaw('', { from: '2025-05-01' })).rejects.toThrow(
        'Property ID is required',
      )
    })

    it('should reject raw quote with invalid params', async () => {
      await expect(client.getQuoteRaw('property-123', null as any)).rejects.toThrow(
        'Valid parameters object is required for quote',
      )
      await expect(client.getQuoteRaw('property-123', undefined as any)).rejects.toThrow(
        'Valid parameters object is required for quote',
      )
      await expect(client.getQuoteRaw('property-123', 'invalid' as any)).rejects.toThrow(
        'Valid parameters object is required for quote',
      )
    })
  })

  describe('Complex quote scenarios users encounter', () => {
    it('should handle seasonal pricing with peak rates', async () => {
      const mockResponse = {
        total: 5500.0,
        currency: 'USD',
        seasonalPricing: true,
        peakRate: true,
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: '2025-12-23', // Christmas week - peak pricing
        to: '2025-12-30',
        guestBreakdown: {
          adults: 6,
          children: 2,
        },
        roomTypes: [{ Id: 888, quantity: 3 }],
      }

      const result = await client.getQuote('beach-house-1', request)
      expect(result.total).toBe(5500.0)
      expect(result.peakRate).toBe(true)
    })

    it('should handle long-term stay quotes with monthly discounts', async () => {
      const mockResponse = {
        total: 8500.0,
        currency: 'USD',
        discount: {
          type: 'monthly',
          amount: 1500.0,
        },
        nights: 35,
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: '2025-01-15',
        to: '2025-02-19', // 35 nights - monthly discount
        guestBreakdown: {
          adults: 2,
        },
        roomTypes: [{ Id: 555 }],
        includeBreakdown: true,
      }

      const result = await client.getQuote('monthly-rental-22', request)
      expect(result.discount?.amount).toBe(1500.0)
      expect(result.nights).toBe(35)
    })

    it('should handle last-minute booking quotes', async () => {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const mockResponse = {
        total: 250.0,
        currency: 'USD',
        lastMinute: true,
      }

      mockBaseClient.request.mockResolvedValue(mockResponse)

      const request: QuoteRequest = {
        from: today,
        to: tomorrow,
        guestBreakdown: {
          adults: 1,
        },
        roomTypes: [{ Id: 111 }],
      }

      const result = await client.getQuote('studio-33', request)
      expect(result.lastMinute).toBe(true)
    })
  })
})
