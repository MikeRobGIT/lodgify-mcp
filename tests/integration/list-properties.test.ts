/**
 * Tests for lodgify_list_properties MCP tool
 * Critical user-facing feature for browsing property inventory
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPropertyTools } from '../../src/mcp/tools/property-tools'
import { LodgifyOrchestrator } from '../../src/lodgify-orchestrator'
import type { ToolRegistration } from '../../src/mcp/utils/types'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

describe('lodgify_list_properties - Critical Property Management Feature', () => {
  let mockOrchestrator: LodgifyOrchestrator
  let tools: ToolRegistration[]
  let listPropertiesTool: ToolRegistration | undefined

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock orchestrator
    mockOrchestrator = {
      properties: {
        listProperties: vi.fn(),
      },
      isHealthy: true,
    } as unknown as LodgifyOrchestrator

    // Get tools
    tools = getPropertyTools(() => mockOrchestrator)
    listPropertiesTool = tools.find((t) => t.name === 'lodgify_list_properties')

    if (!listPropertiesTool) {
      throw new Error('lodgify_list_properties tool not found')
    }
  })

  describe('Property Listing Operations', () => {
    it('should list properties with default pagination', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: 12345,
            name: 'Beach Villa',
            internal_name: 'BV-001',
            address: { city: 'Miami', country: 'USA' },
            rooms: 3,
            max_guests: 6,
            status: 'active',
          },
          {
            id: 12346,
            name: 'Mountain Cabin',
            internal_name: 'MC-001',
            address: { city: 'Denver', country: 'USA' },
            rooms: 2,
            max_guests: 4,
            status: 'active',
          },
        ],
        pagination: {
          total: 2,
          page: 1,
          size: 50,
        },
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        page: 1,
        size: 50,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.operation).toEqual({
        type: 'list',
        entity: 'property',
        status: 'success',
        timestamp: expect.any(String),
      })
      expect(response.summary).toContain('Retrieved 2 properties')
      expect(response.data.data).toHaveLength(2)
      expect(response.data.items[0].name).toBe('Beach Villa')
      expect(response.suggestions).toContain('Use lodgify_get_property to view full details for a specific property')
    })

    it('should list properties with custom pagination', async () => {
      // Arrange
      const mockResponse = {
        data: Array(10).fill(null).map((_, i) => ({
          id: 100 + i,
          name: `Property ${i + 1}`,
          status: 'active',
        })),
        total: 100,
        page: 3,
        size: 10,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({
        page: 3,
        size: 10,
        includeCount: true,
      })

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        page: 3,
        size: 10,
        includeCount: true,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.total).toBe(100)
      expect(response.data.page).toBe(3)
      expect(response.data.size).toBe(10)
      expect(response.summary).toContain('Retrieved 10 properties')
      expect(response.details.propertyCount).toBe(10)
      expect(response.details.totalAvailable).toBe(100)
    })

    it('should filter properties by website ID', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: 777,
            name: 'Corporate Suite',
            website_id: 999,
            status: 'active',
          },
        ],
        total: 1,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({
        wid: 999,
      })

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        wid: 999,
        page: 1,
        size: 50,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.data).toHaveLength(1)
      expect(response.data.items[0].website_id).toBe(999)
    })

    it('should filter properties updated since a specific date', async () => {
      // Arrange
      const updatedSince = '2024-01-01T00:00:00Z'
      const mockResponse = {
        data: [
          {
            id: 888,
            name: 'Recently Updated Villa',
            updated_at: '2024-02-15T10:00:00Z',
          },
        ],
        total: 1,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({
        updatedSince,
      })

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        updatedSince,
        page: 1,
        size: 50,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.items[0].updated_at).toBe('2024-02-15T10:00:00Z')
      expect(response.summary).toContain('Retrieved 1 property')
    })

    it('should include arrival/departure availability dates when requested', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: 444,
            name: 'Availability Test Property',
            available_arrival_dates: ['2024-03-15', '2024-03-22'],
            available_departure_dates: ['2024-03-18', '2024-03-25'],
          },
        ],
        total: 1,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({
        includeInOut: true,
      })

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        includeInOut: true,
        page: 1,
        size: 50,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.items[0].available_arrival_dates).toEqual(['2024-03-15', '2024-03-22'])
      expect(response.data.items[0].available_departure_dates).toEqual(['2024-03-18', '2024-03-25'])
      expect(response.suggestions).toContain('Use lodgify_get_property_availability to check detailed availability')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty property list gracefully', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        total: 0,
        page: 1,
        size: 50,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.operation.status).toBe('success')
      expect(response.data.data).toEqual([])
      expect(response.summary).toContain('No properties found')
      expect(response.suggestions).toContain('Check your API configuration or filter parameters')
    })

    it('should handle properties with minimal data', async () => {
      // Arrange
      const mockResponse = {
        data: [
          { id: 1 }, // Minimal property with just ID
          { id: 2, name: 'Named Property' },
        ],
        total: 2,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.data.data).toHaveLength(2)
      expect(response.data.items[0].id).toBe(1)
      expect(response.data.items[1].name).toBe('Named Property')
    })

    it('should handle network timeout error', async () => {
      // Arrange
      ;(mockOrchestrator.properties.listProperties as any).mockRejectedValue(
        new Error('Network timeout')
      )

      // Act & Assert
      await expect(listPropertiesTool.handler({})).rejects.toThrow('Network timeout')
    })

    it('should handle API rate limiting (429)', async () => {
      // Arrange
      const rateLimitError = new McpError(
        ErrorCode.InternalError,
        'Rate limit exceeded. Please wait and try again.',
      )
      ;(mockOrchestrator.properties.listProperties as any).mockRejectedValue(rateLimitError)

      // Act & Assert
      await expect(listPropertiesTool.handler({})).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle invalid page number', async () => {
      // Arrange
      ;(mockOrchestrator.properties.listProperties as any).mockRejectedValue(
        new McpError(ErrorCode.InvalidParams, 'Invalid page number: page must be >= 1')
      )

      // Act & Assert
      await expect(listPropertiesTool.handler({ page: -1 })).rejects.toThrow('Invalid page number')
    })

    it('should handle invalid size parameter', async () => {
      // Arrange
      ;(mockOrchestrator.properties.listProperties as any).mockRejectedValue(
        new McpError(ErrorCode.InvalidParams, 'Invalid size: must be between 1 and 50')
      )

      // Act & Assert
      await expect(listPropertiesTool.handler({ size: 100 })).rejects.toThrow('Invalid size')
    })

    it('should handle properties with complex nested data', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: 55555,
            name: 'Luxury Estate',
            internal_name: 'LE-001',
            description: 'A beautiful luxury estate with ocean views',
            address: {
              street: '123 Ocean Drive',
              city: 'Malibu',
              state: 'California',
              country: 'USA',
              postal_code: '90265',
            },
            amenities: ['Pool', 'Hot Tub', 'Beach Access', 'WiFi'],
            rooms: 5,
            max_guests: 12,
            min_stay: 3,
            pricing: {
              base_rate: 1500,
              currency: 'USD',
              weekend_multiplier: 1.25,
            },
            images: [
              { url: 'https://example.com/image1.jpg', caption: 'Front view' },
              { url: 'https://example.com/image2.jpg', caption: 'Pool area' },
            ],
            status: 'active',
            created_at: '2023-01-15T08:00:00Z',
            updated_at: '2024-03-10T14:30:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 50,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.data.items[0].address.city).toBe('Malibu')
      expect(response.data.items[0].amenities).toContain('Pool')
      expect(response.data.items[0].pricing.base_rate).toBe(1500)
      expect(response.data.items[0].images).toHaveLength(2)
      expect(response.details.propertyCount).toBe(1)
      expect(response.details.properties[0].id).toBe(55555)
      expect(response.details.properties[0].name).toBe('Luxury Estate')
    })

    it('should handle malformed API response gracefully', async () => {
      // Arrange
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(
        'invalid response' as any
      )

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      // Should still return something, even if the data is malformed
      expect(response.operation.type).toBe('list')
      expect(response.operation.entity).toBe('property')
    })

    it('should handle properties with special characters in names', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            id: 99999,
            name: "L'Appartement Élégant à Paris",
            internal_name: 'Côte d\'Azur #1',
            description: 'Magnifique propriété avec vue sur la Méditerranée',
          },
        ],
        total: 1,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.data.items[0].name).toBe("L'Appartement Élégant à Paris")
      expect(response.data.items[0].internal_name).toBe('Côte d\'Azur #1')
    })

    it('should handle combination of all optional parameters', async () => {
      // Arrange
      const mockResponse = {
        data: Array(5).fill(null).map((_, i) => ({
          id: 2000 + i,
          name: `Combined Test Property ${i}`,
          updated_at: '2024-02-01T00:00:00Z',
          website_id: 777,
          available_arrival_dates: ['2024-04-01'],
          available_departure_dates: ['2024-04-05'],
        })),
        total: 5,
        page: 2,
        size: 5,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({
        wid: 777,
        updatedSince: '2024-01-01T00:00:00Z',
        includeCount: true,
        includeInOut: true,
        page: 2,
        size: 5,
      })

      // Assert
      expect(mockOrchestrator.properties.listProperties).toHaveBeenCalledWith({
        wid: 777,
        updatedSince: '2024-01-01T00:00:00Z',
        includeCount: true,
        includeInOut: true,
        page: 2,
        size: 5,
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.total).toBe(5)
      expect(response.data.page).toBe(2)
      expect(response.data.size).toBe(5)
      expect(response.data.data).toHaveLength(5)
      expect(response.data.items[0].available_arrival_dates).toBeDefined()
      expect(response.summary).toContain('Retrieved 5 properties')
    })
  })

  describe('User Experience and Business Value', () => {
    it('should provide helpful suggestions for property managers', async () => {
      // Arrange
      const mockResponse = {
        data: [
          { id: 1, name: 'Test Property', status: 'inactive' },
        ],
        total: 1,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.suggestions).toBeInstanceOf(Array)
      expect(response.suggestions.some((s: string) =>
        s.includes('lodgify_get_property') ||
        s.includes('availability') ||
        s.includes('bookings')
      )).toBe(true)
    })

    it('should extract property details for summary', async () => {
      // Arrange
      const mockResponse = {
        data: [
          { id: 1, name: 'Beach House', status: 'active', rooms: 3 },
          { id: 2, name: 'City Apartment', status: 'active', rooms: 1 },
          { id: 3, name: 'Mountain Lodge', status: 'inactive', rooms: 4 },
        ],
        total: 3,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({ includeCount: true })

      // Assert
      const response = JSON.parse(result.content[0].text)
      expect(response.details.propertyCount).toBe(3)
      expect(response.details.properties).toHaveLength(3)
      expect(response.details.properties[0]).toHaveProperty('id')
      expect(response.details.properties[0]).toHaveProperty('name')
      expect(response.details.totalAvailable).toBe(3)
    })

    it('should handle properties essential for operational decisions', async () => {
      // Arrange - Properties with different statuses affecting operations
      const mockResponse = {
        data: [
          {
            id: 1001,
            name: 'High Season Villa',
            status: 'active',
            min_stay: 7,
            max_guests: 8,
            base_rate: 500,
          },
          {
            id: 1002,
            name: 'Maintenance Property',
            status: 'maintenance',
            min_stay: 2,
            max_guests: 4,
            base_rate: 200,
          },
        ],
        total: 2,
      }
      ;(mockOrchestrator.properties.listProperties as any).mockResolvedValue(mockResponse)

      // Act
      const result = await listPropertiesTool.handler({})

      // Assert
      const response = JSON.parse(result.content[0].text)

      // Verify operational data is preserved
      expect(response.data.items[0].min_stay).toBe(7)
      expect(response.data.items[0].max_guests).toBe(8)
      expect(response.data.items[1].status).toBe('maintenance')

      // Should provide operational context
      expect(response.operation.status).toBe('success')
      expect(response.summary).toContain('2 properties')
    })
  })
})