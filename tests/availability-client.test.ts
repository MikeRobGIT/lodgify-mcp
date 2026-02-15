/**
 * AvailabilityClient Tests
 *
 * Critical user-facing feature test for property availability checking.
 * Users depend on this to verify if properties are available before booking.
 */

import { describe, expect, it, beforeEach, jest } from 'bun:test'
import { AvailabilityClient } from '../src/api/v2/availability/client'
import type { BaseApiClient } from '../src/api/base-client'
import type { AvailabilityQueryParams } from '../src/api/v2/availability/types'

describe('AvailabilityClient - Critical user-facing availability checking', () => {
  let mockClient: BaseApiClient
  let availabilityClient: AvailabilityClient

  beforeEach(() => {
    // Create a mock base client
    mockClient = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      getApiKey: () => 'test-key',
      getBaseUrl: () => 'https://api.lodgify.com',
      isReadOnly: () => false,
    } as unknown as BaseApiClient

    availabilityClient = new AvailabilityClient(mockClient)
  })

  describe('getAvailabilityForProperty - Most critical user-facing feature', () => {
    it('should check property availability for specific dates', async () => {
      // User scenario: Check if property is available for vacation dates
      const mockResponse = {
        property_id: 'PROP123',
        periods: [
          {
            start: '2025-08-01',
            end: '2025-08-10',
            available: 1,
            min_stay: 3,
            changeover: 'flexible'
          },
          {
            start: '2025-08-11',
            end: '2025-08-20',
            available: 0,
            bookingId: 'BK456'
          }
        ]
      }

      // Mock the base module's request method
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        {
          from: '2025-08-01',
          to: '2025-08-20'
        }
      )

      // Verify the API was called correctly
      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', {
        params: {
          start: '2025-08-01T00:00:00Z',
          end: '2025-08-20T23:59:59Z',
          includeDetails: true
        }
      })

      expect(result).toEqual(mockResponse)
      expect(result.periods[0].available).toBe(1) // Available
      expect(result.periods[1].available).toBe(0) // Not available
    })

    it('should handle date format normalization (ISO 8601 to YYYY-MM-DD)', async () => {
      // User provides ISO 8601 dates, system should handle them
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ periods: [] })

      await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        {
          from: '2025-08-01T10:00:00Z',
          to: '2025-08-20T18:00:00Z'
        }
      )

      // Should preserve ISO dates when already in that format
      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', {
        params: {
          start: '2025-08-01T10:00:00Z',
          end: '2025-08-20T18:00:00Z',
          includeDetails: true
        }
      })
    })

    it('should check availability without date range', async () => {
      // User wants to see general availability
      const mockResponse = {
        property_id: 'PROP123',
        status: 'active',
        default_availability: 'available'
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityForProperty('PROP123')

      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', { params: {} })
      expect(result).toEqual(mockResponse)
    })

    it('should handle partial date ranges (only from date)', async () => {
      // User wants availability from a specific date onward
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ periods: [] })

      await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        { from: '2025-08-01' }
      )

      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', {
        params: {
          start: '2025-08-01T00:00:00Z'
          // No end date, no includeDetails
        }
      })
    })

    it('should handle partial date ranges (only to date)', async () => {
      // User wants availability up to a specific date
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ periods: [] })

      await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        { to: '2025-08-20' }
      )

      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', {
        params: {
          end: '2025-08-20T23:59:59Z'
          // No start date, no includeDetails
        }
      })
    })

    it('should throw error when property ID is missing', async () => {
      // Safety check for required parameter
      await expect(
        availabilityClient.getAvailabilityForProperty('', { from: '2025-08-01' })
      ).rejects.toThrow('Property ID is required')
    })

    it('should handle API errors gracefully', async () => {
      // User sees helpful error when API fails
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockRejectedValue(new Error('API Error: Property not found'))

      await expect(
        availabilityClient.getAvailabilityForProperty('INVALID', {
          from: '2025-08-01',
          to: '2025-08-20'
        })
      ).rejects.toThrow('API Error: Property not found')
    })

    it('should handle complex availability response with booking details', async () => {
      // Real-world scenario with mix of available and booked periods
      const mockResponse = {
        property_id: 'PROP123',
        periods: [
          {
            start: '2025-08-01',
            end: '2025-08-05',
            available: 1,
            min_stay: 2,
            changeover: 'saturday',
            rate: 150.00
          },
          {
            start: '2025-08-06',
            end: '2025-08-10',
            available: 0,
            bookingId: 'BK789',
            guestName: 'John Doe'
          },
          {
            start: '2025-08-11',
            end: '2025-08-15',
            available: 1,
            min_stay: 3,
            changeover: 'flexible',
            rate: 175.00
          }
        ],
        totalAvailableDays: 10,
        totalBookedDays: 5
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        {
          from: '2025-08-01',
          to: '2025-08-15'
        }
      )

      expect(result.periods).toHaveLength(3)
      expect(result.periods.filter(p => p.available === 1)).toHaveLength(2)
      expect(result.periods.filter(p => p.available === 0)).toHaveLength(1)
      expect(result.totalAvailableDays).toBe(10)
    })
  })

  describe('getAvailabilityForRoom - Room-specific availability', () => {
    it('should check availability for specific room type', async () => {
      // User needs to check if a specific room in a property is available
      const mockResponse = {
        property_id: 'PROP123',
        room_type_id: 'ROOM456',
        room_name: 'Deluxe Suite',
        periods: [
          {
            start: '2025-08-01',
            end: '2025-08-10',
            available: 1,
            units_available: 2
          }
        ]
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityForRoom(
        'PROP123',
        'ROOM456',
        {
          from: '2025-08-01',
          to: '2025-08-10'
        }
      )

      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123/ROOM456', {
        params: {
          start: '2025-08-01T00:00:00Z',
          end: '2025-08-10T23:59:59Z',
          includeDetails: true
        }
      })

      expect(result.room_type_id).toBe('ROOM456')
      expect(result.periods[0].units_available).toBe(2)
    })

    it('should throw error when room type ID is missing', async () => {
      await expect(
        availabilityClient.getAvailabilityForRoom('PROP123', '')
      ).rejects.toThrow('Property ID and Room Type ID are required')
    })

    it('should throw error when property ID is missing', async () => {
      await expect(
        availabilityClient.getAvailabilityForRoom('', 'ROOM456')
      ).rejects.toThrow('Property ID and Room Type ID are required')
    })
  })

  describe('getAvailabilityAll - Multi-property availability', () => {
    it('should get availability for all properties with date filter', async () => {
      // User wants to see all available properties for their dates
      const mockResponse = {
        properties: [
          {
            property_id: 'PROP1',
            name: 'Beach House',
            available: true
          },
          {
            property_id: 'PROP2',
            name: 'Mountain Cabin',
            available: false
          }
        ],
        total_available: 1,
        total_properties: 2
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityAll({
        from: '2025-08-01',
        to: '2025-08-10'
      })

      expect(requestSpy).toHaveBeenCalledWith('GET', '', {
        params: {
          start: '2025-08-01T00:00:00Z',
          end: '2025-08-10T23:59:59Z',
          includeDetails: true
        }
      })

      expect(result.total_available).toBe(1)
      expect(result.properties.filter(p => p.available)).toHaveLength(1)
    })

    it('should filter by specific property when requested', async () => {
      // User wants availability for specific property through general endpoint
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ properties: [] })

      await availabilityClient.getAvailabilityAll({
        propertyId: 'PROP123',
        from: '2025-08-01',
        to: '2025-08-10'
      })

      expect(requestSpy).toHaveBeenCalledWith('GET', '', {
        params: {
          propertyId: 'PROP123',
          start: '2025-08-01T00:00:00Z',
          end: '2025-08-10T23:59:59Z',
          includeDetails: true
        }
      })
    })

    it('should filter by room type when requested', async () => {
      // User wants to find available rooms of specific type
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ rooms: [] })

      await availabilityClient.getAvailabilityAll({
        roomTypeId: 'ROOM456',
        from: '2025-08-01',
        to: '2025-08-10'
      })

      expect(requestSpy).toHaveBeenCalledWith('GET', '', {
        params: {
          roomTypeId: 'ROOM456',
          start: '2025-08-01T00:00:00Z',
          end: '2025-08-10T23:59:59Z',
          includeDetails: true
        }
      })
    })

    it('should handle no parameters (get all availability)', async () => {
      // User wants general availability overview
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ properties: [] })

      await availabilityClient.getAvailabilityAll()

      expect(requestSpy).toHaveBeenCalledWith('GET', '', {})
    })
  })

  describe('updatePropertyAvailability - Modify availability settings', () => {
    it('should update property availability settings', async () => {
      // Property manager blocks dates for maintenance
      const payload = {
        periods: [
          {
            start: '2025-08-15',
            end: '2025-08-17',
            available: false,
            reason: 'Maintenance'
          }
        ]
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(undefined)

      await availabilityClient.updatePropertyAvailability('PROP123', payload)

      expect(requestSpy).toHaveBeenCalledWith(
        'PUT',
        '../properties/PROP123/availability',
        { body: payload }
      )
    })

    it('should throw error when property ID is missing', async () => {
      await expect(
        availabilityClient.updatePropertyAvailability('', { periods: [] })
      ).rejects.toThrow('Property ID is required')
    })

    it('should throw error when payload is missing', async () => {
      await expect(
        availabilityClient.updatePropertyAvailability('PROP123', null as any)
      ).rejects.toThrow('Payload is required')
    })

    it('should throw error when payload is not an object', async () => {
      await expect(
        availabilityClient.updatePropertyAvailability('PROP123', 'invalid' as any)
      ).rejects.toThrow('Payload is required')
    })

    it('should handle complex availability updates', async () => {
      // Real-world scenario: Update multiple periods with different settings
      const payload = {
        periods: [
          {
            start: '2025-08-01',
            end: '2025-08-05',
            available: true,
            min_stay: 2,
            changeover: 'saturday'
          },
          {
            start: '2025-08-06',
            end: '2025-08-10',
            available: false,
            reason: 'Owner use'
          },
          {
            start: '2025-08-11',
            end: '2025-08-31',
            available: true,
            min_stay: 7,
            changeover: 'flexible'
          }
        ],
        default_min_stay: 3,
        default_changeover: 'flexible'
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ success: true })

      await availabilityClient.updatePropertyAvailability('PROP123', payload)

      const callArgs = requestSpy.mock.calls[0]
      expect(callArgs[0]).toBe('PUT')
      expect(callArgs[2].body).toEqual(payload)
      expect(callArgs[2].body.periods).toHaveLength(3)
    })
  })

  describe('Edge cases and error scenarios', () => {
    it('should handle empty availability response', async () => {
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({})

      const result = await availabilityClient.getAvailabilityForProperty('PROP123')
      expect(result).toEqual({})
    })

    it('should handle network timeout', async () => {
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockRejectedValue(new Error('Request timeout'))

      await expect(
        availabilityClient.getAvailabilityForProperty('PROP123')
      ).rejects.toThrow('Request timeout')
    })

    it('should handle malformed date in response', async () => {
      // API returns unexpected date format
      const mockResponse = {
        periods: [{
          start: '08/01/2025', // Wrong format
          end: '08/10/2025',
          available: 1
        }]
      }

      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue(mockResponse)

      const result = await availabilityClient.getAvailabilityForProperty('PROP123')

      // Client should pass through whatever API returns
      expect(result.periods[0].start).toBe('08/01/2025')
    })

    it('should handle very long date ranges', async () => {
      // User checks availability for entire year
      const requestSpy = jest.spyOn(availabilityClient as any, 'request')
      requestSpy.mockResolvedValue({ periods: [] })

      await availabilityClient.getAvailabilityForProperty(
        'PROP123',
        {
          from: '2025-01-01',
          to: '2025-12-31'
        }
      )

      expect(requestSpy).toHaveBeenCalledWith('GET', 'PROP123', {
        params: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-12-31T23:59:59Z',
          includeDetails: true
        }
      })
    })
  })
})