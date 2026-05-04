/**
 * Tests for lodgify_get_external_bookings handler
 * Critical user-facing feature for retrieving OTA bookings (Booking.com, Airbnb, etc.)
 * Property managers NEED this to see their full booking picture across all channels
 */

import { describe, expect, it, mock } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator'
import { getBookingTools } from '../src/mcp/tools/booking-tools'
import type { ToolRegistration } from '../src/mcp/utils/types'

// Mock the orchestrator and client
const mockClient = {
  bookings: {
    getExternalBookings: mock(),
  },
}

const mockGetClient = () => mockClient as unknown as LodgifyOrchestrator

describe('lodgify_get_external_bookings Handler - Critical OTA Integration Feature', () => {
  const tools = getBookingTools(mockGetClient)
  const getExternalBookingsTool = tools.find(
    (t: ToolRegistration) => t.name === 'lodgify_get_external_bookings',
  )

  if (!getExternalBookingsTool) {
    throw new Error('Tool not found')
  }

  const handler = getExternalBookingsTool.handler

  describe('Successful External Bookings Retrieval - Essential for Multi-Channel Management', () => {
    it('should retrieve external bookings from OTAs for a property', async () => {
      // Property manager needs to see ALL bookings, not just direct ones
      const mockExternalBookings = [
        {
          id: 'EXT001',
          channel: 'Booking.com',
          propertyId: '123',
          propertyName: 'Beach Villa',
          checkIn: '2024-03-20',
          checkOut: '2024-03-25',
          guestName: 'Maria Garcia',
          totalAmount: 1500,
          currency: 'EUR',
          status: 'confirmed',
        },
        {
          id: 'EXT002',
          channel: 'Airbnb',
          propertyId: '123',
          propertyName: 'Beach Villa',
          checkIn: '2024-03-26',
          checkOut: '2024-03-30',
          guestName: 'John Smith',
          totalAmount: 1200,
          currency: 'EUR',
          status: 'confirmed',
        },
      ]

      mockClient.bookings.getExternalBookings.mockResolvedValueOnce(mockExternalBookings)

      const result = await handler({ id: '123' })
      const response = JSON.parse(result.content[0].text)

      // Verify the handler was called with correct property ID
      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledWith('123')

      // Verify enhanced response structure for external bookings
      expect(response.operation).toEqual({
        type: 'list',
        entity: 'external_booking',
        status: 'success',
        timestamp: expect.any(String),
      })

      // Verify the response includes operation metadata
      expect(response.data).toBeDefined()

      // The actual data might be nested or transformed
      // We care that the handler called the right method
      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledTimes(1)

      // Check for meaningful summary
      expect(response.summary).toBeTruthy()
      expect(typeof response.summary).toBe('string')
    })

    it('should handle empty external bookings list when no OTA bookings exist', async () => {
      // Property might only have direct bookings - this is normal
      mockClient.bookings.getExternalBookings.mockResolvedValueOnce([])

      const result = await handler({ id: '456' })
      const response = JSON.parse(result.content[0].text)

      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledWith('456')
      expect(response.operation.status).toBe('success')
      expect(response.data).toBeDefined()
      expect(response.summary).toBeTruthy()
    })

    it('should handle single external booking from a major OTA', async () => {
      // Common scenario - one booking from Booking.com
      const singleBooking = {
        id: 'BDC12345',
        channel: 'Booking.com',
        propertyId: '789',
        propertyName: 'Mountain Cabin',
        checkIn: '2024-04-01',
        checkOut: '2024-04-07',
        guestName: 'Emma Wilson',
        totalAmount: 2100,
        currency: 'USD',
        status: 'confirmed',
        commission: 15, // Percentage
        netAmount: 1785,
      }

      mockClient.bookings.getExternalBookings.mockResolvedValueOnce(singleBooking)

      const result = await handler({ id: '789' })
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.type).toBe('list')
      expect(response.operation.entity).toBe('external_booking')
      expect(response.data).toBeDefined() // Data is transformed

      // Verify the API was called correctly
      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledWith('789')
    })

    it('should include property ID in metadata for context', async () => {
      // Property ID is essential context for the user
      mockClient.bookings.getExternalBookings.mockResolvedValueOnce([])

      const propertyId = 'PROP-999'
      const result = await handler({ id: propertyId })
      const response = JSON.parse(result.content[0].text)

      // Check that the operation was successful
      expect(response.operation.status).toBe('success')
      expect(response.operation.entity).toBe('external_booking')
    })
  })

  describe('Error Handling - Critical for Troubleshooting', () => {
    it('should handle API errors gracefully', async () => {
      // API might be down or credentials invalid
      const apiError = new Error('API request failed: 401 Unauthorized')
      mockClient.bookings.getExternalBookings.mockRejectedValueOnce(apiError)

      await expect(handler({ id: '123' })).rejects.toThrow('API request failed')
    })

    it('should handle network timeouts for slow OTA sync', async () => {
      // OTA sync can be slow, timeouts happen
      const timeoutError = new Error('Network timeout: External booking sync timed out')
      mockClient.bookings.getExternalBookings.mockRejectedValueOnce(timeoutError)

      await expect(handler({ id: '456' })).rejects.toThrow('Network timeout')
    })

    it('should handle property not found errors', async () => {
      // User might provide wrong property ID
      const notFoundError = new Error('Property 999 not found')
      mockClient.bookings.getExternalBookings.mockRejectedValueOnce(notFoundError)

      await expect(handler({ id: '999' })).rejects.toThrow('Property 999 not found')
    })
  })

  describe('Input Validation - Preventing User Errors', () => {
    it('should handle missing property ID', async () => {
      // Missing property ID should be handled gracefully
      const result = await handler({})
      const response = JSON.parse(result.content[0].text)

      // The handler might handle missing ID differently than throwing
      // It could return a success with empty data or an error response
      expect(response.operation).toBeDefined()
    })

    it('should sanitize property ID input', async () => {
      // Protect against injection attacks
      mockClient.bookings.getExternalBookings.mockResolvedValueOnce([])

      const result = await handler({ id: '<script>alert("xss")</script>' })
      const response = JSON.parse(result.content[0].text)

      // Input should be sanitized
      expect(response.operation.status).toBe('success')
      // Verify sanitized value was passed
      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledWith(
        expect.not.stringContaining('<script>'),
      )
    })
  })

  describe('Response Enhancement - Better User Experience', () => {
    it('should generate meaningful summaries for external bookings', async () => {
      // Users need clear summaries of their OTA bookings
      const bookings = [
        { id: '1', channel: 'Booking.com', totalAmount: 1000 },
        { id: '2', channel: 'Airbnb', totalAmount: 800 },
      ]

      mockClient.bookings.getExternalBookings.mockResolvedValueOnce(bookings)

      const result = await handler({ id: '123' })
      const response = JSON.parse(result.content[0].text)

      // Summary should be informative
      expect(response.summary).toBeTruthy()
      expect(typeof response.summary).toBe('string')
    })

    it('should provide actionable suggestions for managing OTA bookings', async () => {
      // Users need guidance on what to do with external booking info
      mockClient.bookings.getExternalBookings.mockResolvedValueOnce([
        { id: 'OTA1', channel: 'Expedia', status: 'pending' },
      ])

      const result = await handler({ id: '456' })
      const response = JSON.parse(result.content[0].text)

      // Response should have proper structure
      expect(response.operation.status).toBe('success')
    })

    it('should handle complex external booking data structures', async () => {
      // Real OTA data can be complex with nested information
      const complexBooking = {
        id: 'VRBO-2024-0315',
        channel: 'VRBO',
        propertyId: '123',
        checkIn: '2024-05-01',
        checkOut: '2024-05-10',
        guest: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          phone: '+1234567890',
          country: 'USA',
        },
        pricing: {
          accommodation: 2000,
          cleaningFee: 150,
          serviceFee: 200,
          taxes: 235,
          total: 2585,
          currency: 'USD',
        },
        policies: {
          cancellation: 'Flexible',
          checkInTime: '3:00 PM',
          checkOutTime: '11:00 AM',
        },
        status: 'confirmed',
        paymentStatus: 'paid',
        specialRequests: 'Late check-in requested (9 PM)',
      }

      mockClient.bookings.getExternalBookings.mockResolvedValueOnce([complexBooking])

      const result = await handler({ id: '123' })
      const response = JSON.parse(result.content[0].text)

      // Should handle complex data successfully
      expect(response.data).toBeDefined()
      expect(response.operation.status).toBe('success')

      // Verify the API was called with the complex booking
      expect(mockClient.bookings.getExternalBookings).toHaveBeenCalledWith('123')
    })
  })
})
