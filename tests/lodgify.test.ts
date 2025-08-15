import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { LodgifyClient } from '../src/lodgify.js'
import { createMockFetch, createMockResponse, fixtures, mockTimers } from './utils.js'

describe('LodgifyClient', () => {
  let client: LodgifyClient
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new LodgifyClient('test-api-key')
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('constructor', () => {
    test('should throw error if API key is not provided', () => {
      expect(() => new LodgifyClient('')).toThrow('Lodgify API key is required')
    })

    test('should initialize with valid API key', () => {
      expect(() => new LodgifyClient('valid-key')).not.toThrow()
    })
  })

  describe('429 retry handling', () => {
    test('should retry on 429 with exponential backoff', async () => {
      let callCount = 0
      const sleepCalls: number[] = []

      // Inject a mock sleep function that tracks delays
      client._sleepFn = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.listProperties()

      expect(callCount).toBe(2)
      expect(sleepCalls).toEqual([1000]) // 2^0 * 1000 = 1000ms for first retry
      expect(result).toEqual(fixtures.property)
    })

    test('should respect Retry-After header', async () => {
      let callCount = 0
      const sleepCalls: number[] = []

      client._sleepFn = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '3' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.listProperties()

      expect(callCount).toBe(2)
      expect(sleepCalls).toEqual([3000]) // Retry-After header says 3 seconds
      expect(result).toEqual(fixtures.property)
    })

    test('should use exponential backoff when no Retry-After header', async () => {
      let callCount = 0
      const sleepCalls: number[] = []

      client._sleepFn = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })

      const mockFetch = mock(async () => {
        callCount++
        if (callCount <= 3) {
          return createMockResponse(429, { error: 'Rate limited' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.listProperties()

      expect(callCount).toBe(4)
      // Exponential backoff: 2^0=1s, 2^1=2s, 2^2=4s
      expect(sleepCalls).toEqual([1000, 2000, 4000])
      expect(result).toEqual(fixtures.property)
    })

    test('should fail after max retries', async () => {
      let callCount = 0
      const sleepCalls: number[] = []

      client._sleepFn = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })

      const mockFetch = mock(async () => {
        callCount++
        return createMockResponse(429, { error: 'Rate limited' })
      })
      global.fetch = mockFetch

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: expect.stringContaining('Max retries (5) exceeded'),
        status: 429,
      })

      expect(callCount).toBe(5)
      // Exponential backoff: 2^0=1s, 2^1=2s, 2^2=4s, 2^3=8s, 2^4=16s
      expect(sleepCalls).toEqual([1000, 2000, 4000, 8000, 16000])
    })

    test('should cap retry delay at 30 seconds', async () => {
      let callCount = 0
      const sleepCalls: number[] = []

      client._sleepFn = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })

      const mockFetch = mock(async () => {
        callCount++
        if (callCount === 1) {
          return createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '60' })
        }
        return createMockResponse(200, fixtures.property)
      })
      global.fetch = mockFetch

      const result = await client.listProperties()

      expect(callCount).toBe(2)
      expect(sleepCalls).toEqual([30000]) // Should cap at 30s even though Retry-After says 60s
      expect(result).toEqual(fixtures.property)
    })
  })

  describe('Error formatting', () => {
    test('should format 400 Bad Request error correctly', async () => {
      const errorDetail = { message: 'Invalid parameters', code: 'BAD_REQUEST' }
      global.fetch = createMockFetch([createMockResponse(400, errorDetail)])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 400: Bad Request',
        status: 400,
        path: '/v2/properties',
        detail: errorDetail,
      })
    })

    test('should format 401 Unauthorized error correctly', async () => {
      global.fetch = createMockFetch([createMockResponse(401, { message: 'Invalid API key' })])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 401: Unauthorized - Check your API key',
        status: 401,
        path: '/v2/properties',
      })
    })

    test('should format 404 Not Found error correctly', async () => {
      global.fetch = createMockFetch([createMockResponse(404, {})])

      await expect(client.getProperty('non-existent')).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 404: Not Found',
        status: 404,
        path: '/v2/properties/non-existent',
      })
    })

    test('should format 500 Internal Server Error correctly', async () => {
      global.fetch = createMockFetch([createMockResponse(500, { error: 'Server error' })])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/v2/properties',
      })
    })

    test('should handle network errors', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')))

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Network error: Network error',
        status: 0,
        path: '/v2/properties',
      })
    })

    test('should handle non-JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: mock(() => Promise.resolve('Plain text error')),
        json: mock(() => Promise.reject(new Error('Invalid JSON'))),
      } as unknown as Response

      global.fetch = mock(() => Promise.resolve(mockResponse))

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/v2/properties',
        detail: undefined,
      })
    })
  })

  describe('Request methods', () => {
    test('should make GET request with correct headers', async () => {
      const mockFetch = createMockFetch([createMockResponse(200, fixtures.property)])
      global.fetch = mockFetch

      await client.listProperties()

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

      await client.createBookingPaymentLink('booking-123', payload)

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

      await client.updateKeyCodes('booking-123', payload)

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

      await client.getProperty('prop/with/slashes')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/properties/prop%2Fwith%2Fslashes'),
        expect.anything(),
      )
    })
  })

  describe('Parameter validation', () => {
    test('should throw error for missing property ID', async () => {
      await expect(client.getProperty('')).rejects.toThrow('Property ID is required')
    })

    test('should throw error for missing booking ID', async () => {
      await expect(client.getBooking('')).rejects.toThrow('Booking ID is required')
    })

    test('should throw error for missing thread GUID', async () => {
      await expect(client.getThread('')).rejects.toThrow('Thread GUID is required')
    })

    test('should throw error for missing room type ID', async () => {
      await expect(client.getAvailabilityRoom('prop-123', '')).rejects.toThrow(
        'Room Type ID is required',
      )
    })

    test('should throw error for missing payload in POST request', async () => {
      await expect(client.createBookingPaymentLink('booking-123', null as any)).rejects.toThrow(
        'Payload is required',
      )
    })

    test('should throw error for missing parameters in rate methods', async () => {
      await expect(client.getDailyRates(null as any)).rejects.toThrow(
        'Parameters are required for daily rates',
      )
    })
  })

  describe('New Booking Management Methods', () => {
    test('should make POST request for createBooking', async () => {
      const mockResponse = { id: 'book-new', status: 'created' }
      global.fetch = createMockFetch([createMockResponse(201, mockResponse)])

      const payload = {
        propertyId: 'prop-123',
        from: '2025-12-01',
        to: '2025-12-07',
        guestBreakdown: { adults: 2 },
        roomTypes: [{ id: 'room-456' }],
      }

      const result = await client.createBooking(payload)
      expect(result).toEqual(mockResponse)
    })

    test('should make PUT request for updateBooking', async () => {
      const mockResponse = { id: 'book-123', status: 'updated' }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const payload = { status: 'confirmed', guestBreakdown: { adults: 3 } }
      const result = await client.updateBooking('book-123', payload)
      expect(result).toEqual(mockResponse)
    })

    test('should make DELETE request for deleteBooking', async () => {
      const mockResponse = { id: 'book-123', status: 'deleted' }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const result = await client.deleteBooking('book-123')
      expect(result).toEqual(mockResponse)
    })

    test('should throw error for missing booking payload', async () => {
      await expect(client.createBooking(null as any)).rejects.toThrow('Payload is required')
      await expect(client.updateBooking('book-123', null as any)).rejects.toThrow(
        'Payload is required',
      )
    })
  })

  describe('Property Availability Update Method', () => {
    test('should make PUT request for updatePropertyAvailability', async () => {
      const mockResponse = { success: true, message: 'Availability updated' }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const payload = {
        from: '2025-12-20',
        to: '2025-12-31',
        available: false,
        minStay: 3,
      }

      const result = await client.updatePropertyAvailability('prop-123', payload)
      expect(result).toEqual(mockResponse)
    })

    test('should throw error for missing availability payload', async () => {
      await expect(client.updatePropertyAvailability('prop-123', null as any)).rejects.toThrow(
        'Payload is required',
      )
    })
  })

  describe('Webhook Management Methods', () => {
    test('should make POST request for subscribeWebhook', async () => {
      const mockResponse = { id: 'webhook-123', status: 'subscribed' }
      global.fetch = createMockFetch([createMockResponse(201, mockResponse)])

      const payload = {
        event: 'booking.created',
        targetUrl: 'https://your-app.com/webhooks/lodgify',
      }

      const result = await client.subscribeWebhook(payload)
      expect(result).toEqual(mockResponse)
    })

    test('should make GET request for listWebhooks', async () => {
      const mockResponse = { webhooks: [{ id: 'webhook-123', event: 'booking.created' }] }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const result = await client.listWebhooks({ page: 1 })
      expect(result).toEqual(mockResponse)
    })

    test('should make DELETE request for deleteWebhook', async () => {
      const mockResponse = { id: 'webhook-123', status: 'deleted' }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const result = await client.deleteWebhook('webhook-123')
      expect(result).toEqual(mockResponse)
    })

    test('should throw error for missing webhook payload', async () => {
      await expect(client.subscribeWebhook(null as any)).rejects.toThrow('Payload is required')
    })
  })

  describe('Rate Management Methods', () => {
    test('should make POST request for createRate', async () => {
      const mockResponse = { id: 'rate-new', status: 'created' }
      global.fetch = createMockFetch([createMockResponse(201, mockResponse)])

      const payload = {
        propertyId: 'prop-123',
        roomTypeId: 'room-456',
        from: '2025-12-01',
        to: '2025-12-31',
        rate: 150.0,
        currency: 'USD',
      }

      const result = await client.createRate(payload)
      expect(result).toEqual(mockResponse)
    })

    test('should make PUT request for updateRate', async () => {
      const mockResponse = { id: 'rate-789', status: 'updated' }
      global.fetch = createMockFetch([createMockResponse(200, mockResponse)])

      const payload = { rate: 175.0, currency: 'EUR' }
      const result = await client.updateRate('rate-789', payload)
      expect(result).toEqual(mockResponse)
    })

    test('should throw error for missing rate payload', async () => {
      await expect(client.createRate(null as any)).rejects.toThrow('Payload is required')
      await expect(client.updateRate('rate-789', null as any)).rejects.toThrow(
        'Payload is required',
      )
    })
  })
})
