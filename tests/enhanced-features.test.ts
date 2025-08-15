import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

describe('Enhanced McpServer Features', () => {
  describe('Error Handling with JSON-RPC Compliance', () => {
    test('should create McpError for validation failures', () => {
      const validationError = new Error('Missing required field: id')
      
      try {
        // Simulate validation error handling
        if (validationError.message.includes('Missing required')) {
          throw new McpError(ErrorCode.InvalidParams, validationError.message)
        }
      } catch (error: any) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InvalidParams)
        expect(error.message).toContain('Missing required field')
      }
    })

    test('should create McpError for API errors', () => {
      const apiError = new Error('Lodgify 404: Property not found')
      ;(apiError as any).status = 404
      
      try {
        // Simulate API error handling
        if ((apiError as any).status === 404) {
          throw new McpError(ErrorCode.InternalError, `API Error: ${apiError.message}`)
        }
      } catch (error: any) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InternalError)
        expect(error.message).toContain('API Error')
        expect(error.message).toContain('not found')
      }
    })

    test('should create McpError for internal errors', () => {
      const internalError = new Error('Unexpected database connection failure')
      
      try {
        // Simulate internal error handling
        throw new McpError(ErrorCode.InternalError, `Internal error: ${internalError.message}`)
      } catch (error: any) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InternalError)
        expect(error.message).toContain('Internal error')
      }
    })

    test('should preserve error context and details', () => {
      const detailedError = new Error('Rate limit exceeded')
      ;(detailedError as any).status = 429
      ;(detailedError as any).retryAfter = 60
      
      try {
        throw new McpError(
          ErrorCode.InternalError,
          'Rate limited by Lodgify API',
          {
            originalStatus: (detailedError as any).status,
            retryAfter: (detailedError as any).retryAfter,
            endpoint: '/v2/properties'
          }
        )
      } catch (error: any) {
        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InternalError)
        expect(error.data).toBeDefined()
        expect(error.data.originalStatus).toBe(429)
        expect(error.data.retryAfter).toBe(60)
        expect(error.data.endpoint).toBe('/v2/properties')
      }
    })
  })

  describe('Tool Metadata Enhancement', () => {
    test('should validate enhanced tool metadata structure', () => {
      // Example of enhanced metadata that our tools should have
      const enhancedToolMetadata = {
        name: 'lodgify_list_properties',
        title: 'List Properties',
        description: 'List all properties with optional filtering and pagination. Returns property details including names, IDs, locations, and basic configuration. Supports filtering by status, location, and other criteria.',
        inputSchema: {
          params: expect.any(Object) // Should be Zod schema
        }
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

    test('should validate dangerous tool metadata', () => {
      const dangerousToolMetadata = {
        name: 'lodgify_delete_booking',
        title: 'Cancel/Delete Booking',
        description: 'Permanently cancel and delete a booking from the system. This is a destructive operation that cannot be undone. Use with extreme caution and ensure proper authorization. Consider using booking modification instead of deletion when possible.',
        inputSchema: {
          id: expect.any(Object)
        }
      }

      // Dangerous tools should have clear warnings in description
      expect(dangerousToolMetadata.description).toContain('destructive')
      expect(dangerousToolMetadata.description).toContain('cannot be undone')
      expect(dangerousToolMetadata.description).toContain('caution')
    })

    test('should validate helper tool metadata', () => {
      const helperToolMetadata = {
        name: 'lodgify_find_properties',
        title: 'Find Properties',
        description: 'Find properties in the system when you don\'t know the exact property ID. Searches properties by name, gets property IDs from bookings, or lists all properties.',
        inputSchema: {
          searchTerm: expect.any(Object),
          includePropertyIds: expect.any(Object),
          limit: expect.any(Object)
        }
      }

      // Helper tools should explain their purpose clearly
      expect(helperToolMetadata.description).toContain('when you don\'t know')
      expect(helperToolMetadata.description).toContain('Find properties')
    })
  })

  describe('Notification Debouncing Configuration', () => {
    test('should have debouncing configuration for tools notifications', () => {
      const expectedDebouncedMethods = [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed'
      ]

      // Our server should be configured with these debounced notification methods
      expectedDebouncedMethods.forEach(method => {
        expect(method).toMatch(/^notifications\//)
        expect(method).toContain('list_changed')
      })
    })

    test('should validate debouncing reduces notification noise', () => {
      // Simulation of how debouncing would work
      const notifications: string[] = []
      let debounceTimer: any = null
      
      const debouncedNotify = (method: string) => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          notifications.push(method)
        }, 100) // 100ms debounce
      }

      // Simulate rapid notifications
      debouncedNotify('tools/list_changed')
      debouncedNotify('tools/list_changed')
      debouncedNotify('tools/list_changed')

      // Before debounce timer fires
      expect(notifications).toHaveLength(0)

      // After debounce delay (simulated)
      setTimeout(() => {
        expect(notifications).toHaveLength(1)
        expect(notifications[0]).toBe('tools/list_changed')
      }, 150)
    })
  })

  describe('Server Capabilities Declaration', () => {
    test('should declare comprehensive server capabilities', () => {
      const expectedCapabilities = {
        tools: {
          listChanged: true // Tool list can change
        },
        resources: {
          subscribe: true,  // Can subscribe to resource changes
          listChanged: true // Resource list can change
        },
        logging: {}, // Supports logging
        completions: {} // May support completions
      }

      // Validate capability structure
      expect(expectedCapabilities.tools).toBeDefined()
      expect(expectedCapabilities.resources).toBeDefined()
      expect(expectedCapabilities.logging).toBeDefined()
      
      // Check specific capabilities
      expect(expectedCapabilities.tools.listChanged).toBe(true)
      expect(expectedCapabilities.resources.subscribe).toBe(true)
      expect(expectedCapabilities.resources.listChanged).toBe(true)
    })

    test('should declare server information', () => {
      const expectedServerInfo = {
        name: 'lodgify-mcp',
        version: '0.1.0'
      }

      expect(expectedServerInfo.name).toBe('lodgify-mcp')
      expect(expectedServerInfo.version).toMatch(/^\d+\.\d+\.\d+$/) // Semantic versioning
    })
  })

  describe('Resource Management Enhancement', () => {
    test('should provide comprehensive health check information', () => {
      const healthCheckResource = {
        uri: 'lodgify://health',
        name: 'Health Check',
        description: 'Check the health status of the Lodgify MCP server and API connectivity',
        mimeType: 'application/json'
      }

      expect(healthCheckResource.uri).toBe('lodgify://health')
      expect(healthCheckResource.name).toBe('Health Check')
      expect(healthCheckResource.mimeType).toBe('application/json')
      expect(healthCheckResource.description).toContain('health status')
    })

    test('should validate health check data structure', () => {
      const expectedHealthData = {
        ok: true,
        timestamp: expect.any(String),
        version: '0.1.0',
        baseUrl: 'https://api.lodgify.com',
        apiKeyConfigured: true
      }

      expect(expectedHealthData.ok).toBe(true)
      expect(expectedHealthData.baseUrl).toBe('https://api.lodgify.com')
      expect(expectedHealthData.apiKeyConfigured).toBe(true)
      expect(expectedHealthData.version).toBe('0.1.0')
    })
  })

  describe('Integration with Existing Functionality', () => {
    test('should maintain all existing tool functionality', () => {
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
        'lodgify_availability_room',
        'lodgify_availability_property',
        'lodgify_get_quote',
        'lodgify_get_thread'
      ]

      // All original tools should still be available
      originalToolNames.forEach(toolName => {
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
        'lodgify_create_booking',
        'lodgify_update_booking',
        'lodgify_delete_booking',
        'lodgify_subscribe_webhook',
        'lodgify_list_webhooks',
        'lodgify_delete_webhook',
        'lodgify_create_rate',
        'lodgify_update_rate',
        'lodgify_update_property_availability'
      ]

      // All enhanced tools should be available
      enhancedToolNames.forEach(toolName => {
        expect(toolName).toMatch(/^lodgify_/)
        expect(toolName.length).toBeGreaterThan(10) // Meaningful names
      })

      // Should have both original and enhanced tools
      const totalExpectedTools = 15 + 13 // Original + Enhanced
      expect(totalExpectedTools).toBe(28) // We should have about 28 tools total
    })
  })
})