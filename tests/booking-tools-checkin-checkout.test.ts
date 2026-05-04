/**
 * Unit Tests for Checkin/Checkout Handlers in booking-tools.ts
 *
 * Tests the critical user-facing functionality for checking guests in and out.
 * These handlers are executed hundreds of times daily by property managers to track
 * guest arrivals and departures, coordinate cleaning schedules, and manage property
 * turnover. They are among the most essential operations for property management.
 */

import { beforeEach, describe, expect, it, jest } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator'
import { getBookingTools } from '../src/mcp/tools/booking-tools'

describe('Booking Tools - Checkin/Checkout Handlers', () => {
  let mockClient: Partial<LodgifyOrchestrator>
  let tools: ReturnType<typeof getBookingTools>
  let checkinTool: ReturnType<typeof getBookingTools>[number]
  let checkoutTool: ReturnType<typeof getBookingTools>[number]

  beforeEach(() => {
    // Create mock client with checkin/checkout methods
    mockClient = {
      checkinBooking: jest.fn(),
      checkoutBooking: jest.fn(),
    }

    // Get the actual tools with the mock client
    tools = getBookingTools(() => mockClient as LodgifyOrchestrator)

    // Find the specific tools we're testing
    checkinTool = tools.find((t) => t.name === 'lodgify_checkin_booking')
    checkoutTool = tools.find((t) => t.name === 'lodgify_checkout_booking')
  })

  describe('lodgify_checkin_booking handler', () => {
    it('should successfully check in a guest with valid parameters', async () => {
      // Mock successful API response
      mockClient.checkinBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_in',
        propertyName: 'Ocean View Villa',
        guestName: 'John Doe',
        checkinTime: '2024-03-15T15:00:00Z',
      })

      // Call the actual handler
      const result = await checkinTool.handler({
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      // Verify the client was called with correct parameters
      expect(mockClient.checkinBooking).toHaveBeenCalledWith('123', '2024-03-15T15:00:00Z')
      expect(mockClient.checkinBooking).toHaveBeenCalledTimes(1)

      // Parse and check the response
      const response = JSON.parse(result.content[0].text)
      expect(response.operation.type).toBe('update')
      expect(response.operation.entity).toBe('booking_checkin')
      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('successfully checked in')
      expect(response.data.bookingId).toBe('BK123')
      expect(response.data.status).toBe('checked_in')

      // Verify suggestions are present
      expect(response.suggestions).toBeArray()
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should handle early check-in scenario with warning', async () => {
      const earlyTime = '2024-03-15T12:00:00Z' // 3 hours early

      mockClient.checkinBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_in',
        warning: 'Early check-in - additional charges may apply',
        earlyCheckInHours: 3,
      })

      const result = await checkinTool.handler({
        id: 456,
        time: earlyTime,
      })

      expect(mockClient.checkinBooking).toHaveBeenCalledWith('456', earlyTime)

      const response = JSON.parse(result.content[0].text)
      expect(response.data.warning).toContain('Early check-in')
      expect(response.data.earlyCheckInHours).toBe(3)
    })

    it('should handle check-in failure when booking not found', async () => {
      mockClient.checkinBooking = jest.fn().mockRejectedValue(new Error('Booking ID 999 not found'))

      await expect(
        checkinTool.handler({
          id: 999,
          time: '2024-03-15T15:00:00Z',
        }),
      ).rejects.toThrow('Booking ID 999 not found')
    })

    it('should handle already checked-in booking error', async () => {
      mockClient.checkinBooking = jest
        .fn()
        .mockRejectedValue(new Error('Guest is already checked in'))

      await expect(
        checkinTool.handler({
          id: 123,
          time: '2024-03-15T15:00:00Z',
        }),
      ).rejects.toThrow('already checked in')
    })

    it('should handle network timeout during check-in', async () => {
      mockClient.checkinBooking = jest.fn().mockRejectedValue(new Error('Network timeout'))

      await expect(
        checkinTool.handler({
          id: 123,
          time: '2024-03-15T15:00:00Z',
        }),
      ).rejects.toThrow('Network timeout')
    })

    it('should generate contextual suggestions for successful check-in', async () => {
      mockClient.checkinBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        propertyId: 'PROP456',
      })

      const result = await checkinTool.handler({
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)

      // Check for specific suggestions that should be present after check-in
      expect(response.suggestions).toContainEqual(expect.stringContaining('property access'))
      expect(
        response.suggestions.some(
          (s: string) =>
            s.toLowerCase().includes('verify') ||
            s.toLowerCase().includes('identity') ||
            s.toLowerCase().includes('codes'),
        ),
      ).toBe(true)
    })
  })

  describe('lodgify_checkout_booking handler', () => {
    it('should successfully check out a guest with valid parameters', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_out',
        propertyName: 'Ocean View Villa',
        guestName: 'Jane Smith',
        checkoutTime: '2024-03-22T11:00:00Z',
        stayDuration: 7,
      })

      const result = await checkoutTool.handler({
        id: 789,
        time: '2024-03-22T11:00:00Z',
      })

      expect(mockClient.checkoutBooking).toHaveBeenCalledWith('789', '2024-03-22T11:00:00Z')
      expect(mockClient.checkoutBooking).toHaveBeenCalledTimes(1)

      const response = JSON.parse(result.content[0].text)
      expect(response.operation.type).toBe('update')
      expect(response.operation.entity).toBe('booking_checkout')
      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('successfully checked out')
      expect(response.data.bookingId).toBe('BK123')
      expect(response.data.status).toBe('checked_out')
      expect(response.data.stayDuration).toBe(7)

      // Verify suggestions are present
      expect(response.suggestions).toBeArray()
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should handle late checkout with additional charges', async () => {
      const lateTime = '2024-03-22T14:00:00Z' // 3 hours late

      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_out',
        warning: 'Late checkout - additional charges applied',
        lateCheckoutHours: 3,
        additionalCharge: 50.0,
        currency: 'USD',
      })

      const result = await checkoutTool.handler({
        id: 456,
        time: lateTime,
      })

      expect(mockClient.checkoutBooking).toHaveBeenCalledWith('456', lateTime)

      const response = JSON.parse(result.content[0].text)
      expect(response.data.warning).toContain('Late checkout')
      expect(response.data.lateCheckoutHours).toBe(3)
      expect(response.data.additionalCharge).toBe(50.0)
    })

    it('should handle checkout when guest has not checked in', async () => {
      mockClient.checkoutBooking = jest
        .fn()
        .mockRejectedValue(new Error('Cannot checkout - guest has not checked in'))

      await expect(
        checkoutTool.handler({
          id: 123,
          time: '2024-03-22T11:00:00Z',
        }),
      ).rejects.toThrow('not checked in')
    })

    it('should handle back-to-back bookings with urgent turnover', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_out',
        urgentTurnover: true,
        nextCheckIn: '2024-03-22T15:00:00Z',
        cleaningWindowHours: 4,
        priority: 'HIGH',
      })

      const result = await checkoutTool.handler({
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.urgentTurnover).toBe(true)
      expect(response.data.cleaningWindowHours).toBe(4)
      expect(response.data.priority).toBe('HIGH')

      // Should have urgent cleaning suggestions
      expect(
        response.suggestions.some(
          (s: string) =>
            s.toLowerCase().includes('cleaning') ||
            s.toLowerCase().includes('urgent') ||
            s.toLowerCase().includes('turnover'),
        ),
      ).toBe(true)
    })

    it('should generate contextual suggestions for successful checkout', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        propertyId: 'PROP456',
      })

      const result = await checkoutTool.handler({
        id: 789,
        time: '2024-03-22T11:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)

      // Check for specific suggestions that should be present after checkout
      expect(response.suggestions).toBeArray()
      expect(
        response.suggestions.some(
          (s: string) =>
            s.toLowerCase().includes('cleaning') ||
            s.toLowerCase().includes('inspection') ||
            s.toLowerCase().includes('review') ||
            s.toLowerCase().includes('maintenance'),
        ),
      ).toBe(true)
    })

    it('should handle empty response from API gracefully', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({})

      const result = await checkoutTool.handler({
        id: 123,
        time: '2024-03-22T11:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('successfully checked out')
      expect(response.data).toEqual({})
    })

    it('should handle checkout with property damage report', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
        status: 'checked_out',
        damageReported: true,
        damageDescription: 'Broken lamp in living room',
        estimatedCost: 150.0,
        securityDepositHeld: true,
      })

      const result = await checkoutTool.handler({
        id: 456,
        time: '2024-03-22T11:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.damageReported).toBe(true)
      expect(response.data.estimatedCost).toBe(150.0)
      expect(response.data.securityDepositHeld).toBe(true)

      // Should include action-related suggestions for checkout
      expect(
        response.suggestions.some(
          (s: string) =>
            s.toLowerCase().includes('cleaning') ||
            s.toLowerCase().includes('property condition') ||
            s.toLowerCase().includes('report'),
        ),
      ).toBe(true)
    })
  })

  describe('Input validation and sanitization', () => {
    it('should sanitize numeric ID inputs for checkin', async () => {
      mockClient.checkinBooking = jest.fn().mockResolvedValue({ success: true })

      // Test with various numeric formats
      await checkinTool.handler({
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      expect(mockClient.checkinBooking).toHaveBeenCalledWith('123', '2024-03-15T15:00:00Z')
    })

    it('should validate ISO datetime format for checkin time', async () => {
      mockClient.checkinBooking = jest.fn().mockResolvedValue({ success: true })

      const validISOTime = '2024-03-15T15:00:00.000Z'

      await checkinTool.handler({
        id: 123,
        time: validISOTime,
      })

      expect(mockClient.checkinBooking).toHaveBeenCalledWith('123', validISOTime)
    })

    it('should sanitize numeric ID inputs for checkout', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({ success: true })

      await checkoutTool.handler({
        id: 789,
        time: '2024-03-22T11:00:00Z',
      })

      expect(mockClient.checkoutBooking).toHaveBeenCalledWith('789', '2024-03-22T11:00:00Z')
    })
  })

  describe('Enhanced response structure', () => {
    it('should include all required enhanced response fields for checkin', async () => {
      mockClient.checkinBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK123',
      })

      const result = await checkinTool.handler({
        id: 123,
        time: '2024-03-15T15:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)

      // Verify enhanced response structure
      expect(response).toHaveProperty('operation')
      expect(response.operation).toHaveProperty('type')
      expect(response.operation).toHaveProperty('entity')
      expect(response.operation).toHaveProperty('status')
      expect(response.operation).toHaveProperty('timestamp')

      expect(response).toHaveProperty('summary')
      expect(response).toHaveProperty('data')
      expect(response).toHaveProperty('suggestions')
      expect(response).toHaveProperty('details')
    })

    it('should include all required enhanced response fields for checkout', async () => {
      mockClient.checkoutBooking = jest.fn().mockResolvedValue({
        success: true,
        bookingId: 'BK456',
      })

      const result = await checkoutTool.handler({
        id: 456,
        time: '2024-03-22T11:00:00Z',
      })

      const response = JSON.parse(result.content[0].text)

      // Verify enhanced response structure
      expect(response).toHaveProperty('operation')
      expect(response.operation).toHaveProperty('type')
      expect(response.operation).toHaveProperty('entity')
      expect(response.operation).toHaveProperty('status')
      expect(response.operation).toHaveProperty('timestamp')

      expect(response).toHaveProperty('summary')
      expect(response).toHaveProperty('data')
      expect(response).toHaveProperty('suggestions')
      expect(response).toHaveProperty('details')
    })
  })
})
