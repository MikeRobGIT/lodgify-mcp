/**
 * Tests for Helper Tools Module
 * Tests property discovery functionality that helps users find properties
 * when they don't know the exact property IDs
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { findProperties } from '../src/mcp/tools/helper-tools.js'

// Create mock client with realistic API responses
function createMockClient(options: {
  properties?: Array<{ id: string | number; name?: string; internal_name?: string; title?: string }>
  bookings?: Array<{ id?: string; property_id?: string | number; property_name?: string }>
  propertiesError?: Error
  bookingsError?: Error
}): LodgifyOrchestrator {
  return {
    properties: {
      listProperties: async () => {
        if (options.propertiesError) {
          throw options.propertiesError
        }
        // Mimic real Lodgify v2 API response structure
        return {
          data: [
            {
              count: null,
              items: options.properties || [],
            },
          ],
        }
      },
    },
    bookings: {
      listBookings: async () => {
        if (options.bookingsError) {
          throw options.bookingsError
        }
        return {
          items: options.bookings || [],
        }
      },
    },
  } as unknown as LodgifyOrchestrator
}

describe('findProperties - User-facing property discovery', () => {
  describe('Finding properties by name', () => {
    it('should find properties matching search term (case-insensitive)', async () => {
      // This tests a common user scenario: searching for a property by partial name
      const mockClient = createMockClient({
        properties: [
          { id: 123, name: 'Beach House Villa' },
          { id: 456, name: 'Mountain Cabin Retreat' },
          { id: 789, name: 'City Beach Apartment' },
        ],
      })

      const result = await findProperties(mockClient, 'beach')

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0]).toEqual({
        id: '123',
        name: 'Beach House Villa',
        source: 'properties',
      })
      expect(result.properties[1]).toEqual({
        id: '789',
        name: 'City Beach Apartment',
        source: 'properties',
      })
      expect(result.message).toBe('Found 2 property(ies) matching "beach"')
      expect(result.suggestions).toContain(
        'Use one of these property IDs with availability tools like lodgify_get_property_availability',
      )
    })

    it('should return all properties when no search term provided', async () => {
      // Tests the scenario where user wants to see all available properties
      const mockClient = createMockClient({
        properties: [
          { id: 123, name: 'Beach House' },
          { id: 456, name: 'Mountain Cabin' },
          { id: 789, name: 'City Apartment' },
        ],
      })

      const result = await findProperties(mockClient, undefined, true, 10)

      expect(result.properties).toHaveLength(3)
      expect(result.message).toBe('Found 3 property(ies)')
    })

    it('should respect limit parameter', async () => {
      // Tests pagination - important for users with many properties
      const mockClient = createMockClient({
        properties: [
          { id: 1, name: 'Property 1' },
          { id: 2, name: 'Property 2' },
          { id: 3, name: 'Property 3' },
          { id: 4, name: 'Property 4' },
          { id: 5, name: 'Property 5' },
        ],
      })

      const result = await findProperties(mockClient, undefined, true, 3)

      expect(result.properties).toHaveLength(3)
      expect(result.properties.map((p) => p.id)).toEqual(['1', '2', '3'])
    })
  })

  describe('Handling different property name fields', () => {
    it('should use internal_name when name is not available', async () => {
      // Tests fallback to internal_name field
      const mockClient = createMockClient({
        properties: [
          { id: 123, internal_name: 'Villa Internal Name' },
          { id: 456, name: 'Normal Property Name' },
        ],
      })

      const result = await findProperties(mockClient)

      expect(result.properties[0].name).toBe('Villa Internal Name')
      expect(result.properties[1].name).toBe('Normal Property Name')
    })

    it('should use title as fallback when name and internal_name are not available', async () => {
      // Tests fallback to title field
      const mockClient = createMockClient({
        properties: [
          { id: 123, title: 'Villa Title' },
          { id: 456 }, // No name at all
        ],
      })

      const result = await findProperties(mockClient)

      expect(result.properties[0].name).toBe('Villa Title')
      expect(result.properties[1].name).toBe('Property 456')
    })
  })

  describe('Discovering properties from bookings', () => {
    it('should include property IDs from recent bookings when properties API is empty', async () => {
      // Tests important fallback: finding properties through bookings when direct listing fails
      const mockClient = createMockClient({
        properties: [],
        bookings: [
          { id: 'BK001', property_id: 999 },
          { id: 'BK002', property_id: 888 },
          { id: 'BK003', property_id: 777 },
        ],
      })

      const result = await findProperties(mockClient, undefined, true)

      expect(result.properties).toHaveLength(3)
      expect(result.properties[0]).toEqual({
        id: '999',
        name: 'Property 999',
        source: 'bookings',
      })
    })

    it('should not include duplicate property IDs from bookings', async () => {
      // Tests deduplication logic - important for data quality
      const mockClient = createMockClient({
        properties: [{ id: 123, name: 'Beach House' }],
        bookings: [
          { id: 'BK001', property_id: 123 }, // Duplicate
          { id: 'BK002', property_id: 456 },
          { id: 'BK003', property_id: 456 }, // Another duplicate
        ],
      })

      const result = await findProperties(mockClient, undefined, true)

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0].id).toBe('123')
      expect(result.properties[1].id).toBe('456')
    })

    it('should skip booking discovery when includePropertyIds is false', async () => {
      // Tests configuration option - user might want only direct property listings
      const mockClient = createMockClient({
        properties: [],
        bookings: [{ id: 'BK001', property_id: 999 }],
      })

      const result = await findProperties(mockClient, undefined, false)

      expect(result.properties).toHaveLength(0)
      expect(result.message).toBe('No properties found')
    })
  })

  describe('Error handling and user guidance', () => {
    it('should handle properties API failure gracefully', async () => {
      // Tests resilience when properties API fails but bookings work
      const mockClient = createMockClient({
        propertiesError: new Error('API Error'),
        bookings: [{ id: 'BK001', property_id: 555 }],
      })

      const result = await findProperties(mockClient, undefined, true)

      expect(result.properties).toHaveLength(1)
      expect(result.properties[0].id).toBe('555')
      expect(result.suggestions).toContain('Property list API may not be available or accessible')
    })

    it('should handle both APIs failing with helpful message', async () => {
      // Tests complete failure scenario - guides user to troubleshoot
      const mockClient = createMockClient({
        propertiesError: new Error('Properties API Error'),
        bookingsError: new Error('Bookings API Error'),
      })

      const result = await findProperties(mockClient, undefined, true)

      expect(result.properties).toHaveLength(0)
      expect(result.message).toBe('No properties found')
      expect(result.suggestions).toContain('Property list API may not be available or accessible')
      expect(result.suggestions).toContain('Could not retrieve property IDs from bookings')
      expect(result.suggestions).toContain(
        'No properties found. Try using lodgify_list_properties to see all properties.',
      )
    })

    it('should provide helpful suggestions when no properties found with search term', async () => {
      // Tests user guidance when search yields no results
      const mockClient = createMockClient({
        properties: [
          { id: 123, name: 'Beach House' },
          { id: 456, name: 'Mountain Cabin' },
        ],
      })

      const result = await findProperties(mockClient, 'ocean')

      expect(result.properties).toHaveLength(0)
      expect(result.message).toBe('No properties found matching "ocean"')
      expect(result.suggestions).toContain(
        'No properties found. Try using lodgify_list_properties to see all properties.',
      )
    })
  })

  describe('Handling different API response formats', () => {
    it('should handle direct array response format', async () => {
      // Tests compatibility with different API response structures
      const mockClient = {
        properties: {
          listProperties: async () => [
            { id: 123, name: 'Beach House' },
            { id: 456, name: 'Mountain Cabin' },
          ],
        },
        bookings: {
          listBookings: async () => ({ items: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const result = await findProperties(mockClient)

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0].name).toBe('Beach House')
    })

    it('should handle direct items array format', async () => {
      // Tests another possible API response format
      const mockClient = {
        properties: {
          listProperties: async () => ({
            items: [
              { id: 123, name: 'Beach House' },
              { id: 456, name: 'Mountain Cabin' },
            ],
          }),
        },
        bookings: {
          listBookings: async () => ({ items: [] }),
        },
      } as unknown as LodgifyOrchestrator

      const result = await findProperties(mockClient)

      expect(result.properties).toHaveLength(2)
      expect(result.properties[0].name).toBe('Beach House')
    })
  })
})
