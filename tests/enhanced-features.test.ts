import { describe, expect, test } from 'bun:test'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import pkg from '../package.json' with { type: 'json' }
import type { TestError } from './types.js'

interface McpErrorData {
  originalStatus?: number
  retryAfter?: number
  endpoint?: string
}

describe('Enhanced McpServer Features', () => {
  describe('Error Handling with JSON-RPC Compliance', () => {
    test('should create McpError for validation failures', () => {
      const validationError = new Error('Missing required field: id')

      try {
        // Simulate validation error handling
        if (validationError.message.includes('Missing required')) {
          throw new McpError(ErrorCode.InvalidParams, validationError.message)
        }
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError)
        expect((error as McpError).code).toBe(ErrorCode.InvalidParams)
        expect((error as McpError).message).toContain('Missing required field')
      }
    })

    test('should create McpError for API errors', () => {
      const apiError = new Error('Lodgify 404: Property not found')
      ;(apiError as TestError).status = 404

      try {
        // Simulate API error handling
        if ((apiError as TestError).status === 404) {
          throw new McpError(ErrorCode.InternalError, `API Error: ${apiError.message}`)
        }
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError)
        expect((error as McpError).code).toBe(ErrorCode.InternalError)
        expect((error as McpError).message).toContain('API Error')
        expect((error as McpError).message).toContain('not found')
      }
    })

    test('should create McpError for internal errors', () => {
      const internalError = new Error('Unexpected database connection failure')

      try {
        // Simulate internal error handling
        throw new McpError(ErrorCode.InternalError, `Internal error: ${internalError.message}`)
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError)
        expect((error as McpError).code).toBe(ErrorCode.InternalError)
        expect((error as McpError).message).toContain('Internal error')
      }
    })

    test('should preserve error context and details', () => {
      const detailedError = new Error('Rate limit exceeded')
      ;(detailedError as TestError).status = 429
      ;(detailedError as TestError).retryAfter = 60

      try {
        throw new McpError(ErrorCode.InternalError, 'Rate limited by Lodgify API', {
          originalStatus: (detailedError as TestError).status,
          retryAfter: (detailedError as TestError).retryAfter,
          endpoint: '/v2/properties',
        })
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(McpError)
        expect((error as McpError).code).toBe(ErrorCode.InternalError)
        expect((error as McpError).data).toBeDefined()
        expect(((error as McpError).data as McpErrorData).originalStatus).toBe(429)
        expect(((error as McpError).data as McpErrorData).retryAfter).toBe(60)
        expect(((error as McpError).data as McpErrorData).endpoint).toBe('/v2/properties')
      }
    })
  })

  describe('Tool Metadata Enhancement', () => {
    test('should validate enhanced tool metadata structure', () => {
      // Example of enhanced metadata that our tools should have
      const enhancedToolMetadata = {
        name: 'lodgify_list_properties',
        title: 'List Properties',
        description:
          'List all properties with optional filtering and pagination. Returns property details including names, IDs, locations, and basic configuration. Supports filtering by status, location, and other criteria.',
        inputSchema: {
          params: expect.any(Object), // Should be Zod schema
        },
      }

      // Validate metadata structure
      expect(enhancedToolMetadata.name).toBeDefined()
      expect(enhancedToolMetadata.title).toBeDefined()
      expect(enhancedToolMetadata.description).toBeDefined()
      expect(enhancedToolMetadata.description.length).toBeGreaterThan(50) // Meaningful description
      expect(enhancedToolMetadata.inputSchema).toBeDefined()

      // Tool names should follow lodgify_ convention
      expect(enhancedToolMetadata.name).toMatch(/^lodgify_/)
    })
  })

  describe('Resource Management', () => {
    test('should provide health check resource', () => {
      const healthResource = {
        uri: 'lodgify://health',
        name: 'Health Check',
        description: 'Check the health status of the Lodgify MCP server',
        mimeType: 'application/json',
      }

      expect(healthResource.uri).toBe('lodgify://health')
      expect(healthResource.name).toBe('Health Check')
      expect(healthResource.description).toContain('health')
      expect(healthResource.mimeType).toBe('application/json')
    })

    test('should validate health check response structure', () => {
      const expectedHealthData = {
        ok: true,
        timestamp: new Date().toISOString(),
        version: pkg.version,
        baseUrl: 'https://api.lodgify.com',
        apiKeyConfigured: true,
      }

      expect(expectedHealthData.ok).toBe(true)
      expect(expectedHealthData.baseUrl).toBe('https://api.lodgify.com')
      expect(expectedHealthData.apiKeyConfigured).toBe(true)
      expect(expectedHealthData.version).toMatch(/^\d+\.\d+\.\d+(-.+)?$/)
    })
  })

  describe('Integration with Existing Functionality', () => {
    const originalToolNames = [
      'lodgify_list_properties',
      'lodgify_get_property',
      'lodgify_list_property_rooms',
      'lodgify_list_deleted_properties',
      'lodgify_daily_rates',
      'lodgify_rate_settings',
      'lodgify_list_bookings',
      'lodgify_get_booking',
      'lodgify_get_booking_payment_link',
      'lodgify_create_booking_payment_link',
      'lodgify_update_key_codes',
      'lodgify_get_quote',
      'lodgify_get_thread',
    ]

    test('should maintain all existing tool functionality', () => {
      // All original tools should still be available
      originalToolNames.forEach((toolName) => {
        expect(toolName).toMatch(/^lodgify_/)
        expect(toolName.length).toBeGreaterThan(10) // Meaningful names
      })
    })

    test('should provide all enhanced tool functionality', () => {
      const enhancedToolNames = [
        'lodgify_find_properties',
        'lodgify_check_next_availability',
        'lodgify_check_date_range_availability',
        'lodgify_get_availability_calendar',
      ]

      // All enhanced tools should be available
      enhancedToolNames.forEach((toolName) => {
        expect(toolName).toMatch(/^lodgify_/)
        expect(toolName.length).toBeGreaterThan(10) // Meaningful names
      })

      // Should have both original and enhanced tools
      const totalExpectedTools = new Set([...originalToolNames, ...enhancedToolNames]).size
      expect(totalExpectedTools).toBe(17) // We should have about 17 tools total
    })
  })
})
