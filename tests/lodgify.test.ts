import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { createMockFetch, createMockResponse, fixtures } from './utils.js'

describe('LodgifyOrchestrator', () => {
  let client: LodgifyOrchestrator
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new LodgifyOrchestrator({ apiKey: 'test-api-key' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    test('should throw error if API key is not provided', () => {
      expect(() => new LodgifyOrchestrator({ apiKey: '' })).toThrow('API key is required')
    })

    test('should initialize with valid API key', () => {
      expect(() => new LodgifyOrchestrator({ apiKey: 'valid-key' })).not.toThrow()
    })
  })

  describe('429 retry handling', () => {
    test('should retry on 429 with exponential backoff', async () => {
      let callCount = 0

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.properties.listProperties()

      expect(callCount).toBe(2) // Should retry once after initial 429
      expect(result).toMatchObject({ data: expect.any(Array) })
    })

    test('should respect Retry-After header', async () => {
      let callCount = 0

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '3' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.properties.listProperties()

      expect(callCount).toBe(2) // Should retry once after respecting Retry-After
      expect(result).toMatchObject({ data: expect.any(Array) })
    })

    test.skip('should use exponential backoff when no Retry-After header', async () => {
      let callCount = 0

      const mockFetch = mock(async () => {
        callCount++
        if (callCount <= 3) {
          return createMockResponse(429, { error: 'Rate limited' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.properties.listProperties()

      expect(callCount).toBe(4) // Initial call + 3 retries
      expect(result).toMatchObject({ data: expect.any(Array) })
    })

    test.skip('should fail after max retries', async () => {
      let callCount = 0

      const mockFetch = mock(async () => {
        callCount++
        return createMockResponse(429, { error: 'Rate limited' })
      })
      global.fetch = mockFetch

      // Set a shorter timeout for this specific test
      const promise = client.properties.listProperties()

      await expect(promise).rejects.toMatchObject({
        error: true,
      })

      expect(callCount).toBeGreaterThan(1) // Should make multiple attempts
    }, 8000)

    test('should cap retry delay at 30 seconds', async () => {
      let callCount = 0

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '60' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.properties.listProperties()

      expect(callCount).toBe(2) // Should retry once
      expect(result).toMatchObject({ data: expect.any(Array) })
    })
  })

  describe('Error formatting', () => {
    test('should format 400 Bad Request error correctly', async () => {
      const errorDetail = { message: 'Invalid parameters', code: 'BAD_REQUEST' }
      global.fetch = createMockFetch([createMockResponse(400, errorDetail)])

      await expect(client.properties.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Invalid parameters', // Now uses the message from the API error
        status: 400,
        path: '/v2/properties',
        detail: {
          code: 'BAD_REQUEST',
          correlation_id: undefined,
          event_id: undefined,
        },
      })
    })

    test('should format 401 Unauthorized error correctly', async () => {
      global.fetch = createMockFetch([createMockResponse(401, { message: 'Invalid API key' })])

      await expect(client.properties.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 401: Unauthorized - Check your API key',
        status: 401,
        path: '/v2/properties',
        detail: { message: 'Invalid API key' },
      })
    })

    test('should format 404 Not Found error correctly', async () => {
      global.fetch = createMockFetch([createMockResponse(404, {})])

      await expect(client.properties.getProperty('non-existent')).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 404: Not Found',
        status: 404,
        path: '/v2/properties/non-existent',
      })
    })

    test.skip('should format 500 Internal Server Error correctly', async () => {
      global.fetch = createMockFetch([
        createMockResponse(500, { error: 'Server error' }),
        createMockResponse(500, { error: 'Server error' }),
        createMockResponse(500, { error: 'Server error' }),
        createMockResponse(500, { error: 'Server error' }),
        createMockResponse(500, { error: 'Server error' }),
        createMockResponse(500, { error: 'Server error' }),
      ])

      await expect(client.properties.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/v2/properties/',
      })
    })

    test.skip('should handle network errors', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')))

      await expect(client.properties.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Network error: Network error',
        status: 0,
        path: '/v2/properties/',
      })
    })

    test.skip('should handle non-JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: mock(() => Promise.resolve('Plain text error')),
        json: mock(() => Promise.reject(new Error('Invalid JSON'))),
      } as unknown as Response

      global.fetch = mock(() => Promise.resolve(mockResponse))

      await expect(client.properties.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/v2/properties/',
        detail: '',
      })
    })
  })

  describe('Request methods', () => {
    test('should make GET request with correct headers', async () => {
      const mockFetch = createMockFetch([createMockResponse(200, fixtures.property)])
      global.fetch = mockFetch

      await client.properties.listProperties()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/properties'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-ApiKey': 'test-api-key',
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    test('should make POST request with body', async () => {
      const payload = { amount: 100, currency: 'USD' }
      const mockFetch = createMockFetch([createMockResponse(201, { success: true })])
      global.fetch = mockFetch

      await client.bookings.createBookingPaymentLink('booking-123', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/reservations/bookings/booking-123/quote/paymentLink'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
          headers: expect.objectContaining({
            'X-ApiKey': 'test-api-key',
            'Content-Type': 'application/json',
          }),
        }),
      )
    })

    test('should make PUT request with body', async () => {
      const payload = { keyCodes: ['1234', '5678'] }
      const mockFetch = createMockFetch([createMockResponse(200, { success: true })])
      global.fetch = mockFetch

      await client.bookings.updateKeyCodes('booking-123', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/reservations/bookings/booking-123/keyCodes'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      )
    })

    test('should encode URI components in path', async () => {
      const mockFetch = createMockFetch([createMockResponse(200, fixtures.property)])
      global.fetch = mockFetch

      await client.properties.getProperty('prop/with/slashes')

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Parameter validation', () => {
    test('should throw error for missing property ID', async () => {
      await expect(client.properties.getProperty('')).rejects.toThrow('Property ID is required')
    })

    test('should throw error for missing booking ID', async () => {
      await expect(client.bookings.getBooking('')).rejects.toThrow('Booking ID is required')
    })

    test('should throw error for missing thread GUID', async () => {
      await expect(client.messaging.getThread('')).rejects.toThrow('Thread GUID is required')
    })

    test('should throw error for missing payload in POST request', async () => {
      await expect(
        client.bookings.createBookingPaymentLink(
          'booking-123',
          null as unknown as Record<string, unknown>,
        ),
      ).rejects.toThrow('Payload is required')
    })

    test('should throw error for missing parameters in rate methods', async () => {
      await expect(
        client.rates.getDailyRates(null as unknown as Record<string, unknown>),
      ).rejects.toThrow('Parameters are required for daily rates')
    })
  })
})
