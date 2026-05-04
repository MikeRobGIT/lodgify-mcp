/**
 * Integration tests for lodgify_list_bookings MCP tool
 * Tests the critical user-facing functionality for viewing and managing bookings
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer, type TestServer } from '../test-server.js'

describe('lodgify_list_bookings - Critical User-Facing Feature Tests', () => {
  let testServer: TestServer
  let mockClient: Record<string, unknown>

  beforeEach(() => {
    // Create a mock client with the listBookings method and other required methods
    mockClient = {
      // Primary method we're testing
      listBookings: mock(() => Promise.resolve()),

      // V2 Bookings API
      bookings: {
        listBookings: mock(() => Promise.resolve()),
        getBooking: mock(() => Promise.resolve()),
        getExternalBookings: mock(() => Promise.resolve()),
      },

      // Other required methods for test server
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listPropertyRooms: mock(() => Promise.resolve()),
      listDeletedProperties: mock(() => Promise.resolve()),
      getDailyRates: mock(() => Promise.resolve()),
      getRateSettings: mock(() => Promise.resolve()),
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
      createBookingV1: mock(() => Promise.resolve()),
      updateBookingV1: mock(() => Promise.resolve()),
      deleteBookingV1: mock(() => Promise.resolve()),
    }

    // Create test server with the mock client
    testServer = createTestServer(mockClient)
  })

  describe('Daily Operations - Finding and Managing Bookings', () => {
    test('should list upcoming bookings for property managers to prepare for arrivals', async () => {
      // Property managers need to see future bookings to prepare properties
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK001',
            status: 'confirmed',
            propertyId: 123,
            propertyName: 'Ocean View Villa',
            checkIn: '2024-03-15',
            checkOut: '2024-03-22',
            guests: { adults: 2, children: 0 },
            guest: {
              name: 'John Smith',
              email: 'john@example.com',
              phone: '+1234567890',
            },
            totalAmount: 1750.0,
            currency: 'USD',
            paymentStatus: 'paid',
          },
          {
            id: 'BK002',
            status: 'tentative',
            propertyId: 124,
            propertyName: 'Mountain Lodge',
            checkIn: '2024-03-20',
            checkOut: '2024-03-25',
            guests: { adults: 4, children: 2 },
            guest: {
              name: 'Jane Doe',
              email: 'jane@example.com',
            },
            totalAmount: 2500.0,
            currency: 'USD',
            paymentStatus: 'pending',
          },
        ],
        pagination: {
          total: 45,
          limit: 10,
          offset: 0,
          hasNext: true,
        },
      })

      const params = {
        page: 1,
        size: 10,
        stayFilter: 'Upcoming',
        includeCount: true,
      }

      const response = await testServer.callTool('lodgify_list_bookings', params)

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
          stayFilter: 'Upcoming',
          includeCount: true,
        }),
      )

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(2)
      expect(result.data[0].id).toBe('BK001')
      expect(result.data[1].status).toBe('tentative')
      expect(result.pagination.total).toBe(45)
      expect(result.pagination.limit).toBe(10)
    })

    test('should find currently checked-in guests for property managers', async () => {
      // Essential for knowing who is currently in properties
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK003',
            status: 'checked_in',
            propertyId: 125,
            propertyName: 'Beach Cottage',
            checkIn: '2024-03-10',
            checkOut: '2024-03-17',
            guests: { adults: 2, children: 1 },
            guest: {
              name: 'Current Guest',
              email: 'current@example.com',
            },
            totalAmount: 1200.0,
            currency: 'USD',
          },
        ],
        pagination: {
          limit: 20,
          offset: 0,
        },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Current',
        size: 20,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          stayFilter: 'Current',
          limit: 20,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data).toBeInstanceOf(Array)
      expect(result.data[0].guest.name).toBe('Current Guest')
    })

    test('should retrieve bookings arriving on a specific date', async () => {
      // Critical for daily check-in preparations
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK004',
            checkIn: '2024-03-15',
            checkOut: '2024-03-18',
            propertyId: 126,
            guest: { name: 'Arriving Guest' },
          },
        ],
        pagination: { limit: 5, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'ArrivalDate',
        stayFilterDate: '2024-03-15T00:00:00Z',
        size: 5,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          stayFilter: 'ArrivalDate',
          stayFilterDate: '2024-03-15T00:00:00Z',
          limit: 5,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].checkIn).toBe('2024-03-15')
    })

    test('should find bookings departing on a specific date', async () => {
      // Essential for coordinating checkouts and cleaning schedules
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK005',
            checkIn: '2024-03-19',
            checkOut: '2024-03-22',
            propertyId: 127,
            guest: { name: 'Departing Guest' },
          },
        ],
        pagination: { limit: 10, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'DepartureDate',
        stayFilterDate: '2024-03-22T00:00:00Z',
        size: 10,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          stayFilter: 'DepartureDate',
          stayFilterDate: '2024-03-22T00:00:00Z',
          limit: 10,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].checkOut).toBe('2024-03-22')
    })

    test('should retrieve historic bookings for reporting', async () => {
      // Used for financial reporting and performance analysis
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK006',
            status: 'completed',
            checkIn: '2024-02-15',
            checkOut: '2024-02-20',
            totalAmount: 1500.0,
            paymentStatus: 'paid',
          },
          {
            id: 'BK007',
            status: 'completed',
            checkIn: '2024-02-10',
            checkOut: '2024-02-14',
            totalAmount: 1000.0,
            paymentStatus: 'paid',
          },
        ],
        pagination: { total: 150, limit: 25, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Historic',
        size: 25,
        includeCount: true,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(2)
      expect(result.pagination.total).toBe(150)
    })
  })

  describe('Advanced Filtering and Business Operations', () => {
    test('should filter bookings updated since a specific date', async () => {
      // Critical for keeping external systems synchronized
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK008',
            updatedAt: '2024-03-02T10:00:00Z',
            status: 'modified',
          },
        ],
        pagination: { limit: 15, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Upcoming',
        updatedSince: '2024-03-01T00:00:00Z',
        size: 15,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedSince: '2024-03-01T00:00:00Z',
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].id).toBe('BK008')
    })

    test('should include transaction details when requested', async () => {
      // Essential for financial management and payment tracking
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK009',
            totalAmount: 2000.0,
            transactions: [
              { type: 'payment', amount: 500.0, date: '2024-03-01' },
              { type: 'payment', amount: 1500.0, date: '2024-03-10' },
            ],
          },
        ],
        pagination: { limit: 10, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Upcoming',
        includeTransactions: true,
        size: 10,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTransactions: true,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].transactions).toBeInstanceOf(Array)
      expect(result.data[0].transactions.length).toBe(2)
    })

    test('should handle pagination for large booking lists', async () => {
      // Essential for managing properties with many bookings
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: new Array(20).fill(null).map((_, i) => ({
          id: `BK${100 + i}`,
          status: 'confirmed',
        })),
        pagination: { total: 200, limit: 20, offset: 20, hasNext: true },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        page: 2,
        size: 20,
        stayFilter: 'All',
        includeCount: true,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 20,
          stayFilter: 'All',
          includeCount: true,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data.length).toBe(20)
      expect(result.pagination.offset).toBe(20)
    })

    test('should include external bookings from OTAs', async () => {
      // Important for understanding total occupancy across all channels
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK-AIRBNB-001',
            source: 'Airbnb',
            external: true,
            propertyId: 128,
          },
          {
            id: 'BK-BOOKING-001',
            source: 'Booking.com',
            external: true,
            propertyId: 129,
          },
        ],
        pagination: { limit: 20, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Upcoming',
        includeExternal: true,
        size: 20,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          includeExternal: true,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].source).toBe('Airbnb')
      expect(result.data[1].source).toBe('Booking.com')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should validate that stayFilterDate is required for ArrivalDate filter', async () => {
      // Prevents user confusion when using date-specific filters
      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'ArrivalDate',
        // Missing stayFilterDate - should error
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('stayFilterDate is required')
    })

    test('should handle empty results gracefully', async () => {
      // Important for user experience when no bookings match filters
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 10, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Upcoming',
        updatedSince: '2099-12-31T00:00:00Z',
        size: 10,
      })

      const result = JSON.parse(response.content[0].text)
      expect(result.data).toBeInstanceOf(Array)
      expect(result.data.length).toBe(0)
    })

    test('should handle API errors gracefully', async () => {
      // Network issues shouldn't crash the application
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockRejectedValue(
        new Error('Network timeout'),
      )

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Upcoming',
        size: 10,
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Network timeout')
    })

    test('should handle trash filter for deleted bookings', async () => {
      // Important for recovering accidentally deleted bookings
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK-DELETED-001',
            status: 'deleted',
            deletedAt: '2024-03-01T10:00:00Z',
          },
        ],
        pagination: { limit: 10, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'All',
        trash: 'True',
        size: 10,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          trash: 'True',
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].status).toBe('deleted')
    })
  })

  describe('Business-Critical Scenarios', () => {
    test('should retrieve all booking details for comprehensive reporting', async () => {
      // Full booking details needed for monthly reports
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockResolvedValue({
        data: [
          {
            id: 'BK-FULL-001',
            status: 'confirmed',
            propertyId: 130,
            checkIn: '2024-02-01',
            checkOut: '2024-02-28',
            totalAmount: 5000.0,
            transactions: [{ type: 'payment', amount: 5000.0 }],
            quoteDetails: {
              originalQuote: 5500.0,
              discount: 500.0,
            },
            external: false,
            source: 'Direct',
          },
        ],
        pagination: { total: 100, limit: 50, offset: 0 },
      })

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'Historic',
        includeCount: true,
        includeTransactions: true,
        includeQuoteDetails: true,
        includeExternal: true,
        size: 50,
      })

      expect(mockClient.listBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          includeTransactions: true,
          includeQuoteDetails: true,
          includeExternal: true,
          includeCount: true,
        }),
      )

      const result = JSON.parse(response.content[0].text)
      expect(result.data[0].transactions).toBeDefined()
      expect(result.data[0].quoteDetails).toBeDefined()
      expect(result.pagination.total).toBe(100)
    })

    test('should handle rate limiting with appropriate error message', async () => {
      // Rate limiting shouldn't cause confusion
      ;(mockClient.listBookings as ReturnType<typeof mock>).mockRejectedValue(
        new Error('429 Too Many Requests'),
      )

      const response = await testServer.callTool('lodgify_list_bookings', {
        stayFilter: 'All',
        size: 50,
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('429')
    })
  })

  describe('Tool registration', () => {
    test('should have lodgify_list_bookings tool registered', async () => {
      const response = await testServer.listTools()
      const toolNames = response.tools.map((t: { name: string }) => t.name)

      expect(toolNames).toContain('lodgify_list_bookings')

      const listBookingsTool = response.tools.find(
        (t: { name: string }) => t.name === 'lodgify_list_bookings',
      )
      expect(listBookingsTool).toBeDefined()
      expect(listBookingsTool.description).toContain('List bookings')
    })
  })
})
