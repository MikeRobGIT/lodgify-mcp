import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { TestServer } from './test-server.js'
import { createTestServer } from './test-server.js'
import { fixtures } from './utils.js'

interface MockFunction {
  mockResolvedValue(value: unknown): void
  mockRejectedValue(error: Error): void
  mockClear(): void
}

interface MockClient {
  [key: string]: MockFunction | unknown
  // v1 Webhook endpoints
  listWebhooks: MockFunction
  subscribeWebhook: MockFunction
  unsubscribeWebhook: MockFunction
  // v1 Booking CRUD endpoints
  createBooking: MockFunction
  updateBooking: MockFunction
  deleteBooking: MockFunction
  // v1 Rate management
  updateRates: MockFunction
  // v2 endpoints for comparison
  listProperties: MockFunction
  getProperty: MockFunction
  listBookings: MockFunction
  getBooking: MockFunction
}

describe('Error Handling Tests', () => {
  let testServer: TestServer
  let mockClient: MockClient

  beforeEach(async () => {
    // Create a minimal mock client for error testing
    mockClient = {
      // v1 endpoints
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
      // v2 endpoints for comparison
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listBookings: mock(() => Promise.resolve()),
      getBooking: mock(() => Promise.resolve()),
    }

    testServer = createTestServer(mockClient)
  })

  afterEach(() => {
    Object.values(mockClient).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
        ;(mockFn as MockFunction).mockClear()
      }
    })
  })

  describe('Validation Errors', () => {
    test('should handle webhook subscription with mock client', async () => {
      mockClient.subscribeWebhook.mockResolvedValue(fixtures.webhook)

      const response = await testServer.callTool('lodgify_subscribe_webhook', {
        payload: {
          event: 'booking_new_status_booked',
          target_url: 'https://example.com/webhook',
        },
      })

      expect(mockClient.subscribeWebhook).toHaveBeenCalledWith({
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
      })
      expect(response.content[0].text).toContain('webhook_123')
    })

    test('should handle booking creation with mock client', async () => {
      mockClient.createBooking.mockResolvedValue(fixtures.createBookingResponse)

      const response = await testServer.callTool('lodgify_create_booking', {
        payload: fixtures.createBookingRequest,
      })

      expect(mockClient.createBooking).toHaveBeenCalledWith(fixtures.createBookingRequest)
      expect(response.content[0].text).toContain('booking_789')
    })

    test('should handle rate updates with mock client', async () => {
      mockClient.updateRates.mockResolvedValue({ success: true })

      const response = await testServer.callTool('lodgify_update_rates', {
        payload: fixtures.rateUpdateRequest,
      })

      expect(mockClient.updateRates).toHaveBeenCalledWith(fixtures.rateUpdateRequest)
      expect(response.content[0].text).toContain('success')
    })
  })

  describe('API Error Responses', () => {
    test('should handle 401 Unauthorized error', async () => {
      const authError = new Error('401 Unauthorized: Invalid API key')
      Object.assign(authError, { status: 401 })
      mockClient.listWebhooks.mockRejectedValue(authError)

      const response = await testServer.callTool('lodgify_list_webhooks', {})

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Invalid API key')
    })

    test('should handle 404 Not Found error', async () => {
      const notFoundError = new Error('404 Not Found: Booking not found')
      Object.assign(notFoundError, { status: 404 })
      mockClient.getBooking.mockRejectedValue(notFoundError)

      const response = await testServer.callTool('lodgify_get_booking', { id: 'nonexistent' })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Booking not found')
    })

    test('should handle 429 Rate Limit error', async () => {
      const rateLimitError = new Error('429 Too Many Requests')
      Object.assign(rateLimitError, { status: 429, retryAfter: 60 })
      mockClient.createBooking.mockRejectedValue(rateLimitError)

      const response = await testServer.callTool('lodgify_create_booking', {
        payload: {
          property_id: 123,
          arrival: '2024-06-15',
          departure: '2024-06-20',
          guest_name: 'John Smith',
          adults: 2,
        },
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Too Many Requests')
    })

    test('should handle 500 Internal Server Error', async () => {
      const serverError = new Error('500 Internal Server Error')
      Object.assign(serverError, { status: 500 })
      mockClient.updateRates.mockRejectedValue(serverError)

      const response = await testServer.callTool('lodgify_update_rates', {
        payload: {
          property_id: 123,
          rates: [
            {
              room_type_id: 456,
              date_from: '2024-06-01',
              date_to: '2024-08-31',
              price: 150.0,
            },
          ],
        },
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Internal Server Error')
    })

    test('should handle network connectivity error', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused')
      mockClient.subscribeWebhook.mockRejectedValue(networkError)

      const response = await testServer.callTool('lodgify_subscribe_webhook', {
        payload: {
          event: 'booking_new_status_booked',
          target_url: 'https://example.com/webhook',
        },
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Connection refused')
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty webhook list response', async () => {
      mockClient.listWebhooks.mockResolvedValue({ data: [], total: 0 })

      const response = await testServer.callTool('lodgify_list_webhooks', {})

      expect(response.content[0].text).toContain('[]')
      expect(response.content[0].text).toContain('total')
    })

    test('should handle booking update with no changes', async () => {
      const originalBooking = {
        id: 'booking_123',
        property_id: 123,
        arrival: '2024-06-15',
        departure: '2024-06-20',
        adults: 2,
      }
      mockClient.updateBooking.mockResolvedValue(originalBooking)

      const response = await testServer.callTool('lodgify_update_booking', {
        id: 123,
        // No update fields provided
      })

      expect(mockClient.updateBooking).toHaveBeenCalledWith('123', {})
      expect(response.content[0].text).toContain('booking_123')
    })

    test('should handle rate update successfully', async () => {
      mockClient.updateRates.mockResolvedValue({ success: true })

      const response = await testServer.callTool('lodgify_update_rates', {
        payload: {
          property_id: 123,
          rates: [
            {
              room_type_id: 456,
              date_from: '2024-06-01',
              date_to: '2024-08-31',
              price: 150.0,
              currency: 'USD',
            },
          ],
        },
      })

      expect(mockClient.updateRates).toHaveBeenCalled()
      expect(response.content[0].text).toContain('success')
    })

    test('should handle webhook subscription with minimal payload', async () => {
      const webhook = {
        id: 'webhook_minimal',
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
      }
      mockClient.subscribeWebhook.mockResolvedValue(webhook)

      const response = await testServer.callTool('lodgify_subscribe_webhook', {
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
      })

      expect(response.content[0].text).toContain('webhook_minimal')
    })
  })

  describe('Comparison with v2 Endpoints', () => {
    test('v1 create_booking should work with proper payload', async () => {
      // v1 create_booking with full payload
      mockClient.createBooking.mockResolvedValue(fixtures.createBookingResponse)

      const response1 = await testServer.callTool('lodgify_create_booking', {
        payload: fixtures.createBookingRequest,
      })
      expect(response1.content[0].text).toContain('booking_789')

      // v2 get_booking only needs ID
      mockClient.getBooking.mockResolvedValue({ id: 'booking_123' })
      const response2 = await testServer.callTool('lodgify_get_booking', { id: 'booking_123' })
      expect(response2.content[0].text).toContain('booking_123')
    })

    test('v1 endpoints should handle string/number type conversion', async () => {
      const updatedBooking = { id: 'booking_456', adults: 3 }
      mockClient.updateBooking.mockResolvedValue(updatedBooking)

      // Should handle number ID being converted to string
      const response = await testServer.callTool('lodgify_update_booking', {
        id: 456, // Number input
        payload: { adults: 3 },
      })

      expect(mockClient.updateBooking).toHaveBeenCalledWith('456', { adults: 3 })
      expect(response.content[0].text).toContain('booking_456')
    })
  })
})
