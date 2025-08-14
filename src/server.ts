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

// Helper function to find properties when ID is unknown
async function findProperties(
  client: LodgifyClient,
  searchTerm?: string,
  includePropertyIds: boolean = true,
  limit: number = 10
): Promise<{
  properties: Array<{
    id: string
    name?: string
    source?: string
  }>
  message: string
  suggestions: string[]
}> {
  const properties: Array<{ id: string; name?: string; source?: string }> = []
  const propertyIds = new Set<string>()
  const suggestions: string[] = []

  try {
    // Get properties from property list API
    try {
      const propertiesData = await client.listProperties() as any
      const propertyList = propertiesData?.items || propertiesData || []
      
      for (const property of propertyList.slice(0, limit)) {
        if (property.id) {
          const propertyName = property.name || property.title || ''
          const matchesSearch = !searchTerm || 
            propertyName.toLowerCase().includes(searchTerm.toLowerCase())
          
          if (matchesSearch) {
            properties.push({
              id: property.id.toString(),
              name: propertyName,
              source: 'property_list'
            })
            propertyIds.add(property.id.toString())
          }
        }
      }
    } catch (error) {
      suggestions.push('Property list API may not be available or accessible')
    }

    // Get property IDs from recent bookings if enabled
    if (includePropertyIds && properties.length < limit) {
      try {
        const bookingsData = await client.listBookings() as any
        const bookings = bookingsData?.items || []
        
        const uniquePropertyIds = new Set<string>()
        for (const booking of bookings) {
          if (booking.property_id && !propertyIds.has(booking.property_id.toString())) {
            uniquePropertyIds.add(booking.property_id.toString())
          }
        }

        // Add property IDs from bookings
        for (const propId of Array.from(uniquePropertyIds).slice(0, limit - properties.length)) {
          properties.push({
            id: propId,
            name: `Property ${propId}`,
            source: 'bookings'
          })
          propertyIds.add(propId)
        }
      } catch (error) {
        suggestions.push('Could not retrieve property IDs from bookings')
      }
    }

    // Generate helpful suggestions
    if (properties.length === 0) {
      suggestions.push('No properties found. Try using lodgify_list_properties to see all properties.')
      suggestions.push('Check if your API key has proper permissions to access properties.')
    } else if (searchTerm && properties.length === 0) {
      suggestions.push(`No properties found matching "${searchTerm}". Try a broader search term.`)
    }

    if (properties.length > 0) {
      suggestions.push('Use one of these property IDs with availability tools like lodgify_check_next_availability')
      if (searchTerm) {
        suggestions.push('Property names are case-insensitive. Try partial matches for better results.')
      }
    }

    const message = properties.length > 0 
      ? `Found ${properties.length} property(ies)${searchTerm ? ` matching "${searchTerm}"` : ''}`
      : `No properties found${searchTerm ? ` matching "${searchTerm}"` : ''}`

    return {
      properties,
      message,
      suggestions
    }
  } catch (error) {
    return {
      properties: [],
      message: 'Error searching for properties',
      suggestions: [
        'Check your API key and permissions',
        'Try using lodgify_list_properties directly',
        'Verify your network connection'
      ]
    }
  }
}

// Load environment variables
config()

// Function to set up server with client injection for testing
export function setupServer(injectedClient?: LodgifyClient) {
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
  
  const client = injectedClient || (() => {
    const apiKey = process.env.LODGIFY_API_KEY
    if (!apiKey) {
      throw new Error('LODGIFY_API_KEY environment variable is required')
    }
    return new LodgifyClient(apiKey)
  })()

  // Return both server and client for testing
  return { server, client }
}

// Initialize server for production
const { server, client } = setupServer()

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Common validation schemas
const IdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters')
const GuidSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'GUID contains invalid characters')

// Specific payload schemas
const PaymentLinkPayloadSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().max(500).optional(),
  // Add other expected fields as needed
}).strict()

const KeyCodesPayloadSchema = z.object({
  keyCodes: z.array(z.string()).optional(),
  // Add other expected fields as needed
}).strict()

