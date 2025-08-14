import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer } from './test-server.js'
import { fixtures } from './utils.js'

describe('MCP Server Integration Tests', () => {
  let testServer: any
  let mockClient: any

  beforeEach(async () => {
    // Create a mock LodgifyClient
    mockClient = {
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listPropertyRooms: mock(() => Promise.resolve()),
      listDeletedProperties: mock(() => Promise.resolve()),
      getDailyRates: mock(() => Promise.resolve()),
      getRateSettings: mock(() => Promise.resolve()),
      listBookings: mock(() => Promise.resolve()),
      getBooking: mock(() => Promise.resolve()),
      getBookingPaymentLink: mock(() => Promise.resolve()),
      createBookingPaymentLink: mock(() => Promise.resolve()),
      updateKeyCodes: mock(() => Promise.resolve()),
      getAvailabilityRoom: mock(() => Promise.resolve()),
      getAvailabilityProperty: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
    }

    // Create test server with mock client
    testServer = createTestServer(mockClient)
  })

  afterEach(() => {
    // Clear all mocks
    Object.values(mockClient).forEach(mockFn => {
      if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
        (mockFn as any).mockClear()
      }
    })
  })

  describe('Tool Registration', () => {
    test('should register all Lodgify tools', async () => {
      const response = await testServer.listTools()

      expect(response.tools).toHaveLength(15)

      const toolNames = response.tools.map((t: any) => t.name)
      expect(toolNames).toContain('lodgify.list_properties')
      expect(toolNames).toContain('lodgify.get_property')
      expect(toolNames).toContain('lodgify.list_property_rooms')
      expect(toolNames).toContain('lodgify.list_deleted_properties')
      expect(toolNames).toContain('lodgify.daily_rates')
      expect(toolNames).toContain('lodgify.rate_settings')
      expect(toolNames).toContain('lodgify.list_bookings')
      expect(toolNames).toContain('lodgify.get_booking')
      expect(toolNames).toContain('lodgify.get_booking_payment_link')
      expect(toolNames).toContain('lodgify.create_booking_payment_link')
      expect(toolNames).toContain('lodgify.update_key_codes')
      expect(toolNames).toContain('lodgify.availability_room')
      expect(toolNames).toContain('lodgify.availability_property')
      expect(toolNames).toContain('lodgify.get_quote')
      expect(toolNames).toContain('lodgify.get_thread')
    })

    test('should include proper descriptions for each tool', async () => {
      const response = await testServer.listTools()

      const propertyTool = response.tools.find((t: any) => t.name === 'lodgify.list_properties')
      expect(propertyTool).toBeDefined()
      expect(propertyTool.description).toContain('GET /v2/properties')
      expect(propertyTool.inputSchema).toBeDefined()
    })
  })

  describe('Property Management Tools', () => {
    test('should handle list_properties tool', async () => {
      mockClient.listProperties.mockResolvedValue([fixtures.property])

      const response = await testServer.callTool('lodgify.list_properties', {
        params: { page: 1, limit: 10 },
      })

      expect(mockClient.listProperties).toHaveBeenCalledWith({ page: 1, limit: 10 })
      expect(response.content[0].text).toContain(fixtures.property.id)
    })

    test('should handle get_property tool', async () => {
      mockClient.getProperty.mockResolvedValue(fixtures.property)

      const response = await testServer.callTool('lodgify.get_property', {
        id: 'prop-123',
      })

      expect(mockClient.getProperty).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain(fixtures.property.name)
    })

    test('should handle list_property_rooms tool', async () => {
      const rooms = [{ id: 'room-1', name: 'Master Suite' }]
      mockClient.listPropertyRooms.mockResolvedValue(rooms)

      const response = await testServer.callTool('lodgify.list_property_rooms', {
        propertyId: 'prop-123',
      })

      expect(mockClient.listPropertyRooms).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain('Master Suite')
    })
  })

  describe('Booking Management Tools', () => {
    test('should handle list_bookings tool', async () => {
      mockClient.listBookings.mockResolvedValue([fixtures.booking])

      const response = await testServer.callTool('lodgify.list_bookings', {
        params: { from: '2025-11-01', to: '2025-11-30' },
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith({ from: '2025-11-01', to: '2025-11-30' })
      expect(response.content[0].text).toContain(fixtures.booking.id)
    })

    test('should handle get_booking tool', async () => {
      mockClient.getBooking.mockResolvedValue(fixtures.booking)

      const response = await testServer.callTool('lodgify.get_booking', {
        id: 'book-456',
      })

      expect(mockClient.getBooking).toHaveBeenCalledWith('book-456')
      expect(response.content[0].text).toContain(fixtures.booking.guest.name)
    })

    test('should handle create_booking_payment_link tool', async () => {
      const paymentLink = { url: 'https://pay.lodgify.com/xyz', amount: 1000 }
      mockClient.createBookingPaymentLink.mockResolvedValue(paymentLink)

      const response = await testServer.callTool('lodgify.create_booking_payment_link', {
        id: 'book-456',
        payload: { amount: 1000, currency: 'USD' },
      })

      expect(mockClient.createBookingPaymentLink).toHaveBeenCalledWith(
        'book-456',
        { amount: 1000, currency: 'USD' }
      )
      expect(response.content[0].text).toContain('https://pay.lodgify.com/xyz')
    })
  })

  describe('Availability Tools', () => {
    test('should handle availability_room tool', async () => {
      mockClient.getAvailabilityRoom.mockResolvedValue(fixtures.availability)

      const response = await testServer.callTool('lodgify.availability_room', {
        propertyId: 'prop-123',
        roomTypeId: 'room-456',
        params: { from: '2025-11-20', to: '2025-11-25' },
      })

      expect(mockClient.getAvailabilityRoom).toHaveBeenCalledWith(
        'prop-123',
        'room-456',
        { from: '2025-11-20', to: '2025-11-25' }
      )
      expect(response.content[0].text).toContain('available')
    })

    test('should handle availability_property tool', async () => {
      mockClient.getAvailabilityProperty.mockResolvedValue(fixtures.availability)

      const response = await testServer.callTool('lodgify.availability_property', {
        propertyId: 'prop-123',
        params: { from: '2025-11-20', to: '2025-11-25' },
      })

      expect(mockClient.getAvailabilityProperty).toHaveBeenCalledWith(
        'prop-123',
        { from: '2025-11-20', to: '2025-11-25' }
      )
      expect(response.content[0].text).toContain('available')
    })
  })

  describe('Quote & Messaging Tools', () => {
    test('should handle get_quote tool with complex parameters', async () => {
      mockClient.getQuote.mockResolvedValue(fixtures.quote)

      const response = await testServer.callTool('lodgify.get_quote', {
        propertyId: 'prop-123',
        params: {
          from: '2025-11-20',
          to: '2025-11-25',
          'roomTypes[0].Id': 999,
          'guest_breakdown[adults]': 2,
        },
      })

      expect(mockClient.getQuote).toHaveBeenCalledWith(
        'prop-123',
        {
          from: '2025-11-20',
          to: '2025-11-25',
          'roomTypes[0].Id': 999,
          'guest_breakdown[adults]': 2,
        }
      )
      expect(response.content[0].text).toContain('1000')
    })

    test('should handle get_thread tool', async () => {
      mockClient.getThread.mockResolvedValue(fixtures.thread)

      const response = await testServer.callTool('lodgify.get_thread', {
        threadGuid: '550e8400-e29b-41d4-a716-446655440000',
      })

      expect(mockClient.getThread).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(response.content[0].text).toContain('Is the property available?')
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
        version: '0.1.0',
        apiKeyConfigured: true,
        timestamp: expect.any(String),
      })
    })

    test('should return error for unknown resource', async () => {
      await expect(testServer.readResource('lodgify://unknown')).rejects.toThrow('Unknown resource')
    })
  })
})