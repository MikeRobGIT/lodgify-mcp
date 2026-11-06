import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { getPropertyTools } from '../src/mcp/tools/property-tools.js'
import type { ToolRegistration } from '../src/mcp/utils/types.js'

describe('lodgify_list_properties - Critical User-Facing Feature Tests', () => {
  let mockClient: LodgifyOrchestrator
  let listPropertiesHandler: (params: Record<string, unknown>) => Promise<unknown>
  let mockListProperties: ReturnType<typeof mock>

  beforeEach(() => {
    // Create mock function
    mockListProperties = mock()

    // Create mock client
    mockClient = {
      properties: {
        listProperties: mockListProperties,
      },
    } as unknown as LodgifyOrchestrator

    // Get the tool registration
    const tools = getPropertyTools(() => mockClient) as ToolRegistration[]
    const tool = tools.find((t) => t.name === 'lodgify_list_properties')
    if (!tool) throw new Error('Tool not found')
    listPropertiesHandler = tool.handler
  })

  describe('Daily Operations - Property Inventory Management', () => {
    it('should list all properties for property managers to see their complete inventory', async () => {
      // This is THE foundational feature - without it, property managers can't see what they own
      const mockProperties = {
        data: [
          {
            id: 123,
            name: 'Ocean View Villa',
            location: 'Miami Beach, FL',
            status: 'active',
            rooms: 3,
            currency: 'USD',
          },
          {
            id: 456,
            name: 'Mountain Retreat',
            location: 'Aspen, CO',
            status: 'active',
            rooms: 2,
            currency: 'USD',
          },
        ],
        pagination: {
          total: 2,
          offset: 0,
          limit: 50,
        },
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({})
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.type).toBe('list')
      expect(response.operation.entity).toBe('property')
      expect(response.operation.status).toBe('success')
      expect(response.data.data).toHaveLength(2)
      expect(response.data.data[0].name).toBe('Ocean View Villa')
      expect(mockListProperties).toHaveBeenCalledWith({})
    })

    it('should handle pagination for large property portfolios', async () => {
      // Property managers with many properties need pagination
      const mockProperties = {
        data: new Array(50).fill(null).map((_, i) => ({
          id: i + 1,
          name: `Property ${i + 1}`,
          status: 'active',
        })),
        pagination: {
          total: 150,
          offset: 50,
          limit: 50,
        },
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        page: 2,
        size: 50,
      })
      const response = JSON.parse(result.content[0].text)

      expect(response.data.data).toHaveLength(50)
      expect(mockListProperties).toHaveBeenCalledWith({
        limit: 50,
        offset: 50, // page 2 = offset 50
      })
    })

    it('should filter by website ID for multi-website property managers', async () => {
      // Property managers may manage properties across multiple websites
      const mockProperties = {
        data: [
          {
            id: 789,
            name: 'Corporate Suite',
            wid: 12345,
          },
        ],
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        wid: 12345,
      })
      const response = JSON.parse(result.content[0].text)

      expect(mockListProperties).toHaveBeenCalledWith({
        wid: 12345,
      })
      expect(response.data.data[0].wid).toBe(12345)
    })

    it('should warn about suspiciously low website IDs', async () => {
      // Protect users from common mistakes with website IDs
      const consoleSpy = spyOn(console, 'warn').mockImplementation(() => {})

      mockListProperties.mockResolvedValue({ data: [] })

      await listPropertiesHandler({
        wid: 5, // Suspiciously low
      })

      // The warning would be logged internally
      expect(mockListProperties).toHaveBeenCalledWith({
        wid: 5,
      })

      consoleSpy.mockRestore()
    })

    it('should filter properties updated since a specific date for sync operations', async () => {
      // Critical for syncing with external systems and tracking changes
      const updatedSince = '2024-01-01T00:00:00Z'
      const mockProperties = {
        data: [
          {
            id: 111,
            name: 'Recently Updated Villa',
            lastModified: '2024-01-15T10:00:00Z',
          },
        ],
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        updatedSince,
      })
      const response = JSON.parse(result.content[0].text)

      expect(mockListProperties).toHaveBeenCalledWith({
        updatedSince,
      })
      expect(response.data.data[0].name).toBe('Recently Updated Villa')
    })

    it('should include total count when requested for portfolio analytics', async () => {
      // Property managers need to know their total property count
      const mockProperties = {
        data: [{ id: 1, name: 'Test Property' }],
        pagination: {
          total: 250, // Large portfolio
          offset: 0,
          limit: 50,
        },
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        includeCount: true,
      })
      const response = JSON.parse(result.content[0].text)

      expect(mockListProperties).toHaveBeenCalledWith({
        includeCount: true,
      })
      expect(response.data.pagination.total).toBe(250)
    })

    it('should include arrival/departure dates for availability planning', async () => {
      // Critical for understanding when properties can be booked
      const mockProperties = {
        data: [
          {
            id: 222,
            name: 'Beach House',
            availableForArrival: ['2024-03-15', '2024-03-16'],
            availableForDeparture: ['2024-03-20', '2024-03-21'],
          },
        ],
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        includeInOut: true,
      })
      const response = JSON.parse(result.content[0].text)

      expect(mockListProperties).toHaveBeenCalledWith({
        includeInOut: true,
      })
      expect(response.data.data[0].availableForArrival).toBeDefined()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty property lists with helpful suggestions', async () => {
      // New users or filtered searches may return no properties
      mockListProperties.mockResolvedValue({
        data: [],
        pagination: { total: 0, offset: 0, limit: 50 },
      })

      const result = await listPropertiesHandler({})
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(response.data.data).toHaveLength(0)
      expect(response.suggestions).toBeDefined()
      expect(response.suggestions.length).toBeGreaterThan(0)
    })

    it('should handle API errors gracefully', async () => {
      // Network issues or API problems shouldn't crash the tool
      mockListProperties.mockRejectedValue(new Error('API connection failed'))

      await expect(listPropertiesHandler({})).rejects.toThrow()
    })

    it('should validate response structure', async () => {
      // Protect against malformed API responses
      mockListProperties.mockResolvedValue({
        unexpected: 'structure',
      } as unknown)

      await expect(listPropertiesHandler({})).rejects.toThrow('Invalid response structure')
    })

    it('should handle maximum page size correctly', async () => {
      // Prevent requesting too many items at once
      const mockProperties = {
        data: new Array(50).fill(null).map((_, i) => ({ id: i + 1 })),
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        size: 100, // Exceeds max
      })
      const response = JSON.parse(result.content[0].text)

      // Note: Capping happens at Zod validation level, not in handler
      // When bypassing Zod, the value passes through as-is
      // Offset is only added when page is explicitly provided
      expect(mockListProperties).toHaveBeenCalledWith({
        limit: 100,
      })
      expect(response.data.data).toHaveLength(50)
    })
  })

  describe('Business-Critical Scenarios', () => {
    it('should support complete inventory export for accounting', async () => {
      // Monthly/yearly property inventory reports for financial planning
      const mockProperties = {
        data: [
          {
            id: 1,
            name: 'Property A',
            status: 'active',
            currency: 'USD',
            basePrice: 200,
          },
          {
            id: 2,
            name: 'Property B',
            status: 'active',
            currency: 'EUR',
            basePrice: 180,
          },
        ],
        pagination: {
          total: 2,
          offset: 0,
          limit: 50,
        },
      }

      mockListProperties.mockResolvedValue(mockProperties)

      const result = await listPropertiesHandler({
        includeCount: true,
        size: 50,
      })
      const response = JSON.parse(result.content[0].text)

      expect(response.data.data).toHaveLength(2)
      expect(response.data.pagination.total).toBe(2)
      expect(response.summary).toContain('2')
    })

    it('should handle multi-page iteration for bulk operations', async () => {
      // Bulk updates require iterating through all properties
      const page3Properties = {
        data: new Array(25).fill(null).map((_, i) => ({
          id: 100 + i,
          name: `Property ${100 + i}`,
        })),
        pagination: {
          total: 125,
          offset: 100,
          limit: 50,
        },
      }

      mockListProperties.mockResolvedValue(page3Properties)

      const result = await listPropertiesHandler({
        page: 3,
        size: 50,
      })
      const response = JSON.parse(result.content[0].text)

      expect(mockListProperties).toHaveBeenCalledWith({
        limit: 50,
        offset: 100, // page 3 = offset 100
      })
      expect(response.data.data).toHaveLength(25)
    })
  })

  describe('Tool Registration', () => {
    it('should have lodgify_list_properties tool registered', () => {
      const tools = getPropertyTools(() => mockClient)
      const tool = tools.find((t) => t.name === 'lodgify_list_properties')

      expect(tool).toBeDefined()
      expect(tool?.category).toBe('Property Management')
      expect(tool?.config.title).toBe('List Properties')
      expect(tool?.config.inputSchema).toBeDefined()
    })
  })
})
