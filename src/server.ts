#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { LodgifyClient } from './lodgify.js'

// Load environment variables
config()

// Validate API key
const apiKey = process.env.LODGIFY_API_KEY
if (!apiKey) {
  console.error('Error: LODGIFY_API_KEY environment variable is required')
  process.exit(1)
}

// Initialize Lodgify client
const client = new LodgifyClient(apiKey)

// Initialize MCP server
const server = new Server(
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

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Property Management Schemas
const ListPropertiesSchema = z.object({
  params: z.record(z.unknown()).optional(),
})

const GetPropertySchema = z.object({
  id: z.string().min(1, 'Property ID is required'),
})

const ListPropertyRoomsSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
})

const ListDeletedPropertiesSchema = z.object({
  params: z.record(z.unknown()).optional(),
})

// Rates Management Schemas
const DailyRatesSchema = z.object({
  params: z.record(z.unknown()),
})

const RateSettingsSchema = z.object({
  params: z.record(z.unknown()),
})

// Booking Management Schemas
const ListBookingsSchema = z.object({
  params: z.record(z.unknown()).optional(),
})

const GetBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
})

const GetBookingPaymentLinkSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
})

const CreateBookingPaymentLinkSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  payload: z.record(z.unknown()),
})

const UpdateKeyCodesSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  payload: z.record(z.unknown()),
})

// Availability Schemas
const AvailabilityRoomSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  roomTypeId: z.string().min(1, 'Room Type ID is required'),
  params: z.record(z.unknown()).optional(),
})

const AvailabilityPropertySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  params: z.record(z.unknown()).optional(),
})

// Quote & Messaging Schemas
const GetQuoteSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  params: z.record(z.unknown()),
})

const GetThreadSchema = z.object({
  threadGuid: z.string().min(1, 'Thread GUID is required'),
})

// ============================================================================
// Register Tools
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Property Management Tools
    {
      name: 'lodgify.list_properties',
      description: 'List all properties with optional filtering and pagination (GET /v2/properties)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering and pagination',
          },
        },
      },
    },
    {
      name: 'lodgify.get_property',
      description: 'Get a single property by ID (GET /v2/properties/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Property ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.list_property_rooms',
      description: 'List all rooms for a specific property (GET /v2/properties/{propertyId}/rooms)',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify.list_deleted_properties',
      description: 'List deleted properties (GET /v2/deletedProperties)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering',
          },
        },
      },
    },

    // Rates Management Tools
    {
      name: 'lodgify.daily_rates',
      description: 'Get daily rates calendar (GET /v2/rates/calendar)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Query parameters including propertyId, from, to dates',
          },
        },
        required: ['params'],
      },
    },
    {
      name: 'lodgify.rate_settings',
      description: 'Get rate settings (GET /v2/rates/settings)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Query parameters for rate settings',
          },
        },
        required: ['params'],
      },
    },

    // Booking Management Tools
    {
      name: 'lodgify.list_bookings',
      description: 'List bookings with optional filtering (GET /v2/reservations/bookings)',
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'object',
            description: 'Optional query parameters for filtering (date range, status, etc.)',
          },
        },
      },
    },
    {
      name: 'lodgify.get_booking',
      description: 'Get a single booking by ID (GET /v2/reservations/bookings/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.get_booking_payment_link',
      description: 'Get payment link for a booking (GET /v2/reservations/bookings/{id}/quote/paymentLink)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'lodgify.create_booking_payment_link',
      description: 'Create payment link for a booking (POST /v2/reservations/bookings/{id}/quote/paymentLink)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
          payload: {
            type: 'object',
            description: 'Payment link details (amount, currency, etc.)',
          },
        },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify.update_key_codes',
      description: 'Update key codes for a booking (PUT /v2/reservations/bookings/{id}/keyCodes)',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
          payload: {
            type: 'object',
            description: 'Key codes data',
          },
        },
        required: ['id', 'payload'],
      },
    },

    // Availability Tools
    {
      name: 'lodgify.availability_room',
      description: 'Get availability for a specific room type (GET /v2/availability/{propertyId}/{roomTypeId})',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          roomTypeId: {
            type: 'string',
            description: 'Room Type ID',
          },
          params: {
            type: 'object',
            description: 'Optional query parameters (date range, etc.)',
          },
        },
        required: ['propertyId', 'roomTypeId'],
      },
    },
    {
      name: 'lodgify.availability_property',
      description: 'Get availability for a property (GET /v2/availability/{propertyId})',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          params: {
            type: 'object',
            description: 'Optional query parameters (date range, etc.)',
          },
        },
        required: ['propertyId'],
      },
    },

    // Quote & Messaging Tools
    {
      name: 'lodgify.get_quote',
      description:
        'Get a quote for a property with complex parameters (GET /v2/quote/{propertyId}). Supports bracket notation like roomTypes[0].Id',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          params: {
            type: 'object',
            description:
              'Quote parameters including dates, room types, guest breakdown, add-ons. Example: {"from": "2025-11-20", "to": "2025-11-25", "roomTypes[0].Id": 999, "guest_breakdown[adults]": 2}',
          },
        },
        required: ['propertyId', 'params'],
      },
    },
    {
      name: 'lodgify.get_thread',
      description: 'Get a messaging thread (GET /v2/messaging/{threadGuid})',
      inputSchema: {
        type: 'object',
        properties: {
          threadGuid: {
            type: 'string',
            description: 'Thread GUID',
          },
        },
        required: ['threadGuid'],
      },
    },
  ],
}))

