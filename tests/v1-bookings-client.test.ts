/**
 * V1 Bookings Client Tests - Critical User-Facing Booking Creation
 *
 * Tests the createBookingV1 method which property managers depend on daily to:
 * - Create new bookings programmatically
 * - Import bookings from external systems
 * - Process direct bookings from websites
 * - Handle reservation requests
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { BaseApiClient } from '../src/api/base-client'
import { BookingsV1Client } from '../src/api/v1/bookings/client'
import type { BookingV1Response, CreateBookingV1Request } from '../src/api/v1/bookings/types'

describe('V1 Bookings Client - Critical User-Facing Booking Creation', () => {
  let client: BookingsV1Client
  let mockApiClient: BaseApiClient
  let requestSpy: ReturnType<typeof mock>

  beforeEach(() => {
    // Create a mock API client
    requestSpy = mock()
    mockApiClient = {
      request: requestSpy,
      getApiKey: mock(() => 'test-api-key'),
      getBaseUrl: mock(() => 'https://api.lodgify.com'),
      isReadOnlyMode: mock(() => false),
      getReadOnlyStatus: mock(() => ({ readOnly: false })),
    } as unknown as BaseApiClient

    client = new BookingsV1Client(mockApiClient)
  })

  afterEach(() => {
    requestSpy.mockReset()
  })

  describe('createBookingV1 - Core Booking Creation Functionality', () => {
    describe('Successful Booking Creation (Happy Path)', () => {
      it('should create a booking with minimal required fields', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123456,
          room_type_id: 789012,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'John Smith',
          adults: 2,
        }

        // Mock API returns just the booking ID on success (common Lodgify v1 pattern)
        requestSpy.mockReturnValue(Promise.resolve(999888))

        const result = await client.createBookingV1(bookingRequest)

        // Verify the request was made with correct structure
        expect(requestSpy).toHaveBeenCalledWith('POST', 'reservation/booking', {
          body: {
            property_id: 123456,
            arrival: '2025-06-01',
            departure: '2025-06-07',
            guest: {
              guest_name: {
                first_name: 'John',
                last_name: 'Smith',
              },
              email: null,
              phone: null,
            },
            rooms: [
              {
                room_type_id: 789012,
                guest_breakdown: {
                  adults: 2,
                  children: 0,
                  infants: 0,
                },
              },
            ],
            status: 'Booked',
            source_text: null,
          },
          apiVersion: 'v1',
        })

        // Verify the response includes the booking ID
        expect(result).toMatchObject({
          id: 999888,
          property_id: 123456,
          room_type_id: 789012,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'John Smith',
          adults: 2,
          status: 'booked',
        })
      })

      it('should create a booking with all optional fields', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123456,
          room_type_id: 789012,
          arrival: '2025-07-15',
          departure: '2025-07-22',
          guest_name: 'Jane Doe Williams',
          guest_email: 'jane.doe@example.com',
          guest_phone: '+1-555-0123',
          adults: 2,
          children: 1,
          infants: 1,
          status: 'tentative',
          source: 'Booking.com',
          notes: 'Late arrival expected',
        }

        // Mock successful creation with ID
        requestSpy.mockReturnValueOnce(Promise.resolve('888777')) // Initial creation
        requestSpy.mockReturnValueOnce(Promise.resolve({})) // Status update

        const result = await client.createBookingV1(bookingRequest)

        // Verify nested API structure
        expect(requestSpy).toHaveBeenNthCalledWith(1, 'POST', 'reservation/booking', {
          body: {
            property_id: 123456,
            arrival: '2025-07-15',
            departure: '2025-07-22',
            guest: {
              guest_name: {
                first_name: 'Jane',
                last_name: 'Doe Williams',
              },
              email: 'jane.doe@example.com',
              phone: '+1-555-0123',
            },
            rooms: [
              {
                room_type_id: 789012,
                guest_breakdown: {
                  adults: 2,
                  children: 1,
                  infants: 1,
                },
              },
            ],
            status: 'Tentative',
            source_text: 'Booking.com',
          },
          apiVersion: 'v1',
        })

        // Verify status update was attempted
        expect(requestSpy).toHaveBeenNthCalledWith(
          2,
          'PUT',
          'reservation/booking/888777/tentative',
          {
            apiVersion: 'v1',
          },
        )

        expect(result.id).toBe(888777)
        expect(result.status).toBe('tentative')
      })

      it('should handle API returning full booking object (alternative response format)', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 654321,
          room_type_id: 234567,
          arrival: '2025-08-10',
          departure: '2025-08-15',
          guest_name: 'Alice Brown',
          adults: 1,
        }

        // Some API versions return the full booking object
        const apiResponse: BookingV1Response = {
          id: 777666,
          property_id: 654321,
          room_type_id: 234567,
          arrival: '2025-08-10',
          departure: '2025-08-15',
          guest_name: 'Alice Brown',
          adults: 1,
          status: 'booked',
          currency: 'USD',
          amount: 1500.0,
        }

        requestSpy.mockReturnValue(Promise.resolve(apiResponse))

        const result = await client.createBookingV1(bookingRequest)

        expect(result).toEqual(apiResponse)
      })

      it('should set booking status via separate API call when specified', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 111222,
          room_type_id: 333444,
          arrival: '2025-09-01',
          departure: '2025-09-05',
          guest_name: 'Bob Wilson',
          adults: 3,
          status: 'confirmed', // Should map to 'booked'
        }

        requestSpy
          .mockReturnValueOnce(Promise.resolve(555666)) // Create booking
          .mockReturnValueOnce(Promise.resolve({})) // Update status

        const result = await client.createBookingV1(bookingRequest)

        // Verify status endpoint was called
        expect(requestSpy).toHaveBeenCalledTimes(2)
        expect(requestSpy).toHaveBeenNthCalledWith(2, 'PUT', 'reservation/booking/555666/book', {
          apiVersion: 'v1',
        })

        expect(result.id).toBe(555666)
        expect(result.status).toBe('confirmed')
      })
    })

    describe('Input Validation', () => {
      it('should reject missing property_id', async () => {
        const invalidRequest = {
          room_type_id: 123,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        } as CreateBookingV1Request

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Property ID is required',
        )

        expect(requestSpy).not.toHaveBeenCalled()
      })

      it('should reject missing arrival date', async () => {
        const invalidRequest = {
          property_id: 123,
          room_type_id: 456,
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        } as CreateBookingV1Request

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Arrival and departure dates are required',
        )
      })

      it('should reject missing guest name', async () => {
        const invalidRequest = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          adults: 2,
        } as CreateBookingV1Request

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Guest name is required',
        )
      })

      it('should reject zero or negative adults count', async () => {
        const invalidRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 0,
        }

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'At least one adult guest is required',
        )
      })

      it('should reject missing room_type_id', async () => {
        const invalidRequest = {
          property_id: 123,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        } as CreateBookingV1Request

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Room type ID is required',
        )
      })

      it('should reject invalid date formats', async () => {
        const invalidRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '06/01/2025', // Wrong format
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Dates must be in YYYY-MM-DD format',
        )
      })

      it('should validate departure date format', async () => {
        const invalidRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '07-06-2025', // Wrong format
          guest_name: 'Test Guest',
          adults: 2,
        }

        await expect(client.createBookingV1(invalidRequest)).rejects.toThrow(
          'Dates must be in YYYY-MM-DD format',
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle API returning empty response', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        requestSpy.mockReturnValue(Promise.resolve({}))

        await expect(client.createBookingV1(bookingRequest)).rejects.toThrow(
          'Booking creation failed. The API returned an empty response',
        )
      })

      it('should handle API returning null', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        requestSpy.mockReturnValue(Promise.resolve(null))

        await expect(client.createBookingV1(bookingRequest)).rejects.toThrow(
          'Booking creation failed. The API returned an empty response',
        )
      })

      it('should handle API returning invalid response format', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        // Return an object missing required fields
        requestSpy.mockReturnValue(
          Promise.resolve({
            someField: 'value',
            otherField: 123,
          }),
        )

        await expect(client.createBookingV1(bookingRequest)).rejects.toThrow(
          'Booking creation returned unexpected response format',
        )
      })

      it('should continue if status update fails but booking was created', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
          status: 'tentative',
        }

        requestSpy
          .mockReturnValueOnce(Promise.resolve(999)) // Booking created successfully
          .mockReturnValueOnce(Promise.reject(new Error('Status update failed'))) // Status update fails

        const result = await client.createBookingV1(bookingRequest)

        // Should still return the booking despite status update failure
        expect(result.id).toBe(999)
        expect(result.status).toBe('tentative')
      })

      it('should handle network errors', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        requestSpy.mockReturnValue(Promise.reject(new Error('Network error: Connection timeout')))

        await expect(client.createBookingV1(bookingRequest)).rejects.toThrow(
          'Network error: Connection timeout',
        )
      })
    })

    describe('Name Parsing', () => {
      it('should parse single-word names correctly', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Madonna',
          adults: 1,
        }

        requestSpy.mockReturnValue(Promise.resolve(111))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.guest.guest_name).toEqual({
          first_name: 'Madonna',
          last_name: '',
        })
      })

      it('should parse multi-word names correctly', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Mary Jane Watson Parker',
          adults: 1,
        }

        requestSpy.mockReturnValue(Promise.resolve(222))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.guest.guest_name).toEqual({
          first_name: 'Mary',
          last_name: 'Jane Watson Parker',
        })
      })

      it('should handle names with extra whitespace', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: '  John   Doe  ',
          adults: 1,
        }

        requestSpy.mockReturnValue(Promise.resolve(333))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.guest.guest_name).toEqual({
          first_name: 'John',
          last_name: 'Doe',
        })
      })
    })

    describe('Status Mapping', () => {
      it('should map "booked" status correctly', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
          status: 'booked',
        }

        requestSpy.mockReturnValue(Promise.resolve(444))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.status).toBe('Booked')
      })

      it('should map "tentative" status correctly', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
          status: 'tentative',
        }

        requestSpy.mockReturnValue(Promise.resolve(555))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.status).toBe('Tentative')
      })

      it('should map "declined" status correctly', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
          status: 'declined',
        }

        requestSpy.mockReturnValue(Promise.resolve(666))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.status).toBe('Declined')
      })

      it('should default to "Booked" when no status provided', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 123,
          room_type_id: 456,
          arrival: '2025-06-01',
          departure: '2025-06-07',
          guest_name: 'Test Guest',
          adults: 2,
        }

        requestSpy.mockReturnValue(Promise.resolve(777))

        await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.status).toBe('Booked')
      })
    })

    describe('Real-World Use Cases', () => {
      it('should handle group booking with children and infants', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 98765,
          room_type_id: 54321,
          arrival: '2025-12-20',
          departure: '2025-12-27',
          guest_name: 'Family Robinson',
          guest_email: 'robinson@family.com',
          adults: 2,
          children: 3,
          infants: 1,
          source: 'Direct Website',
          notes: 'Need high chair and crib',
        }

        requestSpy.mockReturnValue(Promise.resolve(888999))

        const result = await client.createBookingV1(bookingRequest)

        const callArgs = requestSpy.mock.calls[0][2]
        expect(callArgs.body.rooms[0].guest_breakdown).toEqual({
          adults: 2,
          children: 3,
          infants: 1,
        })

        expect(result.id).toBe(888999)
      })

      it('should handle business traveler booking', async () => {
        const bookingRequest: CreateBookingV1Request = {
          property_id: 11111,
          room_type_id: 22222,
          arrival: '2025-03-10',
          departure: '2025-03-12',
          guest_name: 'James Corporate',
          guest_email: 'james@company.com',
          guest_phone: '+44-20-7123-4567',
          adults: 1,
          source: 'Corporate Portal',
        }

        requestSpy.mockReturnValue(Promise.resolve(333444))

        const result = await client.createBookingV1(bookingRequest)

        expect(result.id).toBe(333444)
        expect(result.adults).toBe(1)
      })

      it('should handle last-minute booking', async () => {
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dayAfter = new Date(today)
        dayAfter.setDate(dayAfter.getDate() + 2)

        const bookingRequest: CreateBookingV1Request = {
          property_id: 77777,
          room_type_id: 88888,
          arrival: tomorrow.toISOString().split('T')[0],
          departure: dayAfter.toISOString().split('T')[0],
          guest_name: 'Rush Booking',
          adults: 2,
          status: 'confirmed',
        }

        requestSpy.mockReturnValue(Promise.resolve(555777))

        const result = await client.createBookingV1(bookingRequest)

        expect(result.id).toBe(555777)
        expect(result.status).toBe('confirmed')
      })
    })
  })
})
