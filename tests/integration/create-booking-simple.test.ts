/**
 * Simple Booking Creation Tool Tests - Critical User-Facing Feature
 *
 * Tests the lodgify_create_booking MCP tool which property managers depend on daily to:
 * - Create new guest reservations
 * - Import bookings from external systems
 * - Process direct booking requests
 * - Set up property occupancy
 *
 * This is THE most fundamental operation in property management - without booking
 * creation, the entire system cannot function.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer } from '../test-server.js'

describe('Booking Creation Simple Integration Tests', () => {
  let testServer: any
  let mockClient: any

  beforeEach(() => {
    // Create a mock client with all required methods
    mockClient = {
      // Primary method we're testing
      createBookingV1: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),

      // Other required methods for test server
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
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
    }

    // Create test server with the mock client
    testServer = createTestServer(mockClient)
  })

  describe('lodgify_create_booking', () => {
    test('should successfully create a booking with minimal fields', async () => {
      // Mock successful booking creation
      mockClient.createBooking.mockResolvedValue({
        id: 12345,
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-07-15',
        departure: '2025-07-20',
        guest_name: 'John Smith',
        adults: 2,
        status: 'booked',
        currency: 'USD',
        amount: 500.0,
        message: 'Booking created successfully',
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-07-15',
        departure: '2025-07-20',
        guest_name: 'John Smith',
        adults: 2,
      })

      expect(mockClient.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 684855,
          room_type_id: 751902,
          arrival: '2025-07-15',
          departure: '2025-07-20',
          guest_name: 'John Smith',
          adults: 2,
        }),
      )

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.id).toBe(12345)
      expect(result.guest_name).toBe('John Smith')
      expect(result.status).toBe('booked')
      expect(result.message).toContain('successfully')
    })

    test('should handle all optional fields when creating a booking', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 67890,
        property_id: 123456,
        room_type_id: 789012,
        arrival: '2025-08-01',
        departure: '2025-08-10',
        guest_name: 'Jane Doe',
        guest_email: 'jane@example.com',
        guest_phone: '+1-555-0123',
        adults: 2,
        children: 1,
        infants: 1,
        status: 'tentative',
        source: 'Airbnb',
        notes: 'Late arrival expected',
        currency: 'EUR',
        amount: 1500.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123456,
        room_type_id: 789012,
        arrival: '2025-08-01',
        departure: '2025-08-10',
        guest_name: 'Jane Doe',
        guest_email: 'jane@example.com',
        guest_phone: '+1-555-0123',
        adults: 2,
        children: 1,
        infants: 1,
        status: 'tentative',
        source: 'Airbnb',
        notes: 'Late arrival expected',
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.id).toBe(67890)
      expect(result.guest_email).toBe('jane@example.com')
      expect(result.status).toBe('tentative')
      expect(result.children).toBe(1)
      expect(result.infants).toBe(1)
    })

    test('should handle API errors gracefully', async () => {
      mockClient.createBooking.mockRejectedValue(
        new Error('Property not available for selected dates'),
      )

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Test Guest',
        adults: 2,
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Property not available')
    })

    test('should handle network timeouts', async () => {
      mockClient.createBooking.mockRejectedValue(new Error('Network timeout'))

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Test Guest',
        adults: 2,
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('timeout')
    })

    test('should handle group bookings with children', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 33333,
        property_id: 999,
        room_type_id: 888,
        arrival: '2025-12-20',
        departure: '2025-12-27',
        guest_name: 'Family Robinson',
        adults: 2,
        children: 3,
        infants: 1,
        status: 'booked',
        currency: 'USD',
        amount: 3500.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 999,
        room_type_id: 888,
        arrival: '2025-12-20',
        departure: '2025-12-27',
        guest_name: 'Family Robinson',
        adults: 2,
        children: 3,
        infants: 1,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.id).toBe(33333)
      expect(result.adults).toBe(2)
      expect(result.children).toBe(3)
      expect(result.infants).toBe(1)
      expect(result.amount).toBe(3500.0)
    })

    test('should handle special characters in guest names', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 44444,
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: "O'Brien-Smith & Family",
        adults: 2,
        status: 'booked',
        currency: 'USD',
        amount: 500.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: "O'Brien-Smith & Family",
        adults: 2,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.guest_name).toBe("O'Brien-Smith & Family")
    })

    test('should create tentative bookings', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 55555,
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Tentative Guest',
        adults: 2,
        status: 'tentative',
        currency: 'USD',
        amount: 500.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Tentative Guest',
        adults: 2,
        status: 'tentative',
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('tentative')
    })

    test('should handle last-minute bookings', async () => {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      mockClient.createBooking.mockResolvedValue({
        id: 66666,
        property_id: 777,
        room_type_id: 666,
        arrival: today,
        departure: tomorrow,
        guest_name: 'Rush Guest',
        adults: 2,
        status: 'booked',
        currency: 'USD',
        amount: 200.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 777,
        room_type_id: 666,
        arrival: today,
        departure: tomorrow,
        guest_name: 'Rush Guest',
        adults: 2,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.id).toBe(66666)
      expect(result.arrival).toBe(today)
    })

    test('should handle extended stay bookings', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 77777,
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-08-31', // 3-month stay
        guest_name: 'Long Term Guest',
        adults: 1,
        status: 'booked',
        currency: 'USD',
        amount: 9000.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-08-31',
        guest_name: 'Long Term Guest',
        adults: 1,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.id).toBe(77777)
      expect(result.amount).toBe(9000.0)
    })

    test('should handle booking with source information', async () => {
      mockClient.createBooking.mockResolvedValue({
        id: 88888,
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Direct Guest',
        adults: 2,
        status: 'booked',
        source: 'Direct Website',
        currency: 'USD',
        amount: 500.0,
      })

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Direct Guest',
        adults: 2,
        source: 'Direct Website',
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.source).toBe('Direct Website')
    })

    test('should handle rate limiting errors', async () => {
      mockClient.createBooking.mockRejectedValue(new Error('429 Too Many Requests'))

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Test Guest',
        adults: 2,
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('429')
    })

    test('should handle empty response from API', async () => {
      mockClient.createBooking.mockResolvedValue({})

      const response = await testServer.callTool('lodgify_create_booking', {
        property_id: 123,
        room_type_id: 456,
        arrival: '2025-06-01',
        departure: '2025-06-07',
        guest_name: 'Test Guest',
        adults: 2,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result).toEqual({})
    })
  })

  describe('Tool registration', () => {
    test('should have create_booking tool registered', async () => {
      const response = await testServer.listTools()
      const toolNames = response.tools.map((t: { name: string }) => t.name)

      expect(toolNames).toContain('lodgify_create_booking')

      const createBookingTool = response.tools.find(
        (t: { name: string }) => t.name === 'lodgify_create_booking',
      )
      expect(createBookingTool).toBeDefined()
      expect(createBookingTool.description).toContain('Create booking')
    })
  })
})