// ============================================================================
// Handle Tool Calls
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    let result: unknown

    switch (name) {
      // Property Management Tools
      case 'lodgify.list_properties': {
        const input = ListPropertiesSchema.parse(args)
        result = await client.listProperties(input.params)
        break
      }

      case 'lodgify.get_property': {
        const input = GetPropertySchema.parse(args)
        result = await client.getProperty(input.id)
        break
      }

      case 'lodgify.list_property_rooms': {
        const input = ListPropertyRoomsSchema.parse(args)
        result = await client.listPropertyRooms(input.propertyId)
        break
      }

      case 'lodgify.list_deleted_properties': {
        const input = ListDeletedPropertiesSchema.parse(args)
        result = await client.listDeletedProperties(input.params)
        break
      }

      // Rates Management Tools
      case 'lodgify.daily_rates': {
        const input = DailyRatesSchema.parse(args)
        result = await client.getDailyRates(input.params)
        break
      }

      case 'lodgify.rate_settings': {
        const input = RateSettingsSchema.parse(args)
        result = await client.getRateSettings(input.params)
        break
      }

      // Booking Management Tools
      case 'lodgify.list_bookings': {
        const input = ListBookingsSchema.parse(args)
        result = await client.listBookings(input.params)
        break
      }

      case 'lodgify.get_booking': {
        const input = GetBookingSchema.parse(args)
        result = await client.getBooking(input.id)
        break
      }

      case 'lodgify.get_booking_payment_link': {
        const input = GetBookingPaymentLinkSchema.parse(args)
        result = await client.getBookingPaymentLink(input.id)
        break
      }

      case 'lodgify.create_booking_payment_link': {
        const input = CreateBookingPaymentLinkSchema.parse(args)
        result = await client.createBookingPaymentLink(input.id, input.payload)
        break
      }

      case 'lodgify.update_key_codes': {
        const input = UpdateKeyCodesSchema.parse(args)
        result = await client.updateKeyCodes(input.id, input.payload)
        break
      }

      // Availability Tools
      case 'lodgify.availability_room': {
        const input = AvailabilityRoomSchema.parse(args)
        result = await client.getAvailabilityRoom(input.propertyId, input.roomTypeId, input.params)
        break
      }

      case 'lodgify.availability_property': {
        const input = AvailabilityPropertySchema.parse(args)
        result = await client.getAvailabilityProperty(input.propertyId, input.params)
        break
      }

      // Quote & Messaging Tools
      case 'lodgify.get_quote': {
        const input = GetQuoteSchema.parse(args)
        result = await client.getQuote(input.propertyId, input.params)
        break
      }

      case 'lodgify.get_thread': {
        const input = GetThreadSchema.parse(args)
        result = await client.getThread(input.threadGuid)
        break
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    // Return result as MCP content
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                message: 'Validation error',
                details: error.errors,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      }
    }

    // Handle Lodgify API errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorDetails = (error as any)?.detail || undefined

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: errorMessage,
              details: errorDetails,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }
})

// ============================================================================
// Health Resource
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'lodgify://health',
      name: 'Health Check',
      description: 'Check the health status of the Lodgify MCP server',
      mimeType: 'application/json',
    },
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  if (uri === 'lodgify://health') {
    const health = {
      ok: true,
      baseUrl: 'https://api.lodgify.com',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      apiKeyConfigured: !!apiKey,
    }

    return {
      contents: [
        {
          uri: 'lodgify://health',
          mimeType: 'application/json',
          text: JSON.stringify(health, null, 2),
        },
      ],
    }
  }

  throw new Error(`Unknown resource: ${uri}`)
})

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport()

  // Handle errors
  transport.onerror = (error) => {
    console.error('Transport error:', error)
  }

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.error('Shutting down...')
    await server.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.error('Shutting down...')
    await server.close()
    process.exit(0)
  })

  // Connect and start server
  await server.connect(transport)
  console.error('Lodgify MCP server started successfully')
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})