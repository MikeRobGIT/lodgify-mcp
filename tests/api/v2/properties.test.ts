import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { BaseApiClient } from '../../../src/api/base-client.js'
import { PropertiesClient } from '../../../src/api/v2/properties/index.js'
import type { PropertiesListResponse, Property } from '../../../src/api/v2/properties/types.js'

// Test client implementation
class TestApiClient extends BaseApiClient {
  constructor() {
    super('test-api-key')
  }
}

describe('PropertiesClient', () => {
  let client: TestApiClient
  let propertiesClient: PropertiesClient
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new TestApiClient()
    propertiesClient = new PropertiesClient(client)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('listProperties', () => {
    test('should list properties with proper response format', async () => {
      const mockProperties: Property[] = [
        { id: '1', name: 'Beach House', type: 'house', status: 'active' },
        { id: '2', name: 'City Apartment', type: 'apartment', status: 'active' },
      ]

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockProperties), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.listProperties()

      expect(result).toEqual({
        data: mockProperties,
        count: 2,
      })
    })

    test('should handle wrapped response format', async () => {
      const mockResponse: PropertiesListResponse = {
        data: [{ id: '1', name: 'Beach House', type: 'house' }],
        count: 1,
        pagination: {
          limit: 10,
          offset: 0,
          total: 1,
        },
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.listProperties()

      expect(result).toEqual(mockResponse)
    })

    test('should pass search parameters', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      await propertiesClient.listProperties({
        limit: 10,
        offset: 0,
        status: 'active',
        type: 'house',
        city: 'Miami',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/properties'),
        expect.objectContaining({
          method: 'GET',
        }),
      )
    })
  })

  describe('getProperty', () => {
    test('should get property by ID', async () => {
      const mockProperty: Property = {
        id: '123',
        name: 'Ocean View Villa',
        type: 'villa',
        status: 'active',
        location: {
          city: 'Miami',
          state: 'FL',
          country: 'USA',
        },
        amenities: [
          { id: 'wifi', name: 'WiFi' },
          { id: 'pool', name: 'Pool' },
        ],
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockProperty), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.getProperty('123')

      expect(result).toEqual(mockProperty)
    })

    test('should throw error if ID is missing', async () => {
      await expect(propertiesClient.getProperty('')).rejects.toThrow('Property ID is required')
    })
  })

  describe('listPropertyRooms', () => {
    test('should list property rooms', async () => {
      const mockRooms = [
        { id: '1', name: 'Master Suite', maxOccupancy: 2, beds: 1 },
        { id: '2', name: 'Guest Room', maxOccupancy: 2, beds: 2 },
      ]

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockRooms), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.listPropertyRooms('123')

      expect(result).toEqual(mockRooms)
    })

    test('should handle wrapped room response', async () => {
      const mockResponse = {
        data: [{ id: '1', name: 'Master Suite', maxOccupancy: 2 }],
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.listPropertyRooms('123')

      expect(result).toEqual(mockResponse.data)
    })

    test('should throw error if property ID is missing', async () => {
      await expect(propertiesClient.listPropertyRooms('')).rejects.toThrow(
        'Property ID is required',
      )
    })
  })

  describe('listDeletedProperties', () => {
    test('should list deleted properties', async () => {
      const mockDeleted: Property[] = [{ id: '10', name: 'Deleted Villa', status: 'deleted' }]

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockDeleted), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.listDeletedProperties()

      expect(result).toEqual({
        data: mockDeleted,
        count: 1,
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/deletedProperties'),
        expect.anything(),
      )
    })
  })

  describe('findProperties', () => {
    test('should find properties by search term', async () => {
      const mockProperties = [
        { id: '1', name: 'Beach House Miami' },
        { id: '2', name: 'Miami Downtown Loft' },
        { id: '3', name: 'New York Apartment' },
      ]

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockProperties), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.findProperties('miami', false, 5)

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0].name).toContain('Miami')
      expect(result.properties[1].name).toContain('Miami')
      expect(result.message).toContain('Found 2 property(ies) matching "miami"')
    })

    test('should include bookings in search when specified', async () => {
      let callCount = 0
      global.fetch = mock(() => {
        callCount++
        if (callCount === 1) {
          // Properties response
          return Promise.resolve(
            new Response(JSON.stringify([{ id: '1', name: 'Beach House' }]), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          )
        } else {
          // Bookings response
          return Promise.resolve(
            new Response(JSON.stringify([{ propertyId: '2', propertyName: 'Ocean Villa' }]), {
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
            }),
          )
        }
      })

      const result = await propertiesClient.findProperties('', true, 5)

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0].source).toBe('properties')
      expect(result.properties[1].source).toBe('bookings')
      expect(result.properties[1].name).toContain('(from booking)')
    })

    test('should provide suggestions when no properties found', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.findProperties('nonexistent', false)

      expect(result.properties).toHaveLength(0)
      expect(result.suggestions).toBeDefined()
      expect(result.suggestions).toContain('Try a different search term')
    })

    test('should handle errors gracefully', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')))

      await expect(propertiesClient.findProperties('test')).rejects.toThrow(
        'Failed to find properties',
      )
    })
  })

  describe('updatePropertyAvailability', () => {
    test('should update property availability', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.updatePropertyAvailability('123', {
        from: '2024-01-01',
        to: '2024-01-31',
        available: false,
        minStay: 3,
        maxStay: 14,
      })

      expect(result).toEqual({ success: true })
    })

    test('should throw error if property ID is missing', async () => {
      await expect(
        propertiesClient.updatePropertyAvailability('', {
          from: '2024-01-01',
          to: '2024-01-31',
          available: false,
        }),
      ).rejects.toThrow('Property ID is required')
    })
  })

  describe('getPropertyStatistics', () => {
    test('should get property statistics', async () => {
      const mockStats = {
        occupancyRate: 0.75,
        averagePrice: 150,
        totalBookings: 25,
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockStats), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await propertiesClient.getPropertyStatistics('123', {
        from: '2024-01-01',
        to: '2024-12-31',
        metrics: ['occupancy', 'revenue'],
      })

      expect(result).toEqual(mockStats)
    })

    test('should throw error if property ID is missing', async () => {
      await expect(propertiesClient.getPropertyStatistics('')).rejects.toThrow(
        'Property ID is required',
      )
    })
  })
})
