/**
 * Integration Tests for Lodgify Check-in/Check-out Operations
 *
 * Tests the critical user-facing functionality for checking guests in and out.
 * These operations are used daily by property managers to track guest arrivals
 * and departures, making them essential for operational workflows.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createTestServer, type TestServer } from '../test-server'

describe('Check-in/Check-out Integration Tests', () => {
  let testServer: TestServer
  let mockClient: Record<string, unknown>

  beforeEach(() => {
    // Create a mock client with all required methods
    mockClient = {
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      // Add other required mocked methods
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
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
      availabilityAll: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
    }

    // Create test server with the mock client
    testServer = createTestServer(mockClient)
  })

  describe('lodgify_checkin_booking', () => {
    test('should successfully check in a guest', async () => {
      // Mock successful check-in response
      mockClient.checkinBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_in',
        checkin_date: '2024-03-15T15:00:00Z',
        message: 'Guest has been successfully checked in',
      })

      const response = await testServer.callTool('lodgify_checkin_booking', {
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      expect(mockClient.checkinBooking).toHaveBeenCalledWith('123')
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('checked_in')
      expect(result.message).toContain('checked in')
    })

    test('should handle check-in error when booking not found', async () => {
      mockClient.checkinBooking.mockRejectedValue(new Error('Booking not found'))

      const response = await testServer.callTool('lodgify_checkin_booking', {
        id: 999,
        time: '2024-03-15T15:00:00Z',
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Booking not found')
    })

    test('should handle already checked-in booking', async () => {
      mockClient.checkinBooking.mockRejectedValue(new Error('Booking is already checked in'))

      const response = await testServer.callTool('lodgify_checkin_booking', {
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('already checked in')
    })

    test('should handle check-in with future time (early arrival)', async () => {
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      mockClient.checkinBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_in',
        checkin_date: futureTime,
        note: 'Early check-in recorded',
      })

      const response = await testServer.callTool('lodgify_checkin_booking', {
        id: 123,
        time: futureTime,
      })

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('checked_in')
      expect(result.note).toContain('Early check-in')
    })
  })

  describe('lodgify_checkout_booking', () => {
    test('should successfully check out a guest', async () => {
      mockClient.checkoutBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_out',
        checkout_date: '2024-03-22T11:00:00Z',
        message: 'Guest has been successfully checked out',
      })

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      expect(mockClient.checkoutBooking).toHaveBeenCalledWith('123')
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('checked_out')
      expect(result.message).toContain('checked out')
    })

    test('should handle checkout error when booking not found', async () => {
      mockClient.checkoutBooking.mockRejectedValue(new Error('Booking not found'))

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 999,
        time: '2024-03-22T11:00:00Z',
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Booking not found')
    })

    test('should handle guest not checked in error', async () => {
      mockClient.checkoutBooking.mockRejectedValue(new Error('Guest has not checked in yet'))

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('not checked in')
    })

    test('should handle late checkout scenario', async () => {
      mockClient.checkoutBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_out',
        checkout_date: '2024-03-22T14:00:00Z',
        note: 'Late checkout - additional charges may apply',
      })

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
        time: '2024-03-22T14:00:00Z', // 3 hours after standard checkout
      })

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('checked_out')
      expect(result.note).toContain('Late checkout')
    })

    test('should handle checkout with property turnover information', async () => {
      mockClient.checkoutBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_out',
        checkout_date: '2024-03-22T11:00:00Z',
        nextCheckIn: '2024-03-23T15:00:00Z',
        turnoverHours: 28,
      })

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.status).toBe('checked_out')
      expect(result.turnoverHours).toBe(28)
      expect(result.nextCheckIn).toBe('2024-03-23T15:00:00Z')
    })

    test('should handle back-to-back bookings checkout scenario', async () => {
      mockClient.checkoutBooking.mockResolvedValue({
        success: true,
        id: 'booking_123',
        status: 'checked_out',
        checkout_date: '2024-03-22T11:00:00Z',
        urgentTurnover: true,
        nextGuestArrival: '2024-03-22T15:00:00Z',
        cleaningWindowHours: 4,
      })

      const response = await testServer.callTool('lodgify_checkout_booking', {
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result.urgentTurnover).toBe(true)
      expect(result.cleaningWindowHours).toBe(4)
    })
  })

  describe('Tool registration', () => {
    test('should have checkin and checkout tools registered', async () => {
      const response = await testServer.listTools()
      const toolNames = response.tools.map((t: { name: string }) => t.name)

      expect(toolNames).toContain('lodgify_checkin_booking')
      expect(toolNames).toContain('lodgify_checkout_booking')
    })
  })
})
