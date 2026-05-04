/**
 * Comprehensive Tests for V1 Rates Client
 * This tests critical user-facing pricing management functionality
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import type { BaseApiClient } from '../src/api/base-client'
import { RatesV1Client } from '../src/api/v1/rates/client'
import type { RateUpdateV1Request } from '../src/api/v1/rates/types'

// Mock BaseApiClient for testing
class MockBaseApiClient implements BaseApiClient {
  baseUrl = 'https://api.lodgify.com'
  authHeaders = { 'X-ApiKey': 'test-key' }

  private mockResponse: unknown = null
  private mockError: Error | null = null
  private lastRequest: { method: string; path: string; body?: unknown } | null = null

  setMockResponse(response: unknown) {
    this.mockResponse = response
    this.mockError = null
  }

  setMockError(error: Error) {
    this.mockError = error
    this.mockResponse = null
  }

  getLastRequest() {
    return this.lastRequest
  }

  async request(method: string, path: string, options?: unknown): Promise<unknown> {
    this.lastRequest = { method, path, body: options?.body }

    if (this.mockError) {
      throw this.mockError
    }

    return this.mockResponse
  }
}

describe('V1 Rates Client - Critical User-Facing Pricing Management', () => {
  let client: RatesV1Client
  let mockApiClient: MockBaseApiClient

  beforeEach(() => {
    mockApiClient = new MockBaseApiClient()
    client = new RatesV1Client(mockApiClient)
  })

  describe('updateRatesV1 - Core Pricing Update Functionality', () => {
    describe('Successful Rate Updates (Happy Path)', () => {
      it('should update rates for a single room type', async () => {
        // User wants to set summer pricing for a property
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 12345,
          rates: [
            {
              room_type_id: 67890,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 250.0,
              min_stay: 3,
              currency: 'USD',
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
        expect(result.message).toContain('Successfully updated 1 rate entries')
        expect(result.updated_rates).toBe(1)
        expect(result.property_id).toBe(12345)

        // Verify correct API call
        const lastRequest = mockApiClient.getLastRequest()
        expect(lastRequest?.method).toBe('POST')
        expect(lastRequest?.path).toBe('rates/savewithoutavailability')
        expect(lastRequest?.body).toEqual(request)
      })

      it('should update rates for multiple room types', async () => {
        // Property manager updating rates for entire property
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 99999,
          rates: [
            {
              room_type_id: 111,
              start_date: '2025-07-01',
              end_date: '2025-07-15',
              price_per_day: 300.0,
              min_stay: 5,
            },
            {
              room_type_id: 222,
              start_date: '2025-07-01',
              end_date: '2025-07-15',
              price_per_day: 450.0,
              min_stay: 5,
            },
            {
              room_type_id: 333,
              start_date: '2025-07-01',
              end_date: '2025-07-15',
              price_per_day: 600.0,
              min_stay: 7,
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
        expect(result.message).toContain('Successfully updated 3 rate entries')
        expect(result.updated_rates).toBe(3)
      })

      it('should handle rate updates without optional fields', async () => {
        // Basic rate update without min_stay or currency
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 54321,
          rates: [
            {
              room_type_id: 77777,
              start_date: '2025-05-01',
              end_date: '2025-05-31',
              price_per_day: 199.99,
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
        expect(result.property_id).toBe(54321)
      })

      it('should handle rate updates with zero price (free nights)', async () => {
        // Special promotion with free nights
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 88888,
          rates: [
            {
              room_type_id: 44444,
              start_date: '2025-11-20',
              end_date: '2025-11-21',
              price_per_day: 0,
              min_stay: 1,
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
      })

      it('should handle rate updates with high precision pricing', async () => {
        // Pricing with decimal cents
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 11111,
          rates: [
            {
              room_type_id: 22222,
              start_date: '2025-12-20',
              end_date: '2025-12-31',
              price_per_day: 1234.567,
              currency: 'EUR',
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
      })
    })

    describe('Input Validation - Protecting Users from Errors', () => {
      it('should reject missing rate data', async () => {
        await expect(client.updateRatesV1(null as unknown as RateUpdateV1Request)).rejects.toThrow(
          'Rate data is required',
        )

        await expect(
          client.updateRatesV1(undefined as unknown as RateUpdateV1Request),
        ).rejects.toThrow('Rate data is required')
      })

      it('should reject invalid property ID', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 0,
            rates: [],
          }),
        ).rejects.toThrow('Property ID must be a positive integer')

        await expect(
          client.updateRatesV1({
            property_id: -1,
            rates: [],
          }),
        ).rejects.toThrow('Property ID must be a positive integer')

        await expect(
          client.updateRatesV1({
            property_id: 1.5,
            rates: [],
          }),
        ).rejects.toThrow('Property ID must be a positive integer')

        await expect(
          client.updateRatesV1({
            property_id: NaN,
            rates: [],
          }),
        ).rejects.toThrow('Property ID must be a positive integer')
      })

      it('should reject empty rates array', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [],
          }),
        ).rejects.toThrow('At least one rate entry is required')
      })

      it('should reject invalid room type ID', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 0,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Room type ID must be a positive integer')

        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: -999,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Room type ID must be a positive integer')
      })

      it('should reject missing dates', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '',
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Start date and end date are required')

        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Start date and end date are required')
      })

      it('should reject invalid date formats', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '06/01/2025', // US format not allowed
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Dates must be in YYYY-MM-DD format')

        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-6-1', // Missing leading zeros
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Dates must be in YYYY-MM-DD format')

        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025/06/01', // Wrong separator
                end_date: '2025-06-30',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Dates must be in YYYY-MM-DD format')
      })

      it('should reject end date before start date', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-30',
                end_date: '2025-06-01',
                price_per_day: 100,
              },
            ],
          }),
        ).rejects.toThrow('Start date must be before end date')
      })

      it('should reject negative price per day', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: -100,
              },
            ],
          }),
        ).rejects.toThrow('Valid price per day is required')
      })

      it('should reject invalid price types', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: 'free' as unknown as number,
              },
            ],
          }),
        ).rejects.toThrow('Valid price per day is required')

        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: null as unknown as number,
              },
            ],
          }),
        ).rejects.toThrow('Valid price per day is required')
      })

      it('should reject negative min_stay', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: 100,
                min_stay: -1,
              },
            ],
          }),
        ).rejects.toThrow('Min stay must be a non-negative number')
      })

      it('should reject non-numeric min_stay', async () => {
        await expect(
          client.updateRatesV1({
            property_id: 12345,
            rates: [
              {
                room_type_id: 67890,
                start_date: '2025-06-01',
                end_date: '2025-06-30',
                price_per_day: 100,
                min_stay: 'two' as unknown as number,
              },
            ],
          }),
        ).rejects.toThrow('Min stay must be a non-negative number')
      })
    })

    describe('Edge Cases and Business Scenarios', () => {
      it('should handle same-day rate (single day)', async () => {
        // Setting rate for just one specific day
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 55555,
          rates: [
            {
              room_type_id: 66666,
              start_date: '2025-12-31',
              end_date: '2025-12-31',
              price_per_day: 999.0,
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
      })

      it('should handle very long date ranges', async () => {
        // Setting rates for entire year
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 77777,
          rates: [
            {
              room_type_id: 88888,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price_per_day: 175.0,
              min_stay: 2,
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
      })

      it('should handle multiple currencies in batch update', async () => {
        // International property with different currencies per room
        mockApiClient.setMockResponse({ success: true })

        const request: RateUpdateV1Request = {
          property_id: 99999,
          rates: [
            {
              room_type_id: 111,
              start_date: '2025-07-01',
              end_date: '2025-07-31',
              price_per_day: 200.0,
              currency: 'USD',
            },
            {
              room_type_id: 222,
              start_date: '2025-07-01',
              end_date: '2025-07-31',
              price_per_day: 180.0,
              currency: 'EUR',
            },
            {
              room_type_id: 333,
              start_date: '2025-07-01',
              end_date: '2025-07-31',
              price_per_day: 150.0,
              currency: 'GBP',
            },
          ],
        }

        const result = await client.updateRatesV1(request)

        expect(result.success).toBe(true)
        expect(result.updated_rates).toBe(3)
      })
    })

    describe('Error Handling for API Failures', () => {
      it('should handle network errors gracefully', async () => {
        mockApiClient.setMockError(new Error('Network request failed'))

        const request: RateUpdateV1Request = {
          property_id: 12345,
          rates: [
            {
              room_type_id: 67890,
              start_date: '2025-06-01',
              end_date: '2025-06-30',
              price_per_day: 100,
            },
          ],
        }

        await expect(client.updateRatesV1(request)).rejects.toThrow('Network request failed')
      })

      it('should handle API validation errors', async () => {
        mockApiClient.setMockError(new Error('Invalid property access'))

        const request: RateUpdateV1Request = {
          property_id: 99999,
          rates: [
            {
              room_type_id: 11111,
              start_date: '2025-06-01',
              end_date: '2025-06-30',
              price_per_day: 100,
            },
          ],
        }

        await expect(client.updateRatesV1(request)).rejects.toThrow('Invalid property access')
      })

      it('should handle rate limit errors', async () => {
        mockApiClient.setMockError(new Error('Too many requests'))

        const request: RateUpdateV1Request = {
          property_id: 12345,
          rates: [
            {
              room_type_id: 67890,
              start_date: '2025-06-01',
              end_date: '2025-06-30',
              price_per_day: 100,
            },
          ],
        }

        await expect(client.updateRatesV1(request)).rejects.toThrow('Too many requests')
      })
    })

    describe('Client Configuration and Initialization', () => {
      it('should initialize with correct module configuration', () => {
        expect(client).toBeDefined()
        expect(client).toBeInstanceOf(RatesV1Client)

        expect((client as unknown as Record<string, unknown>).version).toBe('v1')
        expect((client as unknown as Record<string, unknown>).basePath).toBe('rates')
        expect((client as unknown as Record<string, unknown>).name).toBe('rates-v1')
      })

      it('should use correct API endpoint path', async () => {
        mockApiClient.setMockResponse({ success: true })

        await client.updateRatesV1({
          property_id: 12345,
          rates: [
            {
              room_type_id: 67890,
              start_date: '2025-06-01',
              end_date: '2025-06-30',
              price_per_day: 100,
            },
          ],
        })

        const lastRequest = mockApiClient.getLastRequest()
        expect(lastRequest?.path).toBe('rates/savewithoutavailability')
        expect(lastRequest?.method).toBe('POST')
      })
    })
  })
})
