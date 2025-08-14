import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LodgifyClient } from '../src/lodgify.js'
import { createMockResponse, createMockFetch, fixtures, mockTimers } from './utils.js'

describe('LodgifyClient', () => {
  let client: LodgifyClient
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new LodgifyClient('test-api-key')
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new LodgifyClient('')).toThrow('Lodgify API key is required')
    })

    it('should initialize with valid API key', () => {
      expect(() => new LodgifyClient('valid-key')).not.toThrow()
    })
  })

  describe('429 retry handling', () => {
    it('should retry on 429 with exponential backoff', async () => {
      const timers = mockTimers.setup()
      const mockFetch = createMockFetch([
        createMockResponse(429, { error: 'Rate limited' }),
        createMockResponse(200, fixtures.property),
      ])
      global.fetch = mockFetch

      const promise = client.listProperties()
      
      // First attempt fails with 429
      await timers.advance(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Advance time for exponential backoff (2^0 = 1 second)
      await timers.advance(1000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      const result = await promise
      expect(result).toEqual(fixtures.property)
      
      timers.restore()
    })

    it('should respect Retry-After header', async () => {
      const timers = mockTimers.setup()
      const mockFetch = createMockFetch([
        createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '3' }),
        createMockResponse(200, fixtures.property),
      ])
      global.fetch = mockFetch

      const promise = client.listProperties()
      
      // First attempt fails with 429
      await timers.advance(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Should wait 3 seconds as specified by Retry-After header
      await timers.advance(3000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      const result = await promise
      expect(result).toEqual(fixtures.property)
      
      timers.restore()
    })

    it('should use exponential backoff when no Retry-After header', async () => {
      const timers = mockTimers.setup()
      const mockFetch = createMockFetch([
        createMockResponse(429, { error: 'Rate limited' }), // Attempt 1: wait 1s (2^0)
        createMockResponse(429, { error: 'Rate limited' }), // Attempt 2: wait 2s (2^1)
        createMockResponse(429, { error: 'Rate limited' }), // Attempt 3: wait 4s (2^2)
        createMockResponse(200, fixtures.property),
      ])
      global.fetch = mockFetch

      const promise = client.listProperties()
      
      // First attempt
      await timers.advance(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Second attempt after 1 second
      await timers.advance(1000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      // Third attempt after 2 more seconds
      await timers.advance(2000)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      
      // Fourth attempt after 4 more seconds
      await timers.advance(4000)
      expect(mockFetch).toHaveBeenCalledTimes(4)
      
      const result = await promise
      expect(result).toEqual(fixtures.property)
      
      timers.restore()
    })

    it('should fail after max retries', async () => {
      const timers = mockTimers.setup()
      const responses = Array(6).fill(null).map(() => 
        createMockResponse(429, { error: 'Rate limited' })
      )
      const mockFetch = createMockFetch(responses)
      global.fetch = mockFetch

      const promise = client.listProperties()
      
      // Advance through all retry attempts
      for (let i = 0; i < 5; i++) {
        await timers.advance(Math.min(2 ** i * 1000, 30000))
      }
      
      await expect(promise).rejects.toMatchObject({
        error: true,
        message: expect.stringContaining('Max retries (5) exceeded'),
        status: 429,
      })
      
      expect(mockFetch).toHaveBeenCalledTimes(5)
      timers.restore()
    })

    it('should cap retry delay at 30 seconds', async () => {
      const timers = mockTimers.setup()
      const mockFetch = createMockFetch([
        createMockResponse(429, { error: 'Rate limited' }, { 'Retry-After': '60' }),
        createMockResponse(200, fixtures.property),
      ])
      global.fetch = mockFetch

      const promise = client.listProperties()
      
      // First attempt fails with 429
      await timers.advance(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Should wait max 30 seconds even though Retry-After says 60
      await timers.advance(30000)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      const result = await promise
      expect(result).toEqual(fixtures.property)
      
      timers.restore()
    })
  })

  describe('Error formatting', () => {
    it('should format 400 Bad Request error correctly', async () => {
      const errorDetail = { message: 'Invalid parameters', code: 'BAD_REQUEST' }
      global.fetch = createMockFetch([
        createMockResponse(400, errorDetail),
      ])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 400: Bad Request',
        status: 400,
        path: '/v2/properties',
        detail: errorDetail,
      })
    })

    it('should format 401 Unauthorized error correctly', async () => {
      global.fetch = createMockFetch([
        createMockResponse(401, { message: 'Invalid API key' }),
      ])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 401: Unauthorized - Check your API key',
        status: 401,
        path: '/v2/properties',
      })
    })

    it('should format 404 Not Found error correctly', async () => {
      global.fetch = createMockFetch([
        createMockResponse(404, {}),
      ])

      await expect(client.getProperty('non-existent')).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 404: Not Found',
        status: 404,
        path: '/v2/properties/non-existent',
      })
    })

    it('should format 500 Internal Server Error correctly', async () => {
      global.fetch = createMockFetch([
        createMockResponse(500, { error: 'Server error' }),
      ])

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/v2/properties',
      })
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(client.listProperties()).rejects.toMatchObject({
        error: true,
        message: 'Network error: Network error',
        status: 0,
        path: '/v2/properties',
      })
    })

    it('should handle non-JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Plain text error'),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

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
    it('should make GET request with correct headers', async () => {
      const mockFetch = createMockFetch([
        createMockResponse(200, fixtures.property),
      ])
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
        })
      )
    })

    it('should make POST request with body', async () => {
      const payload = { amount: 100, currency: 'USD' }
      const mockFetch = createMockFetch([
        createMockResponse(201, { success: true }),
      ])
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
        })
      )
    })

    it('should make PUT request with body', async () => {
      const payload = { keyCodes: ['1234', '5678'] }
      const mockFetch = createMockFetch([
        createMockResponse(200, { success: true }),
      ])
      global.fetch = mockFetch

      await client.updateKeyCodes('booking-123', payload)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/reservations/bookings/booking-123/keyCodes'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      )
    })

    it('should encode URI components in path', async () => {
      const mockFetch = createMockFetch([
        createMockResponse(200, fixtures.property),
      ])
      global.fetch = mockFetch

      await client.getProperty('prop/with/slashes')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/properties/prop%2Fwith%2Fslashes'),
        expect.anything()
      )
    })
  })

  describe('Parameter validation', () => {
    it('should throw error for missing property ID', async () => {
      await expect(client.getProperty('')).rejects.toThrow('Property ID is required')
    })

    it('should throw error for missing booking ID', async () => {
      await expect(client.getBooking('')).rejects.toThrow('Booking ID is required')
    })

    it('should throw error for missing thread GUID', async () => {
      await expect(client.getThread('')).rejects.toThrow('Thread GUID is required')
    })

    it('should throw error for missing room type ID', async () => {
      await expect(client.getAvailabilityRoom('prop-123', '')).rejects.toThrow(
        'Room Type ID is required'
      )
    })

    it('should throw error for missing payload in POST request', async () => {
      await expect(client.createBookingPaymentLink('booking-123', null as any)).rejects.toThrow(
        'Payload is required'
      )
    })

    it('should throw error for missing parameters in rate methods', async () => {
      await expect(client.getDailyRates(null as any)).rejects.toThrow(
        'Parameters are required for daily rates'
      )
    })
  })
})