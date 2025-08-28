import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import pkg from '../package.json' with { type: 'json' }
import type { TestServer } from './test-server.js'
import { createTestServer } from './test-server.js'
import { fixtures } from './utils.js'

interface MockFunction extends Mock<() => Promise<unknown>> {
  mockResolvedValue(value: unknown): void
  mockRejectedValue(error: Error): void
}

interface MockClient {
  [key: string]: MockFunction | unknown
  listProperties: MockFunction
  getProperty: MockFunction
  listPropertyRooms: MockFunction
  listDeletedProperties: MockFunction
  getDailyRates: MockFunction
  getRateSettings: MockFunction
  listBookings: MockFunction
  getBooking: MockFunction
  getBookingPaymentLink: MockFunction
  createBookingPaymentLink: MockFunction
  updateKeyCodes: MockFunction
  getQuote: MockFunction
  getThread: MockFunction
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
  // Missing v2 endpoints
  availabilityAll: MockFunction
  checkinBooking: MockFunction
  checkoutBooking: MockFunction
  getExternalBookings: MockFunction
  // Helper methods
  getNextAvailableDate: MockFunction
  checkDateRangeAvailability: MockFunction
  getAvailabilityCalendar: MockFunction
  findProperties: MockFunction
}

describe('MCP Server Integration Tests', () => {
  let testServer: TestServer
  let mockClient: MockClient

  beforeEach(async () => {
    // Create a mock LodgifyClient
    mockClient = {
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listPropertyRooms: mock(() => Promise.resolve()),
      listDeletedProperties: mock(() => Promise.resolve()),
      getDailyRates: mock(() =>
        Promise.resolve({
          property_id: 123,
          currency: 'USD',
          rates: [
            {
              date: '2025-11-20',
              rate: 150.0,
              available: true,
            },
          ],
        }),
      ),
      getRateSettings: mock(() =>
        Promise.resolve({
          property_id: 123,
          currency: 'USD',
          default_rate: 120.0,
        }),
      ),
      listBookings: mock(() => Promise.resolve()),
      getBooking: mock(() => Promise.resolve()),
      getBookingPaymentLink: mock(() => Promise.resolve()),
      createBookingPaymentLink: mock(() => Promise.resolve()),
      updateKeyCodes: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
      // v1 Webhook endpoints
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      // v1 Booking CRUD endpoints
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      // v1 Rate management
      updateRates: mock(() => Promise.resolve()),
      // Missing v2 endpoints
      availabilityAll: mock(() => Promise.resolve()),
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
    }

    // Create test server with mock client
    testServer = createTestServer(mockClient)
  })

  afterEach(() => {
    // Clear all mocks
    Object.values(mockClient).forEach((mockFn) => {
      if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
        ;(mockFn as MockFunction).mockClear()
      }
    })
  })

  describe('Tool Registration', () => {
    test('should register all Lodgify tools', async () => {
      const response = await testServer.listTools()

      expect(response.tools).toHaveLength(28)

      const toolNames = response.tools.map((t: { name: string }) => t.name)
      expect(toolNames).toContain('lodgify_list_properties')
      expect(toolNames).toContain('lodgify_get_property')
      expect(toolNames).toContain('lodgify_list_property_rooms')
      expect(toolNames).toContain('lodgify_list_deleted_properties')
      expect(toolNames).toContain('lodgify_daily_rates')
      expect(toolNames).toContain('lodgify_rate_settings')
      expect(toolNames).toContain('lodgify_list_bookings')
      expect(toolNames).toContain('lodgify_get_booking')
      expect(toolNames).toContain('lodgify_get_booking_payment_link')
      expect(toolNames).toContain('lodgify_create_booking_payment_link')
      expect(toolNames).toContain('lodgify_update_key_codes')
      expect(toolNames).toContain('lodgify_get_quote')
      expect(toolNames).toContain('lodgify_get_thread')
      expect(toolNames).toContain('lodgify_find_properties')

      // v1 Webhook endpoints
      expect(toolNames).toContain('lodgify_list_webhooks')
      expect(toolNames).toContain('lodgify_subscribe_webhook')
      expect(toolNames).toContain('lodgify_unsubscribe_webhook')

      // v1 Booking CRUD endpoints
      expect(toolNames).toContain('lodgify_create_booking')
      expect(toolNames).toContain('lodgify_update_booking')
      expect(toolNames).toContain('lodgify_delete_booking')

      // v1 Rate management
      expect(toolNames).toContain('lodgify_update_rates')

      // Missing v2 endpoints
      expect(toolNames).toContain('lodgify_availability_all')
      expect(toolNames).toContain('lodgify_checkin_booking')
      expect(toolNames).toContain('lodgify_checkout_booking')
      expect(toolNames).toContain('lodgify_get_external_bookings')

      // Availability helper tools
      expect(toolNames).toContain('lodgify_check_next_availability')
      expect(toolNames).toContain('lodgify_check_date_range_availability')
      expect(toolNames).toContain('lodgify_get_availability_calendar')
    })

    test('should include proper descriptions for each tool', async () => {
      const response = await testServer.listTools()

      const propertyTool = response.tools.find(
        (t: { name: string; description: string; inputSchema: unknown }) =>
          t.name === 'lodgify_list_properties',
      )
      expect(propertyTool).toBeDefined()
      expect(propertyTool.description).toContain('List all properties')
      expect(propertyTool.inputSchema).toBeDefined()
    })
  })

  describe('Property Management Tools', () => {
    test('should handle list_properties tool', async () => {
      mockClient.listProperties.mockResolvedValue([fixtures.property])

      const response = await testServer.callTool('lodgify_list_properties', {
        params: { page: 1, limit: 10 },
      })

      expect(mockClient.listProperties).toHaveBeenCalledWith({ page: 1, limit: 10 })
      expect(response.content[0].text).toContain(fixtures.property.id)
    })

    test('should handle get_property tool', async () => {
      mockClient.getProperty.mockResolvedValue(fixtures.property)

      const response = await testServer.callTool('lodgify_get_property', {
        id: 'prop-123',
      })

      expect(mockClient.getProperty).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain(fixtures.property.name)
    })

    test('should handle list_property_rooms tool', async () => {
      const rooms = [{ id: 'room-1', name: 'Master Suite' }]
      mockClient.listPropertyRooms.mockResolvedValue(rooms)

      const response = await testServer.callTool('lodgify_list_property_rooms', {
        propertyId: 'prop-123',
      })

      expect(mockClient.listPropertyRooms).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain('Master Suite')
    })
  })

  describe('Booking Management Tools', () => {
    test('should handle list_bookings tool', async () => {
      mockClient.listBookings.mockResolvedValue([fixtures.booking])

      const response = await testServer.callTool('lodgify_list_bookings', {
        params: { from: '2025-11-01', to: '2025-11-30' },
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith({ from: '2025-11-01', to: '2025-11-30' })
      expect(response.content[0].text).toContain(fixtures.booking.id)
    })

    test('should handle get_booking tool', async () => {
      mockClient.getBooking.mockResolvedValue(fixtures.booking)

      const response = await testServer.callTool('lodgify_get_booking', {
        id: 'book-456',
      })

      expect(mockClient.getBooking).toHaveBeenCalledWith('book-456')
      expect(response.content[0].text).toContain(fixtures.booking.guest.name)
    })

    test('should handle create_booking_payment_link tool', async () => {
      const paymentLink = { url: 'https://pay.lodgify.com/xyz', amount: 1000 }
      mockClient.createBookingPaymentLink.mockResolvedValue(paymentLink)

      const response = await testServer.callTool('lodgify_create_booking_payment_link', {
        id: 'book-456',
        payload: { amount: 1000, currency: 'USD' },
      })

      expect(mockClient.createBookingPaymentLink).toHaveBeenCalledWith('book-456', {
        amount: 1000,
        currency: 'USD',
      })
      expect(response.content[0].text).toContain('https://pay.lodgify.com/xyz')
    })
  })

  describe('Quote & Messaging Tools', () => {
    test('should handle get_quote tool with complex parameters', async () => {
      mockClient.getQuote.mockResolvedValue(fixtures.quote)

      const response = await testServer.callTool('lodgify_get_quote', {
        propertyId: 'prop-123',
        params: {
          from: '2025-11-20',
          to: '2025-11-25',
          'roomTypes[0].Id': 999,
          'guest_breakdown[adults]': 2,
        },
      })

      expect(mockClient.getQuote).toHaveBeenCalledWith('prop-123', {
        from: '2025-11-20',
        to: '2025-11-25',
        'roomTypes[0].Id': 999,
        'guest_breakdown[adults]': 2,
      })
      expect(response.content[0].text).toContain('1000')
    })

    test('should handle get_thread tool', async () => {
      mockClient.getThread.mockResolvedValue(fixtures.thread)

      const response = await testServer.callTool('lodgify_get_thread', {
        threadGuid: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.getThread).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(response.content[0].text).toContain('Is the property available?')
    })
  })

  describe('Property Discovery Tools', () => {
    test('should handle lodgify_find_properties tool', async () => {
      // Mock the findProperties response
      mockClient.listProperties.mockResolvedValue({
        items: [
          { id: 435705, name: 'Villa Sunrise', type: 'Apartment' },
          { id: 435706, name: 'Beach House', type: 'House' },
        ],
      })

      mockClient.listBookings.mockResolvedValue({
        items: [
          { property_id: 435707, status: 'Booked' },
          { property_id: 435708, status: 'Confirmed' },
        ],
      })

      const response = await testServer.callTool('lodgify_find_properties', {
        limit: 5,
      })

      expect(response.content[0].text).toContain('Found')
      const result = JSON.parse(response.content[0].text)
      expect(result).toHaveProperty('properties')
      expect(result).toHaveProperty('message')
      expect(result).toHaveProperty('suggestions')
      expect(Array.isArray(result.properties)).toBe(true)
      expect(Array.isArray(result.suggestions)).toBe(true)
      expect(result.properties.length).toBeGreaterThan(0)
    })
  })

  describe('Resource Handlers', () => {
    test('should list health resource', async () => {
      const response = await testServer.listResources()

      expect(response.resources).toHaveLength(1)
      expect(response.resources[0]).toMatchObject({
        uri: 'lodgify://health',
        name: 'Health Check',
        description: expect.stringContaining('health status'),
        mimeType: 'application/json',
      })
    })

    test('should read health resource', async () => {
      const response = await testServer.readResource('lodgify://health')

      expect(response.contents).toHaveLength(1)
      const healthData = JSON.parse(response.contents[0].text)
      expect(healthData).toMatchObject({
        ok: true,
        baseUrl: 'https://api.lodgify.com',
        version: pkg.version,
        apiKeyConfigured: true,
        timestamp: expect.any(String),
      })
    })

    test('should return error for unknown resource', async () => {
      await expect(testServer.readResource('lodgify://unknown')).rejects.toThrow('Unknown resource')
    })
  })

  describe('Webhook Management Tools (v1)', () => {
    test('should handle list_webhooks tool', async () => {
      const webhooks = {
        data: [
          {
            id: 'webhook_123',
            event: 'booking_new_status_booked',
            target_url: 'https://example.com/webhook',
            status: 'active',
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
        total: 1,
      }
      mockClient.listWebhooks.mockResolvedValue(webhooks)

      const response = await testServer.callTool('lodgify_list_webhooks', {})

      expect(mockClient.listWebhooks).toHaveBeenCalled()
      expect(response.content[0].text).toContain('webhook_123')
      expect(response.content[0].text).toContain('booking_new_status_booked')
    })

    test('should handle subscribe_webhook tool', async () => {
      const webhook = {
        id: 'webhook_456',
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
      }
      mockClient.subscribeWebhook.mockResolvedValue(webhook)

      const response = await testServer.callTool('lodgify_subscribe_webhook', {
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
      })

      expect(mockClient.subscribeWebhook).toHaveBeenCalledWith({
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
      })
      expect(response.content[0].text).toContain('webhook_456')
    })

    test('should handle unsubscribe_webhook tool', async () => {
      mockClient.unsubscribeWebhook.mockResolvedValue({
        message: 'Successfully unsubscribed from webhook: webhook_123',
      })

      const response = await testServer.callTool('lodgify_unsubscribe_webhook', {
        id: 'webhook_123',
      })

      expect(mockClient.unsubscribeWebhook).toHaveBeenCalledWith({ id: 'webhook_123' })
      expect(response.content[0].text).toContain(
        'Successfully unsubscribed from webhook: webhook_123',
      )
    })
  })

  describe('Booking CRUD Tools (v1)', () => {
    test('should handle create_booking tool', async () => {
      const newBooking = {
        id: 'booking_789',
        property_id: 123,
        arrival: '2024-06-15',
        departure: '2024-06-20',
        guest_name: 'John Smith',
        adults: 2,
        status: 'booked',
      }
      mockClient.createBooking.mockResolvedValue(newBooking)

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        arrival: '2024-06-15',
        departure: '2024-06-20',
        guest_name: 'John Smith',
        adults: 2,
        status: 'booked',
      })

      expect(mockClient.createBooking).toHaveBeenCalledWith({
        property_id: 123,
        arrival: '2024-06-15',
        departure: '2024-06-20',
        guest_name: 'John Smith',
        adults: 2,
        status: 'booked',
      })
      expect(response.content[0].text).toContain('booking_789')
      expect(response.content[0].text).toContain('John Smith')
    })

    test('should handle update_booking tool', async () => {
      const updatedBooking = {
        id: 'booking_789',
        property_id: 123,
        arrival: '2024-06-16',
        departure: '2024-06-21',
        guest_name: 'John Smith',
        adults: 3,
        status: 'booked',
      }
      mockClient.updateBooking.mockResolvedValue(updatedBooking)

      const response = await testServer.callTool('lodgify_update_booking', {
        id: 789,
        arrival: '2024-06-16',
        departure: '2024-06-21',
        adults: 3,
      })

      expect(mockClient.updateBooking).toHaveBeenCalledWith('789', {
        arrival: '2024-06-16',
        departure: '2024-06-21',
        adults: 3,
      })
      expect(response.content[0].text).toContain('booking_789')
      expect(response.content[0].text).toContain('2024-06-16')
    })

    test('should handle delete_booking tool', async () => {
      mockClient.deleteBooking.mockResolvedValue({ message: 'Successfully deleted booking: 789' })

      const response = await testServer.callTool('lodgify_delete_booking', {
        id: 789,
      })

      expect(mockClient.deleteBooking).toHaveBeenCalledWith('789')
      expect(response.content[0].text).toContain('Successfully deleted booking: 789')
    })
  })

  describe('Rate Management Tools (v1)', () => {
    test('should handle update_rates tool', async () => {
      mockClient.updateRates.mockResolvedValue({ message: 'Successfully updated rates' })

      const response = await testServer.callTool('lodgify_update_rates', {
        property_id: 123,
        rates: [
          {
            room_type_id: 456,
            date_from: '2024-06-01',
            date_to: '2024-08-31',
            price: 150.0,
            min_stay: 3,
            currency: 'USD',
          },
        ],
      })

      expect(mockClient.updateRates).toHaveBeenCalledWith({
        property_id: 123,
        rates: [
          {
            room_type_id: 456,
            date_from: '2024-06-01',
            date_to: '2024-08-31',
            price: 150.0,
            min_stay: 3,
            currency: 'USD',
          },
        ],
      })
      expect(response.content[0].text).toContain('Successfully updated rates')
    })
  })

  describe('Missing v2 Endpoint Tools', () => {
    test('should handle availability_all tool', async () => {
      const availability = {
        data: [
          {
            property_id: 123,
            date: '2024-06-15',
            available: true,
          },
        ],
      }
      mockClient.availabilityAll.mockResolvedValue(availability)

      const response = await testServer.callTool('lodgify_availability_all', {
        from: '2024-06-01',
        to: '2024-06-30',
      })

      expect(mockClient.availabilityAll).toHaveBeenCalledWith({
        from: '2024-06-01',
        to: '2024-06-30',
      })
      expect(response.content[0].text).toContain('property_id')
    })

    test('should handle checkin_booking tool', async () => {
      const checkedInBooking = {
        id: 'booking_123',
        status: 'checked_in',
        checkin_date: '2024-06-15T15:00:00Z',
      }
      mockClient.checkinBooking.mockResolvedValue(checkedInBooking)

      const response = await testServer.callTool('lodgify_checkin_booking', {
        id: 123,
      })

      expect(mockClient.checkinBooking).toHaveBeenCalledWith('123')
      expect(response.content[0].text).toContain('booking_123')
      expect(response.content[0].text).toContain('checked_in')
    })

    test('should handle checkout_booking tool', async () => {
      const checkedOutBooking = {
        id: 'booking_123',
        status: 'checked_out',
        checkout_date: '2024-06-20T11:00:00Z',
      }
      mockClient.checkoutBooking.mockResolvedValue(checkedOutBooking)

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
      })

      expect(mockClient.checkoutBooking).toHaveBeenCalledWith('123')
      expect(response.content[0].text).toContain('booking_123')
      expect(response.content[0].text).toContain('checked_out')
    })

    test('should handle get_external_bookings tool', async () => {
      const externalBookings = {
        data: [
          {
            id: 'ext_booking_456',
            source: 'Booking.com',
            property_id: 123,
            arrival: '2024-06-15',
            departure: '2024-06-20',
          },
        ],
      }
      mockClient.getExternalBookings.mockResolvedValue(externalBookings)

      const response = await testServer.callTool('lodgify_get_external_bookings', {
        id: '123',
      })

      expect(mockClient.getExternalBookings).toHaveBeenCalledWith('123')
      expect(response.content[0].text).toContain('ext_booking_456')
      expect(response.content[0].text).toContain('Booking.com')
    })
  })
})