// New booking creation and update schemas
const CreateBookingPayloadSchema = z.object({
  propertyId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  guestBreakdown: z.object({
    adults: z.number().min(1),
    children: z.number().min(0).optional(),
    infants: z.number().min(0).optional(),
  }),
  roomTypes: z.array(z.object({
    id: z.string().min(1),
    quantity: z.number().min(1).optional(),
  })),
  // Add other expected fields as needed
}).strict()

const UpdateBookingPayloadSchema = z.object({
  status: z.string().optional(),
  guestBreakdown: z.object({
    adults: z.number().min(1).optional(),
    children: z.number().min(0).optional(),
    infants: z.number().min(0).optional(),
  }).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  // Add other expected fields as needed
}).strict()

// Availability update schema
const AvailabilityUpdatePayloadSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  available: z.boolean(),
  minStay: z.number().min(0).optional(),
  maxStay: z.number().min(0).optional(),
  // Add other expected fields as needed
}).strict()

// Webhook schemas
const WebhookSubscribePayloadSchema = z.object({
  event: z.string().min(1),
  targetUrl: z.string().url(),
  // Add other expected fields as needed
}).strict()

// Rate management schemas
const CreateRatePayloadSchema = z.object({
  propertyId: z.string().min(1),
  roomTypeId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  rate: z.number().positive(),
  currency: z.string().length(3).optional(),
  // Add other expected fields as needed
}).strict()

const UpdateRatePayloadSchema = z.object({
  rate: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  // Add other expected fields as needed
}).strict()

// Property Management Schemas
const ListPropertiesSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const GetPropertySchema = z.object({
  id: IdSchema,
})

const ListPropertyRoomsSchema = z.object({
  propertyId: IdSchema,
})

const ListDeletedPropertiesSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

// Rates Management Schemas
const DailyRatesSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

const RateSettingsSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

// Booking Management Schemas
const ListBookingsSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const GetBookingSchema = z.object({
  id: IdSchema,
})

const GetBookingPaymentLinkSchema = z.object({
  id: IdSchema,
})

const CreateBookingPaymentLinkSchema = z.object({
  id: IdSchema,
  payload: PaymentLinkPayloadSchema,
})

const UpdateKeyCodesSchema = z.object({
  id: IdSchema,
  payload: KeyCodesPayloadSchema,
})

