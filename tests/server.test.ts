import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createMockResponse, createMockFetch, fixtures } from './utils.js'

// Mock the LodgifyClient
vi.mock('../src/lodgify.js', () => ({
  LodgifyClient: vi.fn().mockImplementation(() => ({
    listProperties: vi.fn(),
    getProperty: vi.fn(),
    listPropertyRooms: vi.fn(),
    listDeletedProperties: vi.fn(),
    getDailyRates: vi.fn(),
    getRateSettings: vi.fn(),
    listBookings: vi.fn(),
    getBooking: vi.fn(),
    getBookingPaymentLink: vi.fn(),
    createBookingPaymentLink: vi.fn(),
    updateKeyCodes: vi.fn(),
    getAvailabilityRoom: vi.fn(),
    getAvailabilityProperty: vi.fn(),
    getQuote: vi.fn(),
    getThread: vi.fn(),
  })),
}))

describe('MCP Server Integration Tests', () => {
  let server: Server
  let mockClient: any

  beforeEach(async () => {
    // Set up environment
    process.env.LODGIFY_API_KEY = 'test-api-key'
    
    // Import fresh instances
    const { LodgifyClient } = await import('../src/lodgify.js')
    mockClient = new LodgifyClient('test-api-key')
    
    // Create server instance
    server = new Server(
      {
        name: 'lodgify-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    )
    
    // Import and run server setup
    const serverModule = await import('../src/server.js')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Tool Registration', () => {
    it('should register all Lodgify tools', async () => {
      const response = await server.request(
        { method: 'tools/list' },
        ListToolsRequestSchema,
      )

      expect(response.tools).toHaveLength(15)
      
      const toolNames = response.tools.map((t: any) => t.name)
      expect(toolNames).toContain('lodgify.list_properties')
      expect(toolNames).toContain('lodgify.get_property')
      expect(toolNames).toContain('lodgify.list_property_rooms')
      expect(toolNames).toContain('lodgify.list_deleted_properties')
      expect(toolNames).toContain('lodgify.daily_rates')
      expect(toolNames).toContain('lodgify.rate_settings')
      expect(toolNames).toContain('lodgify.list_bookings')
      expect(toolNames).toContain('lodgify.get_booking')
      expect(toolNames).toContain('lodgify.get_booking_payment_link')
      expect(toolNames).toContain('lodgify.create_booking_payment_link')
      expect(toolNames).toContain('lodgify.update_key_codes')
      expect(toolNames).toContain('lodgify.availability_room')
      expect(toolNames).toContain('lodgify.availability_property')
      expect(toolNames).toContain('lodgify.get_quote')
      expect(toolNames).toContain('lodgify.get_thread')
    })

    it('should include proper descriptions for each tool', async () => {
      const response = await server.request(
        { method: 'tools/list' },
        ListToolsRequestSchema,
      )

      const propertyTool = response.tools.find((t: any) => t.name === 'lodgify.list_properties')
      expect(propertyTool).toBeDefined()
      expect(propertyTool.description).toContain('GET /v2/properties')
      expect(propertyTool.inputSchema).toBeDefined()
    })
  })

  describe('Property Management Tools', () => {
    it('should handle list_properties tool', async () => {
      mockClient.listProperties.mockResolvedValue([fixtures.property])
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.list_properties',
            arguments: {
              params: { page: 1, limit: 10 },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.listProperties).toHaveBeenCalledWith({ page: 1, limit: 10 })
      expect(response.content[0].text).toContain(fixtures.property.id)
    })

    it('should handle get_property tool', async () => {
      mockClient.getProperty.mockResolvedValue(fixtures.property)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.get_property',
            arguments: {
              id: 'prop-123',
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getProperty).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain(fixtures.property.name)
    })

    it('should handle list_property_rooms tool', async () => {
      const rooms = [{ id: 'room-1', name: 'Master Suite' }]
      mockClient.listPropertyRooms.mockResolvedValue(rooms)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.list_property_rooms',
            arguments: {
              propertyId: 'prop-123',
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.listPropertyRooms).toHaveBeenCalledWith('prop-123')
      expect(response.content[0].text).toContain('Master Suite')
    })
  })

  describe('Booking Management Tools', () => {
    it('should handle list_bookings tool', async () => {
      mockClient.listBookings.mockResolvedValue([fixtures.booking])
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.list_bookings',
            arguments: {
              params: { from: '2025-11-01', to: '2025-11-30' },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.listBookings).toHaveBeenCalledWith({ from: '2025-11-01', to: '2025-11-30' })
      expect(response.content[0].text).toContain(fixtures.booking.id)
    })

    it('should handle get_booking tool', async () => {
      mockClient.getBooking.mockResolvedValue(fixtures.booking)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.get_booking',
            arguments: {
              id: 'book-456',
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getBooking).toHaveBeenCalledWith('book-456')
      expect(response.content[0].text).toContain(fixtures.booking.guest.name)
    })

    it('should handle create_booking_payment_link tool', async () => {
      const paymentLink = { url: 'https://pay.lodgify.com/xyz', amount: 1000 }
      mockClient.createBookingPaymentLink.mockResolvedValue(paymentLink)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.create_booking_payment_link',
            arguments: {
              id: 'book-456',
              payload: { amount: 1000, currency: 'USD' },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.createBookingPaymentLink).toHaveBeenCalledWith(
        'book-456',
        { amount: 1000, currency: 'USD' }
      )
      expect(response.content[0].text).toContain('https://pay.lodgify.com/xyz')
    })
  })

  describe('Availability Tools', () => {
    it('should handle availability_room tool', async () => {
      mockClient.getAvailabilityRoom.mockResolvedValue(fixtures.availability)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.availability_room',
            arguments: {
              propertyId: 'prop-123',
              roomTypeId: 'room-456',
              params: { from: '2025-11-20', to: '2025-11-25' },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getAvailabilityRoom).toHaveBeenCalledWith(
        'prop-123',
        'room-456',
        { from: '2025-11-20', to: '2025-11-25' }
      )
      expect(response.content[0].text).toContain('available')
    })

    it('should handle availability_property tool', async () => {
      mockClient.getAvailabilityProperty.mockResolvedValue(fixtures.availability)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.availability_property',
            arguments: {
              propertyId: 'prop-123',
              params: { from: '2025-11-20', to: '2025-11-25' },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getAvailabilityProperty).toHaveBeenCalledWith(
        'prop-123',
        { from: '2025-11-20', to: '2025-11-25' }
      )
      expect(response.content[0].text).toContain('available')
    })
  })

  describe('Quote & Messaging Tools', () => {
    it('should handle get_quote tool with complex parameters', async () => {
      mockClient.getQuote.mockResolvedValue(fixtures.quote)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.get_quote',
            arguments: {
              propertyId: 'prop-123',
              params: {
                from: '2025-11-20',
                to: '2025-11-25',
                'roomTypes[0].Id': 999,
                'guest_breakdown[adults]': 2,
              },
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getQuote).toHaveBeenCalledWith(
        'prop-123',
        {
          from: '2025-11-20',
          to: '2025-11-25',
          'roomTypes[0].Id': 999,
          'guest_breakdown[adults]': 2,
        }
      )
      expect(response.content[0].text).toContain('1000')
    })

    it('should handle get_thread tool', async () => {
      mockClient.getThread.mockResolvedValue(fixtures.thread)
      
      const response = await server.request(
        {
          method: 'tools/call',
          params: {
            name: 'lodgify.get_thread',
            arguments: {
              threadGuid: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        CallToolRequestSchema,
      )

      expect(mockClient.getThread).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
      expect(response.content[0].text).toContain('Is the property available?')
    })
  })

  describe('Resource Handlers', () => {
    it('should list health resource', async () => {
      const response = await server.request(
        { method: 'resources/list' },
        ListResourcesRequestSchema,
      )

      expect(response.resources).toHaveLength(1)
      expect(response.resources[0]).toMatchObject({
        uri: 'lodgify://health',
        name: 'Health Check',
        description: expect.stringContaining('health status'),
        mimeType: 'application/json',
      })
    })

    it('should read health resource', async () => {
      const response = await server.request(
        {
          method: 'resources/read',
          params: { uri: 'lodgify://health' },
        },
        ReadResourceRequestSchema,
      )

      expect(response.contents).toHaveLength(1)
      const healthData = JSON.parse(response.contents[0].text)
      expect(healthData).toMatchObject({
        ok: true,
        baseUrl: 'https://api.lodgify.com',
        version: '0.1.0',
        apiKeyConfigured: true,
        timestamp: expect.any(String),
      })
    })

    it('should return error for unknown resource', async () => {
      await expect(
        server.request(
          {
            method: 'resources/read',
            params: { uri: 'lodgify://unknown' },
          },
          ReadResourceRequestSchema,
        )
      ).rejects.toThrow('Unknown resource')
    })
  })
})