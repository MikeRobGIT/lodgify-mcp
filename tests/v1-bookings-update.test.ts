/**
 * Comprehensive tests for BookingsV1Client.updateBookingV1 method
 * Tests the critical user-facing feature of updating existing bookings
 *
 * This functionality is essential for property managers who need to:
 * - Modify booking dates when guests reschedule
 * - Update guest counts for room allocation
 * - Change booking status (tentative to confirmed)
 * - Update contact information
 * - Add or modify special requests
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { BaseApiClient } from '../src/api/base-client'
import { BookingsV1Client } from '../src/api/v1/bookings/client'
import type { BookingV1Response, UpdateBookingV1Request } from '../src/api/v1/bookings/types'

describe('BookingsV1Client.updateBookingV1 - Critical booking modification functionality', () => {
  let client: BookingsV1Client
  let mockApiClient: BaseApiClient
  let mockRequest: ReturnType<typeof mock>

  beforeEach(() => {
    mockRequest = mock()
    mockApiClient = {
      request: mockRequest,
      getBaseUrl: () => 'https://api.lodgify.com',
      getApiKey: () => 'test-key',
      isReadOnly: () => false,
    } as unknown as BaseApiClient

    client = new BookingsV1Client(mockApiClient)

    // Mock getBookingV1 to use the same mockRequest
    client.getBookingV1 = async (id: string | number) => {
      const getPath = `reservation/booking/${id}`
      return mockApiClient.request('GET', getPath, {
        apiVersion: 'v1',
      })
    }
  })

  describe('Successful booking updates - common user scenarios', () => {
    it('should update booking dates when guest reschedules', async () => {
      // Mock current booking data
      const currentBooking: BookingV1Response = {
        id: 12345,
        property_id: 100,
        room_type_id: 200,
        arrival: '2024-06-01',
        departure: '2024-06-05',
        guest_name: 'John Smith',
        guest_email: 'john@example.com',
        adults: 2,
        children: 0,
        status: 'booked',
      }

      // First call fetches current booking
      mockRequest.mockResolvedValueOnce(currentBooking)
      // Second call updates the booking - returns the updated booking directly
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        arrival: '2024-07-10',
        departure: '2024-07-15',
      })

      const updates: UpdateBookingV1Request = {
        arrival: '2024-07-10',
        departure: '2024-07-15',
      }

      const result = await client.updateBookingV1(12345, updates)

      // Verify API calls
      expect(mockRequest).toHaveBeenCalledTimes(2)

      // First call: GET current booking
      expect(mockRequest).toHaveBeenNthCalledWith(1, 'GET', 'reservation/booking/12345', {
        apiVersion: 'v1',
      })

      // Second call: PUT update with merged data
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/12345', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          property_id: 100,
          arrival: '2024-07-10',
          departure: '2024-07-15',
          guest: expect.objectContaining({
            guest_name: expect.objectContaining({
              first_name: 'John',
              last_name: 'Smith',
            }),
          }),
        }),
      })

      // Verify result
      expect(result.arrival).toBe('2024-07-10')
      expect(result.departure).toBe('2024-07-15')
    })

    it('should update guest count when party size changes', async () => {
      // Guest calls to add more people to their booking
      const currentBooking: BookingV1Response = {
        id: 23456,
        property_id: 101,
        room_type_id: 201,
        arrival: '2024-08-01',
        departure: '2024-08-07',
        guest_name: 'Jane Doe',
        adults: 2,
        children: 0,
        status: 'confirmed',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      // Return the updated booking directly from the update call
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        adults: 4,
        children: 2,
      })

      const updates: UpdateBookingV1Request = {
        adults: 4,
        children: 2,
      }

      const result = await client.updateBookingV1(23456, updates)

      // Verify the update includes room information when guests change
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/23456', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          rooms: [
            {
              room_type_id: 201,
              guest_breakdown: {
                adults: 4,
                children: 2,
              },
            },
          ],
        }),
      })

      expect(result.adults).toBe(4)
      expect(result.children).toBe(2)
    })

    it('should update booking status from tentative to confirmed', async () => {
      // Common workflow: guest confirms their tentative booking
      const currentBooking: BookingV1Response = {
        id: 34567,
        property_id: 102,
        arrival: '2024-09-15',
        departure: '2024-09-20',
        guest_name: 'Robert Johnson',
        adults: 2,
        status: 'tentative',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      mockRequest.mockResolvedValueOnce({})
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        status: 'confirmed',
      })

      const result = await client.updateBookingV1(34567, {
        status: 'confirmed',
      })

      // Verify status mapping (confirmed -> Booked in API)
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/34567', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          status: 'Booked', // Internal API uses 'Booked' for confirmed
        }),
      })

      expect(result.status).toBe('confirmed')
    })

    it('should update guest contact information', async () => {
      // Guest provides updated email and phone
      const currentBooking: BookingV1Response = {
        id: 45678,
        property_id: 103,
        arrival: '2024-10-01',
        departure: '2024-10-05',
        guest_name: 'Alice Brown',
        guest_email: 'alice.old@example.com',
        adults: 1,
        status: 'booked',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      mockRequest.mockResolvedValueOnce({})
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        guest_email: 'alice.new@example.com',
        guest_phone: '+1234567890',
      })

      const updates: UpdateBookingV1Request = {
        guest_email: 'alice.new@example.com',
        guest_phone: '+1234567890',
      }

      const result = await client.updateBookingV1(45678, updates)

      // Verify guest object structure in API call
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/45678', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          guest: expect.objectContaining({
            email: 'alice.new@example.com',
            phone: '+1234567890',
          }),
        }),
      })

      expect(result.guest_email).toBe('alice.new@example.com')
      expect(result.guest_phone).toBe('+1234567890')
    })

    it('should handle partial updates without fetching current data', async () => {
      // When current booking fetch fails, still attempt update
      mockRequest.mockRejectedValueOnce(new Error('Network error'))
      mockRequest.mockResolvedValueOnce({})
      mockRequest.mockResolvedValueOnce({
        id: 56789,
        property_id: 104,
        arrival: '2024-11-01',
        departure: '2024-11-10',
        guest_name: 'Updated Name',
        adults: 3,
        status: 'booked',
      })

      const updates: UpdateBookingV1Request = {
        arrival: '2024-11-01',
        departure: '2024-11-10',
        guest_name: 'Updated Name',
        adults: 3,
        room_type_id: 205,
      }

      const result = await client.updateBookingV1(56789, updates)

      // Should still call update even without current data
      expect(mockRequest).toHaveBeenCalledTimes(3)
      expect(result.guest_name).toBe('Updated Name')
    })
  })

  describe('Input validation', () => {
    it('should reject update without booking ID', async () => {
      await expect(client.updateBookingV1('', { adults: 2 })).rejects.toThrow(
        'Booking ID is required',
      )

      await expect(
        client.updateBookingV1(null as unknown as string | number, { adults: 2 }),
      ).rejects.toThrow('Booking ID is required')
    })

    it('should reject update without any data', async () => {
      await expect(client.updateBookingV1(12345, {})).rejects.toThrow('Update data is required')

      await expect(
        client.updateBookingV1(12345, null as unknown as UpdateBookingV1Request),
      ).rejects.toThrow('Update data is required')
    })

    it('should validate date format for arrival', async () => {
      await expect(
        client.updateBookingV1(12345, {
          arrival: '2024/06/15', // Wrong format
        }),
      ).rejects.toThrow('Arrival date must be in YYYY-MM-DD format')

      await expect(
        client.updateBookingV1(12345, {
          arrival: '', // Empty string
        }),
      ).rejects.toThrow('Arrival date must be in YYYY-MM-DD format')
    })

    it('should validate date format for departure', async () => {
      await expect(
        client.updateBookingV1(12345, {
          departure: 'June 20, 2024', // Wrong format
        }),
      ).rejects.toThrow('Departure date must be in YYYY-MM-DD format')
    })

    it('should validate minimum adult count', async () => {
      await expect(
        client.updateBookingV1(12345, {
          adults: 0,
        }),
      ).rejects.toThrow('At least one adult guest is required')

      await expect(
        client.updateBookingV1(12345, {
          adults: -1,
        }),
      ).rejects.toThrow('At least one adult guest is required')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty API response by fetching updated booking', async () => {
      const currentBooking: BookingV1Response = {
        id: 67890,
        property_id: 105,
        arrival: '2024-12-01',
        departure: '2024-12-05',
        guest_name: 'Test User',
        adults: 2,
        status: 'booked',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      mockRequest.mockResolvedValueOnce({}) // Empty update response
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        adults: 3,
      })

      const result = await client.updateBookingV1(67890, { adults: 3 })

      // Should fetch updated booking when API returns empty
      expect(mockRequest).toHaveBeenCalledTimes(3)
      expect(result.adults).toBe(3)
    })

    it('should handle both string and number booking IDs', async () => {
      mockRequest.mockResolvedValue({})

      // Test with number ID
      await client.updateBookingV1(12345, { adults: 2 })
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        'reservation/booking/12345',
        expect.any(Object),
      )

      // Test with string ID
      await client.updateBookingV1('67890', { adults: 3 })
      expect(mockRequest).toHaveBeenCalledWith(
        expect.any(String),
        'reservation/booking/67890',
        expect.any(Object),
      )
    })

    it('should preserve room_type_id when updating guest counts', async () => {
      const currentBooking: BookingV1Response = {
        id: 78901,
        property_id: 106,
        room_type_id: 303,
        arrival: '2025-01-10',
        departure: '2025-01-15',
        guest_name: 'Room Test',
        adults: 2,
        children: 1,
        status: 'booked',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      mockRequest.mockResolvedValueOnce({})
      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        adults: 3,
        children: 2,
      })

      const result = await client.updateBookingV1(78901, {
        adults: 3,
        children: 2,
      })

      // Should include room_type_id when updating occupancy
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/78901', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          rooms: [
            {
              room_type_id: 303,
              guest_breakdown: {
                adults: 3,
                children: 2,
              },
            },
          ],
        }),
      })

      expect(result.adults).toBe(3)
      expect(result.children).toBe(2)
    })

    it('should handle guest name updates with proper splitting', async () => {
      mockRequest.mockResolvedValue({})

      const updates: UpdateBookingV1Request = {
        guest_name: 'Mary Jane Watson Parker',
      }

      await client.updateBookingV1(89012, updates)

      // Should split name correctly (first name + rest as last name)
      expect(mockRequest).toHaveBeenCalledWith('PUT', 'reservation/booking/89012', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          guest: expect.objectContaining({
            guest_name: {
              first_name: 'Mary',
              last_name: 'Jane Watson Parker',
            },
          }),
        }),
      })
    })

    it('should handle single-name guests', async () => {
      mockRequest.mockResolvedValue({})

      const updates: UpdateBookingV1Request = {
        guest_name: 'Madonna',
      }

      await client.updateBookingV1(90123, updates)

      // Should handle single name (no last name)
      expect(mockRequest).toHaveBeenCalledWith('PUT', 'reservation/booking/90123', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          guest: expect.objectContaining({
            guest_name: {
              first_name: 'Madonna',
              last_name: '',
            },
          }),
        }),
      })
    })

    it('should map booking status values correctly', async () => {
      mockRequest.mockResolvedValue({})

      // Test all status mappings
      const statusMappings = [
        { input: 'booked', expected: 'Booked' },
        { input: 'tentative', expected: 'Tentative' },
        { input: 'declined', expected: 'Declined' },
        { input: 'confirmed', expected: 'Booked' }, // confirmed maps to Booked
      ]

      for (const { input, expected } of statusMappings) {
        await client.updateBookingV1(11111, {
          status: input as 'booked' | 'tentative' | 'declined' | 'confirmed',
        })

        expect(mockRequest).toHaveBeenCalledWith('PUT', 'reservation/booking/11111', {
          apiVersion: 'v1',
          body: expect.objectContaining({
            status: expected,
          }),
        })
      }
    })
  })

  describe('Complex update scenarios', () => {
    it('should handle full booking modification with all fields', async () => {
      const currentBooking: BookingV1Response = {
        id: 99999,
        property_id: 107,
        room_type_id: 404,
        arrival: '2025-02-01',
        departure: '2025-02-07',
        guest_name: 'Original Guest',
        guest_email: 'original@example.com',
        guest_phone: '+1111111111',
        adults: 2,
        children: 1,
        infants: 0,
        status: 'tentative',
        source: 'Direct',
        notes: 'Original notes',
      }

      mockRequest.mockResolvedValueOnce(currentBooking)
      mockRequest.mockResolvedValueOnce({})

      const updates: UpdateBookingV1Request = {
        property_id: 108,
        room_type_id: 505,
        arrival: '2025-03-15',
        departure: '2025-03-20',
        guest_name: 'Updated Guest Name',
        guest_email: 'updated@example.com',
        guest_phone: '+2222222222',
        adults: 4,
        children: 2,
        infants: 1,
        status: 'confirmed',
        source: 'Booking.com',
        notes: 'Updated notes with special requests',
      }

      mockRequest.mockResolvedValueOnce({
        ...currentBooking,
        ...updates,
        id: 99999,
        status: 'confirmed',
      })

      const result = await client.updateBookingV1(99999, updates)

      // Verify complex nested structure
      expect(mockRequest).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/99999', {
        apiVersion: 'v1',
        body: expect.objectContaining({
          property_id: 108,
          arrival: '2025-03-15',
          departure: '2025-03-20',
          guest: expect.objectContaining({
            guest_name: expect.objectContaining({
              first_name: 'Updated',
              last_name: 'Guest Name',
            }),
            email: 'updated@example.com',
            phone: '+2222222222',
          }),
          rooms: [
            {
              room_type_id: 505,
              guest_breakdown: {
                adults: 4,
                children: 2,
                infants: 1,
              },
            },
          ],
          status: 'Booked',
          source_text: 'Booking.com',
        }),
      })

      expect(result.property_id).toBe(108)
      expect(result.guest_name).toBe('Updated Guest Name')
    })

    it('should handle network errors gracefully', async () => {
      mockRequest.mockRejectedValue(new Error('Connection timeout'))

      await expect(client.updateBookingV1(12345, { adults: 3 })).rejects.toThrow(
        'Connection timeout',
      )
    })

    it('should not include rooms array when missing required fields', async () => {
      mockRequest.mockResolvedValue({})

      // Update only children without adults or room_type_id
      await client.updateBookingV1(11111, {
        children: 2,
      })

      // Should NOT include rooms array
      expect(mockRequest).toHaveBeenCalledWith('PUT', 'reservation/booking/11111', {
        apiVersion: 'v1',
        body: expect.not.objectContaining({
          rooms: expect.anything(),
        }),
      })
    })
  })
})