// Availability Schemas
const AvailabilityRoomSchema = z.object({
  propertyId: IdSchema,
  roomTypeId: IdSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const AvailabilityPropertySchema = z.object({
  propertyId: IdSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

// Quote & Messaging Schemas
const GetQuoteSchema = z.object({
  propertyId: IdSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})

const GetThreadSchema = z.object({
  threadGuid: GuidSchema,
})

// New endpoint schemas
const CreateBookingSchema = z.object({
  payload: CreateBookingPayloadSchema,
})

const UpdateBookingSchema = z.object({
  id: IdSchema,
  payload: UpdateBookingPayloadSchema,
})

const DeleteBookingSchema = z.object({
  id: IdSchema,
})

const UpdatePropertyAvailabilitySchema = z.object({
  propertyId: IdSchema,
  payload: AvailabilityUpdatePayloadSchema,
})

const WebhookSubscribeSchema = z.object({
  payload: WebhookSubscribePayloadSchema,
})

const ListWebhooksSchema = z.object({
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const DeleteWebhookSchema = z.object({
  id: IdSchema,
})

const CreateRateSchema = z.object({
  payload: CreateRatePayloadSchema,
})

const UpdateRateSchema = z.object({
  id: IdSchema,
  payload: UpdateRatePayloadSchema,
})

// New Availability Helper Schemas
const FindPropertiesSchema = z.object({
  searchTerm: z.string().optional(),
  includePropertyIds: z.boolean().default(true).optional(),
  limit: z.number().min(1).max(50).default(10).optional(),
})

const CheckNextAvailabilitySchema = z.object({
  propertyId: IdSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  daysToCheck: z.number().min(1).max(365).optional(),
})

const CheckDateRangeAvailabilitySchema = z.object({
  propertyId: IdSchema,
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
})

const GetAvailabilityCalendarSchema = z.object({
  propertyId: IdSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  daysToShow: z.number().min(1).max(90).optional(),
})

// ============================================================================
// Register Tools
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Property Management Tools
    {
      name: 'lodgify_list_properties',
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
      name: 'lodgify_get_property',
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
      name: 'lodgify_list_property_rooms',
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
      name: 'lodgify_list_deleted_properties',
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
      name: 'lodgify_daily_rates',
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
      name: 'lodgify_rate_settings',
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
      name: 'lodgify_list_bookings',
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
      name: 'lodgify_get_booking',
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
      name: 'lodgify_get_booking_payment_link',
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
      name: 'lodgify_create_booking_payment_link',
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
      name: 'lodgify_update_key_codes',
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
      name: 'lodgify_availability_room',
      description: 'Get raw availability data for a specific room type (GET /v2/availability/{propertyId}/{roomTypeId}). Note: This returns technical availability data. For easier availability checking, use lodgify_check_next_availability or lodgify_get_availability_calendar instead.',
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
            description: 'Optional query parameters including from/to dates (YYYY-MM-DD format)',
            properties: {
              from: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              },
              to: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              },
            },
          },
        },
        required: ['propertyId', 'roomTypeId'],
      },
    },
    {
      name: 'lodgify_availability_property',
      description: 'Get raw availability data for a property (GET /v2/availability/{propertyId}). Note: This returns technical availability data. For easier availability checking, use lodgify_check_next_availability or lodgify_get_availability_calendar instead.',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          params: {
            type: 'object',
            description: 'Optional query parameters including from/to dates (YYYY-MM-DD format)',
            properties: {
              from: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              },
              to: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              },
            },
          },
        },
        required: ['propertyId'],
      },
    },

    // Enhanced Availability Helper Tools
    {
      name: 'lodgify_find_properties',
      description: 'Find properties in the system when you don\'t know the exact property ID. Searches properties by name, gets property IDs from bookings, or lists all properties.',
      inputSchema: {
        type: 'object',
        properties: {
          searchTerm: {
            type: 'string',
            description: 'Optional search term to filter properties by name (case-insensitive)',
          },
          includePropertyIds: {
            type: 'boolean',
            description: 'Include property IDs found in recent bookings (default: true)',
            default: true,
          },
          limit: {
            type: 'number',
            description: 'Maximum number of properties to return (default: 10)',
            default: 10,
            minimum: 1,
            maximum: 50,
          },
        },
      },
    },
    {
      name: 'lodgify_check_next_availability',
      description: 'Find the next available date for a property by analyzing bookings. Returns when the property is next available and for how long. If property ID is unknown, use lodgify_find_properties first.',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          fromDate: {
            type: 'string',
            description: 'Start date to check from (YYYY-MM-DD). Defaults to today if not provided.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          daysToCheck: {
            type: 'number',
            description: 'Number of days to check ahead (1-365). Defaults to 90 days.',
            minimum: 1,
            maximum: 365,
          },
        },
        required: ['propertyId'],
      },
    },
    {
      name: 'lodgify_check_date_range_availability',
      description: 'Check if a specific date range is available for booking at a property.',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          checkInDate: {
            type: 'string',
            description: 'Check-in date (YYYY-MM-DD)',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          checkOutDate: {
            type: 'string',
            description: 'Check-out date (YYYY-MM-DD)',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
        },
        required: ['propertyId', 'checkInDate', 'checkOutDate'],
      },
    },
    {
      name: 'lodgify_get_availability_calendar',
      description: 'Get a calendar view of availability for a property showing available and blocked dates.',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          fromDate: {
            type: 'string',
            description: 'Start date for calendar (YYYY-MM-DD). Defaults to today if not provided.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          daysToShow: {
            type: 'number',
            description: 'Number of days to show in calendar (1-90). Defaults to 30 days.',
            minimum: 1,
            maximum: 90,
          },
        },
        required: ['propertyId'],
      },
    },

    // Quote & Messaging Tools
    {
      name: 'lodgify_get_quote',
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
      name: 'lodgify_get_thread',
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

    // New Booking Management Tools
    {
      name: 'lodgify_create_booking',
      description: 'Create a new booking (POST /v2/bookings)',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'Booking details including property, dates, guest breakdown, and room types',
          },
        },
        required: ['payload'],
      },
    },
    {
      name: 'lodgify_update_booking',
      description: 'Update an existing booking (PUT /v2/reservations/bookings/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Booking ID',
          },
          payload: {
            type: 'object',
            description: 'Updated booking details',
          },
        },
        required: ['id', 'payload'],
      },
    },
    {
      name: 'lodgify_delete_booking',
      description: 'Delete/cancel a booking (DELETE /v2/reservations/bookings/{id})',
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

    // Property Management Tools
    {
      name: 'lodgify_update_property_availability',
      description: 'Update availability for a property (PUT /v2/properties/{propertyId}/availability)',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: {
            type: 'string',
            description: 'Property ID',
          },
          payload: {
            type: 'object',
            description: 'Availability update details including dates and availability status',
          },
        },
        required: ['propertyId', 'payload'],
      },
    },

    // Webhook Management Tools
    {
      name: 'lodgify_subscribe_webhook',
      description: 'Subscribe to a webhook event (POST /v2/webhooks/subscribe)',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'Webhook subscription details including event and target URL',
          },
        },
        required: ['payload'],
      },
    },
    {
      name: 'lodgify_list_webhooks',
      description: 'List all webhooks (GET /v2/webhooks)',
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
    {
      name: 'lodgify_delete_webhook',
      description: 'Unsubscribe/delete a webhook (DELETE /v2/webhooks/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID',
          },
        },
        required: ['id'],
      },
    },

    // Rate Management Tools
    {
      name: 'lodgify_create_rate',
      description: 'Create/update rates (POST /v2/rates)',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'Rate details including property, room type, dates, and rate amount',
          },
        },
        required: ['payload'],
      },
    },
    {
      name: 'lodgify_update_rate',
      description: 'Update a specific rate (PUT /v2/rates/{id})',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Rate ID',
          },
          payload: {
            type: 'object',
            description: 'Updated rate details',
          },
        },
        required: ['id', 'payload'],
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
      case 'lodgify_list_properties': {
        const input = ListPropertiesSchema.parse(args)
        result = await client.listProperties(input.params)
        break
      }

      case 'lodgify_get_property': {
        const input = GetPropertySchema.parse(args)
        result = await client.getProperty(input.id)
        break
      }

      case 'lodgify_list_property_rooms': {
        const input = ListPropertyRoomsSchema.parse(args)
        result = await client.listPropertyRooms(input.propertyId)
        break
      }

      case 'lodgify_list_deleted_properties': {
        const input = ListDeletedPropertiesSchema.parse(args)
        result = await client.listDeletedProperties(input.params)
        break
      }

      // Rates Management Tools
      case 'lodgify_daily_rates': {
        const input = DailyRatesSchema.parse(args)
        result = await client.getDailyRates(input.params)
        break
      }

      case 'lodgify_rate_settings': {
        const input = RateSettingsSchema.parse(args)
        result = await client.getRateSettings(input.params)
        break
      }

      // Booking Management Tools
      case 'lodgify_list_bookings': {
        const input = ListBookingsSchema.parse(args)
        result = await client.listBookings(input.params)
        break
      }

      case 'lodgify_get_booking': {
        const input = GetBookingSchema.parse(args)
        result = await client.getBooking(input.id)
        break
      }

      case 'lodgify_get_booking_payment_link': {
        const input = GetBookingPaymentLinkSchema.parse(args)
        result = await client.getBookingPaymentLink(input.id)
        break
      }

      case 'lodgify_create_booking_payment_link': {
        const input = CreateBookingPaymentLinkSchema.parse(args)
        result = await client.createBookingPaymentLink(input.id, input.payload)
        break
      }

      case 'lodgify_update_key_codes': {
        const input = UpdateKeyCodesSchema.parse(args)
        result = await client.updateKeyCodes(input.id, input.payload)
        break
      }

      // Availability Tools
      case 'lodgify_availability_room': {
        const input = AvailabilityRoomSchema.parse(args)
        result = await client.getAvailabilityRoom(input.propertyId, input.roomTypeId, input.params)
        break
      }

      case 'lodgify_availability_property': {
        const input = AvailabilityPropertySchema.parse(args)
        result = await client.getAvailabilityProperty(input.propertyId, input.params)
        break
      }

      // Quote & Messaging Tools
      case 'lodgify_get_quote': {
        const input = GetQuoteSchema.parse(args)
        result = await client.getQuote(input.propertyId, input.params)
        break
      }

      case 'lodgify_get_thread': {
        const input = GetThreadSchema.parse(args)
        result = await client.getThread(input.threadGuid)
        break
      }

      // New Booking Management Tools
      case 'lodgify_create_booking': {
        const input = CreateBookingSchema.parse(args)
        result = await client.createBooking(input.payload)
        break
      }

      case 'lodgify_update_booking': {
        const input = UpdateBookingSchema.parse(args)
        result = await client.updateBooking(input.id, input.payload)
        break
      }

      case 'lodgify_delete_booking': {
        const input = DeleteBookingSchema.parse(args)
        result = await client.deleteBooking(input.id)
        break
      }

      // Property Management Tools
      case 'lodgify_update_property_availability': {
        const input = UpdatePropertyAvailabilitySchema.parse(args)
        result = await client.updatePropertyAvailability(input.propertyId, input.payload)
        break
      }

      // Webhook Management Tools
      case 'lodgify_subscribe_webhook': {
        const input = WebhookSubscribeSchema.parse(args)
        result = await client.subscribeWebhook(input.payload)
        break
      }

      case 'lodgify_list_webhooks': {
        const input = ListWebhooksSchema.parse(args)
        result = await client.listWebhooks(input.params)
        break
      }

      case 'lodgify_delete_webhook': {
        const input = DeleteWebhookSchema.parse(args)
        result = await client.deleteWebhook(input.id)
        break
      }

      // Rate Management Tools
      case 'lodgify_create_rate': {
        const input = CreateRateSchema.parse(args)
        result = await client.createRate(input.payload)
        break
      }

      case 'lodgify_update_rate': {
        const input = UpdateRateSchema.parse(args)
        result = await client.updateRate(input.id, input.payload)
        break
      }

      // Enhanced Availability Helper Tools
      case 'lodgify_find_properties': {
        const input = FindPropertiesSchema.parse(args)
        result = await findProperties(client, input.searchTerm, input.includePropertyIds, input.limit)
        break
      }

      case 'lodgify_check_next_availability': {
        const input = CheckNextAvailabilitySchema.parse(args)
        result = await client.getNextAvailableDate(input.propertyId, input.fromDate, input.daysToCheck)
        break
      }

      case 'lodgify_check_date_range_availability': {
        const input = CheckDateRangeAvailabilitySchema.parse(args)
        result = await client.checkDateRangeAvailability(input.propertyId, input.checkInDate, input.checkOutDate)
        break
      }

      case 'lodgify_get_availability_calendar': {
        const input = GetAvailabilityCalendarSchema.parse(args)
        result = await client.getAvailabilityCalendar(input.propertyId, input.fromDate, input.daysToShow)
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
                details: error.issues,
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
      name: 'health_check',
      description: 'Check the health status of the Lodgify MCP server',
      mimeType: 'application/json',
    },
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  if (uri === 'lodgify://health') {
    const health = {
      status: 'healthy',
      service: 'lodgify-mcp',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
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

// Only run main if this is the entry point (not imported for testing)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/server.js')) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}