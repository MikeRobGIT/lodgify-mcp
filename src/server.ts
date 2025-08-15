#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { config } from 'dotenv'
import { LodgifyClient } from './lodgify.js'
import { safeLogger } from './logger.js'
import { loadEnvironment, type EnvConfig, isProduction } from './env.js'

/**
 * Helper function to find properties when exact property ID is unknown.
 * 
 * This utility function helps users discover property IDs by searching through
 * property names and extracting IDs from recent bookings. It provides a unified
 * interface for property discovery when users don't know the exact property
 * identifiers required by other API endpoints.
 * 
 * @param client - The LodgifyClient instance for making API calls
 * @param searchTerm - Optional search term to filter properties by name (case-insensitive)
 * @param includePropertyIds - Whether to include property IDs found in recent bookings (default: true)
 * @param limit - Maximum number of properties to return (default: 10, max: 50)
 * 
 * @returns Promise resolving to object containing:
 *   - properties: Array of property objects with id, name, and source
 *   - message: Descriptive message about the search results
 *   - suggestions: Array of helpful suggestions for improving search results
 * 
 * @example
 * ```typescript
 * // Find all properties
 * const result = await findProperties(client);
 * 
 * // Search by name
 * const result = await findProperties(client, "beach house");
 * 
 * // Limit results
 * const result = await findProperties(client, undefined, true, 5);
 * ```
 * 
 * @remarks
 * This function combines multiple data sources:
 * 1. Direct property listing from the properties API
 * 2. Property IDs extracted from recent bookings
 * 3. Name-based filtering with case-insensitive matching
 */
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

// Load environment variables with dotenv first
config()

// Load and validate environment configuration (only for production execution)
let envConfig: EnvConfig | undefined

function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    try {
      envConfig = loadEnvironment({ 
        allowTestKeys: process.env.NODE_ENV === 'test', // Allow test keys in test environment
        strictValidation: process.env.NODE_ENV !== 'test',
        logWarnings: process.env.NODE_ENV !== 'test'
      })
    } catch (error) {
      // In test environments, provide a minimal config
      if (process.env.NODE_ENV === 'test') {
        envConfig = {
          LODGIFY_API_KEY: 'test-api-key-for-testing-purposes-only',
          LOG_LEVEL: 'error' as const,
          DEBUG_HTTP: false,
          NODE_ENV: 'test' as const,
        }
      } else {
        // Log the error and exit if environment validation fails in production
        console.error('Environment validation failed:', error instanceof Error ? error.message : error)
        process.exit(1)
      }
    }
  }
  return envConfig
}

/**
 * Registers all Lodgify API tools with the McpServer instance.
 * 
 * This function registers 28+ tools covering the complete Lodgify API v2 surface,
 * including property management, booking operations, availability checking, rate
 * management, webhook handling, and utility functions. Each tool is registered
 * with comprehensive metadata, input schema validation, and error handling.
 * 
 * Tools are organized into categories:
 * - Property Management: CRUD operations for properties and rooms
 * - Booking Management: Complete booking lifecycle including payments
 * - Availability & Rates: Smart availability checking and rate management  
 * - Helper Tools: Enhanced functions for common use cases
 * - Webhook Management: Event subscription and management
 * - Resources: Health checks and server status
 * 
 * @param server - The McpServer instance to register tools with
 * @param client - The configured LodgifyClient for making API calls
 * 
 * @remarks
 * All tools include:
 * - Enhanced metadata with clear titles and descriptions
 * - Zod schema validation for type safety
 * - Structured error handling with JSON-RPC compliance
 * - Automatic parameter transformation for complex Lodgify API requirements
 * 
 * @example
 * ```typescript
 * const server = new McpServer(config);
 * const client = new LodgifyClient(apiKey);
 * registerTools(server, client);
 * ```
 */
/**
 * Tool categories for better organization and discovery
 */
const TOOL_CATEGORIES = {
  PROPERTY_MANAGEMENT: 'Property Management',
  BOOKING_MANAGEMENT: 'Booking & Reservation Management',
  AVAILABILITY: 'Availability & Calendar',
  RATES_PRICING: 'Rates & Pricing',
  WEBHOOKS: 'Webhooks & Notifications',
  PROPERTY_DISCOVERY: 'Property Discovery & Search',
  MESSAGING: 'Messaging & Communication'
} as const

/**
 * Tool deprecation registry
 * 
 * This system allows graceful handling of deprecated tools and API changes.
 * Deprecated tools will continue to work but will include deprecation warnings
 * in their descriptions and can log usage warnings.
 * 
 * @example
 * ```typescript
 * // To deprecate a tool:
 * DEPRECATED_TOOLS.tool_name = {
 *   since: '0.2.0',
 *   removeIn: '1.0.0',
 *   reason: 'Replaced by new_tool_name for better performance',
 *   replacement: 'new_tool_name'
 * }
 * ```
 */
interface DeprecationInfo {
  /** Version when deprecation started */
  since: string
  /** Version when tool will be removed (optional) */
  removeIn?: string
  /** Reason for deprecation */
  reason: string
  /** Suggested replacement tool (optional) */
  replacement?: string
  /** Whether to log usage warnings (default: true) */
  logWarnings?: boolean
}

const DEPRECATED_TOOLS: Record<string, DeprecationInfo> = {
  // Example deprecations showing how the system works
  'lodgify_availability_room': {
    since: '0.1.1',
    removeIn: '1.0.0',
    reason: 'Raw availability data is complex. Use availability helper tools for better results',
    replacement: 'lodgify_check_next_availability, lodgify_get_availability_calendar'
  },
  'lodgify_availability_property': {
    since: '0.1.1',
    removeIn: '1.0.0',
    reason: 'Raw availability data is complex. Use availability helper tools for better results',
    replacement: 'lodgify_check_next_availability, lodgify_get_availability_calendar'
  }
}

/**
 * Generate deprecation warning text for tool descriptions
 */
function generateDeprecationWarning(_toolName: string, info: DeprecationInfo): string {
  let warning = `⚠️ **DEPRECATED** (since v${info.since}): ${info.reason}`
  
  if (info.replacement) {
    warning += ` Please use '${info.replacement}' instead.`
  }
  
  if (info.removeIn) {
    warning += ` This tool will be removed in v${info.removeIn}.`
  }
  
  return warning
}

/**
 * Enhanced tool registration that handles deprecation warnings
 */
function registerToolWithDeprecation(
  server: McpServer,
  toolName: string,
  toolConfig: any,
  handler: any
): void {
  const deprecationInfo = DEPRECATED_TOOLS[toolName]
  
  if (deprecationInfo) {
    // Add deprecation warning to description
    const warning = generateDeprecationWarning(toolName, deprecationInfo)
    toolConfig.description = `${warning}\n\n${toolConfig.description}`
    
    // Wrap handler to log deprecation warnings
    const originalHandler = handler
    const wrappedHandler = async (args: any) => {
      if (deprecationInfo.logWarnings !== false) {
        safeLogger.warn(`Deprecated tool '${toolName}' used`, {
          tool: toolName,
          deprecatedSince: deprecationInfo.since,
          removeIn: deprecationInfo.removeIn,
          replacement: deprecationInfo.replacement,
          reason: deprecationInfo.reason
        })
      }
      return originalHandler(args)
    }
    
    server.registerTool(toolName, toolConfig, wrappedHandler)
  } else {
    // Register normally if not deprecated
    server.registerTool(toolName, toolConfig, handler)
  }
}

function registerTools(server: McpServer, client: LodgifyClient): void {
  // ============================================================================
  // PROPERTY MANAGEMENT TOOLS
  // Core tools for managing properties, rooms, and property configurations
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_list_properties',
    {
      title: 'List Properties',
      description: `[${TOOL_CATEGORIES.PROPERTY_MANAGEMENT}] List all properties with optional filtering and pagination. Returns property details including names, IDs, locations, and basic configuration. Supports filtering by status, location, and other criteria.

Example request:
{
  "params": {
    "limit": 10,
    "offset": 0,
    "status": "active"
  }
}

Example response:
{
  "data": [
    {
      "id": 123,
      "name": "Ocean View Villa",
      "location": "Miami Beach, FL",
      "status": "active",
      "rooms": 3,
      "currency": "USD"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0
  }
}`,
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Optional query parameters for filtering and pagination (e.g., limit, offset, status)')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.listProperties(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_property',
    {
      title: 'Get Property Details',
      description: `[${TOOL_CATEGORIES.PROPERTY_MANAGEMENT}] Retrieve comprehensive details for a specific property including configuration, amenities, room types, location information, and booking settings. Essential for understanding property structure before making bookings or checking availability.

Example request:
{
  "id": "123"
}

Example response:
{
  "id": 123,
  "name": "Ocean View Villa",
  "description": "Luxury beachfront villa with stunning ocean views",
  "location": {
    "address": "123 Ocean Drive",
    "city": "Miami Beach",
    "state": "FL",
    "country": "USA",
    "zipCode": "33139"
  },
  "amenities": ["WiFi", "Pool", "Beach Access", "Parking"],
  "roomTypes": [
    {
      "id": 456,
      "name": "Master Suite",
      "maxOccupancy": 2,
      "beds": 1
    }
  ],
  "currency": "USD",
  "checkInTime": "15:00",
  "checkOutTime": "11:00"
}`,
      inputSchema: {
        id: z.string().min(1).describe('Unique identifier of the property to retrieve'),
      }
    },
    async ({ id }) => {
      try {
        // Validate input directly since McpServer already parses the schema
        const result = await client.getProperty(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_list_property_rooms',
    {
      title: 'List Property Room Types',
      description: 'Retrieve all room types and configurations for a specific property. Returns room details including capacity, pricing structure, amenities, and booking rules. Use this before checking availability or making bookings to understand available accommodation options.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to list room types for'),
      }
    },
    async ({ propertyId }) => {
      try {
        const result = await client.listPropertyRooms(propertyId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_list_bookings',
    {
      title: 'List Bookings & Reservations',
      description: `[${TOOL_CATEGORIES.BOOKING_MANAGEMENT}] Retrieve all bookings with comprehensive filtering options. Filter by dates, status, property, guest information, and more. Returns booking details including guest info, dates, pricing, and payment status. Essential for managing reservations and analyzing booking patterns.

Example request (filter by date range):
{
  "params": {
    "start": "2024-03-01",
    "end": "2024-03-31",
    "limit": 10,
    "status": "confirmed"
  }
}

Example request (filter by property):
{
  "params": {
    "propertyId": "123",
    "limit": 5
  }
}

Example response:
{
  "data": [
    {
      "id": "BK001",
      "status": "confirmed",
      "propertyId": 123,
      "propertyName": "Ocean View Villa",
      "checkIn": "2024-03-15",
      "checkOut": "2024-03-22",
      "guests": {
        "adults": 2,
        "children": 0
      },
      "guest": {
        "name": "John Smith",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "totalAmount": 1750.00,
      "currency": "USD",
      "paymentStatus": "paid"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0
  }
}`,
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Optional query parameters for filtering (date range, status, property ID, guest details, etc.)')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.listBookings(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_booking',
    {
      title: 'Get Booking Details',
      description: 'Retrieve complete details for a specific booking including guest information, property details, room assignments, pricing breakdown, payment status, special requests, and booking timeline. Use this for customer service inquiries and detailed booking management.',
      inputSchema: {
        id: z.string().min(1).describe('Unique booking/reservation ID to retrieve'),
      }
    },
    async ({ id }) => {
      try {
        const result = await client.getBooking(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_find_properties',
    {
      title: 'Find Properties',
      description: `[${TOOL_CATEGORIES.PROPERTY_DISCOVERY}] Find properties in the system when you don't know the exact property ID. Searches properties by name, gets property IDs from bookings, or lists all properties.

Example request (search by name):
{
  "searchTerm": "beach",
  "includePropertyIds": true,
  "limit": 5
}

Example request (list all):
{
  "includePropertyIds": true,
  "limit": 10
}

Example response:
{
  "properties": [
    {
      "id": "123",
      "name": "Ocean View Beach House",
      "source": "properties"
    },
    {
      "id": "456", 
      "name": "Beachfront Villa",
      "source": "properties"
    },
    {
      "id": "789",
      "name": "Property found in booking #BK001",
      "source": "bookings"
    }
  ],
  "message": "Found 3 property(ies) matching \"beach\"",
  "suggestions": [
    "Use one of these property IDs with availability tools like lodgify_check_next_availability",
    "Property names are case-insensitive. Try partial matches for better results."
  ]
}`,
      inputSchema: {
        searchTerm: z.string().optional().describe('Optional search term to filter properties by name (case-insensitive)'),
        includePropertyIds: z.boolean().default(true).optional().describe('Include property IDs found in recent bookings (default: true)'),
        limit: z.number().min(1).max(50).default(10).optional().describe('Maximum number of properties to return (default: 10)'),
      }
    },
    async ({ searchTerm, includePropertyIds, limit }) => {
      try {
        const result = await findProperties(client, searchTerm, includePropertyIds, limit)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_delete_booking',
    {
      title: 'Cancel/Delete Booking',
      description: 'Permanently cancel and delete a booking from the system. This is a destructive operation that cannot be undone. Use with extreme caution and ensure proper authorization. Consider using booking modification instead of deletion when possible.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to cancel and delete permanently'),
      }
    },
    async ({ id }) => {
      try {
        const result = await client.deleteBooking(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Deleted Properties Tools
  registerToolWithDeprecation(
    server,
    'lodgify_list_deleted_properties',
    {
      title: 'List Deleted Properties',
      description: 'Retrieve properties that have been soft-deleted from the system. Useful for auditing, recovery operations, and understanding property lifecycle. Returns properties that were previously active but have been removed from general availability.',
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Optional query parameters for filtering deleted properties')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.listDeletedProperties(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Rates Management Tools
  registerToolWithDeprecation(
    server,
    'lodgify_daily_rates',
    {
      title: 'Get Daily Rates Calendar',
      description: 'Retrieve daily pricing calendar for properties showing rates across date ranges. Essential for pricing analysis, revenue optimization, and understanding seasonal rate variations. Returns detailed rate information including base rates, modifiers, and availability-based pricing.',
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .describe('Required: propertyId, from/to dates (YYYY-MM-DD format). Optional: roomTypeId, currency')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.getDailyRates(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_rate_settings',
    {
      title: 'Get Rate Settings & Configuration',
      description: 'Retrieve rate configuration settings including pricing rules, modifiers, seasonal adjustments, and rate calculation parameters. Essential for understanding how rates are calculated and configuring pricing strategies.',
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .describe('Query parameters for rate settings (propertyId, currency, etc.)')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.getRateSettings(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_create_rate',
    {
      title: 'Create/Update Rates',
      description: 'Create or update pricing rates for specific properties and room types over date ranges. Use this to set seasonal pricing, special event rates, or update base pricing. Rates can be set for specific date ranges and room types.',
      inputSchema: {
        payload: z.object({
          propertyId: z.string().min(1).describe('Property to set rates for'),
          roomTypeId: z.string().min(1).describe('Room type to set rates for'),
          from: z.string().min(1).describe('Start date (YYYY-MM-DD)'),
          to: z.string().min(1).describe('End date (YYYY-MM-DD)'),
          rate: z.number().positive().describe('Rate amount per night'),
          currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),
        }).describe('Rate details including property, room type, dates, and rate amount'),
      }
    },
    async ({ payload }) => {
      try {
        const result = await client.createRate(payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_update_rate',
    {
      title: 'Update Existing Rate',
      description: 'Modify an existing rate entry with new pricing, dates, or currency. Use this to adjust previously set rates, extend date ranges, or update pricing for specific rate periods. Requires the rate ID from previous rate operations.',
      inputSchema: {
        id: z.string().min(1).describe('Unique rate ID to update'),
        payload: z.object({
          rate: z.number().positive().optional().describe('New rate amount per night'),
          currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),
          from: z.string().optional().describe('New start date (YYYY-MM-DD)'),
          to: z.string().optional().describe('New end date (YYYY-MM-DD)'),
        }).describe('Updated rate details - only provided fields will be changed'),
      }
    },
    async ({ id, payload }) => {
      try {
        const result = await client.updateRate(id, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // ============================================================================
  // BOOKING & RESERVATION MANAGEMENT TOOLS
  // Tools for managing bookings, payments, and guest reservations
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_get_booking_payment_link',
    {
      title: 'Get Booking Payment Link',
      description: 'Retrieve existing payment link for a booking including payment status, amount due, and link expiration. Use this to check if a payment link already exists or to get current payment details for customer service inquiries.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to get payment link for'),
      }
    },
    async ({ id }) => {
      try {
        const result = await client.getBookingPaymentLink(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_create_booking_payment_link',
    {
      title: 'Create Booking Payment Link',
      description: 'Generate a secure payment link for a booking allowing guests to pay outstanding balances online. Useful for collecting deposits, final payments, or additional charges. The link will be sent to guests via email or can be shared directly.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to create payment link for'),
        payload: z.object({
          amount: z.number().positive().optional().describe('Payment amount (defaults to booking balance)'),
          currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),
          description: z.string().max(500).optional().describe('Payment description for guest'),
        }).describe('Payment link configuration - amount, currency, and description'),
      }
    },
    async ({ id, payload }) => {
      try {
        const result = await client.createBookingPaymentLink(id, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_update_key_codes',
    {
      title: 'Update Access Key Codes',
      description: 'Update access key codes for a booking to provide guests with property entry information. Used for smart locks, keypad codes, or other access control systems. Essential for self-check-in processes and property access management.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to update key codes for'),
        payload: z.object({
          keyCodes: z.array(z.string()).optional().describe('Array of access codes/keys for the property'),
        }).describe('Access key codes and entry information'),
      }
    },
    async ({ id, payload }) => {
      try {
        const result = await client.updateKeyCodes(id, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_create_booking',
    {
      title: 'Create New Booking',
      description: 'Create a new booking/reservation in the system. This will check availability, calculate pricing, and create a confirmed reservation. Ensure availability is checked first using availability tools before creating bookings to avoid conflicts.',
      inputSchema: {
        payload: z.object({
          propertyId: z.string().min(1).describe('Property ID to book'),
          from: z.string().min(1).describe('Check-in date (YYYY-MM-DD)'),
          to: z.string().min(1).describe('Check-out date (YYYY-MM-DD)'),
          guestBreakdown: z.object({
            adults: z.number().min(1).describe('Number of adult guests'),
            children: z.number().min(0).optional().describe('Number of children'),
            infants: z.number().min(0).optional().describe('Number of infants'),
          }).describe('Guest count breakdown'),
          roomTypes: z.array(z.object({
            id: z.string().min(1).describe('Room type ID'),
            quantity: z.number().min(1).optional().describe('Number of rooms (default: 1)'),
          })).describe('Room types and quantities to book'),
        }).describe('Complete booking details - property, dates, guests, and rooms'),
      }
    },
    async ({ payload }) => {
      try {
        const result = await client.createBooking(payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_update_booking',
    {
      title: 'Update Existing Booking',
      description: 'Modify an existing booking including dates, guest count, status, or other booking details. Use this for handling booking modifications, extensions, guest count changes, or status updates. Availability will be rechecked for date changes.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to update'),
        payload: z.object({
          status: z.string().optional().describe('New booking status (confirmed, cancelled, etc.)'),
          guestBreakdown: z.object({
            adults: z.number().min(1).optional().describe('Updated number of adult guests'),
            children: z.number().min(0).optional().describe('Updated number of children'),
            infants: z.number().min(0).optional().describe('Updated number of infants'),
          }).optional().describe('Updated guest count breakdown'),
          from: z.string().optional().describe('New check-in date (YYYY-MM-DD)'),
          to: z.string().optional().describe('New check-out date (YYYY-MM-DD)'),
        }).describe('Updated booking details - only provided fields will be changed'),
      }
    },
    async ({ id, payload }) => {
      try {
        const result = await client.updateBooking(id, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Availability Tools
  registerToolWithDeprecation(
    server,
    'lodgify_availability_room',
    {
      title: 'Get Raw Availability (Room)',
      description: 'Get raw availability data for a specific room type (GET /v2/availability/{propertyId}/{roomTypeId}). Note: This returns technical availability data. For easier availability checking, use lodgify_check_next_availability or lodgify_get_availability_calendar instead.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID'),
        roomTypeId: z.string().min(1).describe('Room Type ID'),
        params: z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('Start date (YYYY-MM-DD)'),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('End date (YYYY-MM-DD)'),
        }).optional().describe('Optional query parameters including from/to dates (YYYY-MM-DD format)'),
      }
    },
    async ({ propertyId, roomTypeId, params }) => {
      try {
        const result = await client.getAvailabilityRoom(propertyId, roomTypeId, params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_availability_property',
    {
      title: 'Get Raw Availability (Property)',
      description: 'Get raw availability data for a property (GET /v2/availability/{propertyId}). Note: This returns technical availability data. For easier availability checking, use lodgify_check_next_availability or lodgify_get_availability_calendar instead.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID'),
        params: z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('Start date (YYYY-MM-DD)'),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('End date (YYYY-MM-DD)'),
        }).optional().describe('Optional query parameters including from/to dates (YYYY-MM-DD format)'),
      }
    },
    async ({ propertyId, params }) => {
      try {
        const result = await client.getAvailabilityProperty(propertyId, params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // ============================================================================
  // AVAILABILITY & CALENDAR TOOLS
  // Enhanced helper tools for checking availability and calendar management
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_check_next_availability',
    {
      title: 'Find Next Available Date',
      description: `[${TOOL_CATEGORIES.AVAILABILITY}] Find the next available date for a property by analyzing bookings. Returns when the property is next available and for how long. If property ID is unknown, use lodgify_find_properties first.

Example request:
{
  "propertyId": "123",
  "fromDate": "2024-03-15",
  "daysToCheck": 90
}

Example response:
{
  "propertyId": 123,
  "nextAvailableDate": "2024-03-22",
  "availableDays": 7,
  "availableUntil": "2024-03-29",
  "message": "Next available from 2024-03-22 for 7 days",
  "recommendations": [
    "Check availability calendar for detailed daily status",
    "Consider checking different room types if property is fully booked"
  ]
}`,
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID'),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('Start date to check from (YYYY-MM-DD). Defaults to today if not provided.'),
        daysToCheck: z.number().min(1).max(365).optional().describe('Number of days to check ahead (1-365). Defaults to 90 days.'),
      }
    },
    async ({ propertyId, fromDate, daysToCheck }) => {
      try {
        const result = await client.getNextAvailableDate(propertyId, fromDate, daysToCheck)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_check_date_range_availability',
    {
      title: 'Check Date Range Availability',
      description: 'Verify if a specific date range is available for booking at a property. Returns detailed availability status including any conflicts or restrictions. Use this before creating bookings to ensure availability and avoid booking conflicts.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to check availability for'),
        checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').describe('Desired check-in date (YYYY-MM-DD)'),
        checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').describe('Desired check-out date (YYYY-MM-DD)'),
      }
    },
    async ({ propertyId, checkInDate, checkOutDate }) => {
      try {
        const result = await client.checkDateRangeAvailability(propertyId, checkInDate, checkOutDate)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_availability_calendar',
    {
      title: 'Get Availability Calendar View',
      description: 'Retrieve a visual calendar view of property availability showing available, booked, and blocked dates. Perfect for displaying availability to guests, planning maintenance windows, or understanding booking patterns over time.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to get calendar for'),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().describe('Calendar start date (YYYY-MM-DD). Defaults to today'),
        daysToShow: z.number().min(1).max(90).optional().describe('Number of days to display (1-90). Default: 30 days'),
      }
    },
    async ({ propertyId, fromDate, daysToShow }) => {
      try {
        const result = await client.getAvailabilityCalendar(propertyId, fromDate, daysToShow)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Quote & Messaging Tools
  registerToolWithDeprecation(
    server,
    'lodgify_get_quote',
    {
      title: 'Get Booking Quote & Pricing',
      description: 'Calculate detailed pricing quote for a property booking including room rates, taxes, fees, and total cost. Essential for providing accurate pricing to guests before booking confirmation. Supports complex parameters for multiple room types and add-ons.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to quote'),
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .describe('Quote parameters: dates (from/to), room types (roomTypes[0].Id), guest breakdown (guest_breakdown[adults]), add-ons. Uses bracket notation for complex parameters.')
      }
    },
    async ({ propertyId, params }) => {
      try {
        const result = await client.getQuote(propertyId, params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_thread',
    {
      title: 'Get Messaging Thread',
      description: 'Retrieve a messaging conversation thread including all messages, participants, and thread metadata. Use this for customer service inquiries, guest communication history, or managing ongoing conversations with guests and staff.',
      inputSchema: {
        threadGuid: z.string().min(1).describe('Unique thread identifier (GUID) for the conversation'),
      }
    },
    async ({ threadGuid }) => {
      try {
        const result = await client.getThread(threadGuid)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Property Management Tools
  registerToolWithDeprecation(
    server,
    'lodgify_update_property_availability',
    {
      title: 'Update Property Availability Rules',
      description: 'Modify property availability settings including blocking/opening dates, minimum stay requirements, and maximum stay limits. Use this to set maintenance periods, seasonal restrictions, or special booking rules for specific date ranges.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to update availability for'),
        payload: z.object({
          from: z.string().min(1).describe('Start date for availability change (YYYY-MM-DD)'),
          to: z.string().min(1).describe('End date for availability change (YYYY-MM-DD)'),
          available: z.boolean().describe('Whether property is available for booking in this period'),
          minStay: z.number().min(0).optional().describe('Minimum stay requirement in nights'),
          maxStay: z.number().min(0).optional().describe('Maximum stay limit in nights'),
        }).describe('Availability update configuration including dates, availability status, and stay restrictions'),
      }
    },
    async ({ propertyId, payload }) => {
      try {
        const result = await client.updatePropertyAvailability(propertyId, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Webhook Management Tools
  registerToolWithDeprecation(
    server,
    'lodgify_subscribe_webhook',
    {
      title: 'Subscribe to Webhook Events',
      description: 'Set up webhook subscriptions to receive real-time notifications for booking events, property changes, and other system updates. Essential for integrating external systems and automating workflows based on Lodgify events.',
      inputSchema: {
        payload: z.object({
          event: z.string().min(1).describe('Event type to subscribe to (e.g., booking.created, booking.updated)'),
          targetUrl: z.string().url().describe('HTTPS URL endpoint to receive webhook notifications'),
        }).describe('Webhook subscription configuration - event type and notification endpoint'),
      }
    },
    async ({ payload }) => {
      try {
        const result = await client.subscribeWebhook(payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  registerToolWithDeprecation(
    server,
    'lodgify_list_webhooks',
    {
      title: 'List Active Webhook Subscriptions',
      description: 'Retrieve all active webhook subscriptions including event types, target URLs, and subscription status. Use this to audit existing integrations, troubleshoot webhook delivery issues, or manage webhook configurations.',
      inputSchema: {
        params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Optional query parameters for filtering webhooks by status, event type, etc.')
      }
    },
    async ({ params }) => {
      try {
        const result = await client.listWebhooks(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )

  // Store handle for dangerous tool - can be disabled at runtime
  registerToolWithDeprecation(
    server,
    'lodgify_delete_webhook',
    {
      title: 'Delete Webhook Subscription',
      description: 'Permanently remove a webhook subscription and stop receiving event notifications. This is a destructive operation that cannot be undone. Use this to clean up unused integrations or when changing webhook configurations.',
      inputSchema: {
        id: z.string().min(1).describe('Webhook subscription ID to delete'),
      }
    },
    async ({ id }) => {
      try {
        const result = await client.deleteWebhook(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    }
  )
}

/**
 * Sanitizes error messages to prevent sensitive information leakage
 * @param message - The error message to sanitize
 * @returns Sanitized error message safe for client consumption
 */
function sanitizeErrorMessage(message: string): string {
  // Remove API keys - handle various patterns
  let sanitized = message
    .replace(/api[_-]?key[=:\s]+[\w-]+/gi, 'api_key=***')
    .replace(/authorization[=:\s]+bearer\s+[\w-]+/gi, 'authorization=Bearer ***')
    .replace(/x-api-key[=:\s]+[\w-]+/gi, 'x-api-key=***')
  
  // Remove URLs with credentials
  sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@[^\s]+/g, 'https://***:***@hostname')
  
  // Remove tokens and secrets
  sanitized = sanitized
    .replace(/token[=:\s]+[\w.-]+/gi, 'token=***')
    .replace(/secret[=:\s]+[\w.-]+/gi, 'secret=***')
    .replace(/password[=:\s]+[\w.-]+/gi, 'password=***')
  
  return sanitized
}

/**
 * Extracts safe error details while removing sensitive information
 * @param errorDetails - Raw error details object
 * @returns Sanitized error details safe for client consumption
 */
function sanitizeErrorDetails(errorDetails: any): any {
  if (!errorDetails || typeof errorDetails !== 'object') {
    return errorDetails
  }

  const sanitized = { ...errorDetails }
  
  // Remove sensitive fields
  const sensitiveFields = ['apiKey', 'api_key', 'authorization', 'x-api-key', 'token', 'secret', 'password']
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '***'
    }
  })
  
  // Sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeErrorMessage(sanitized[key])
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeErrorDetails(sanitized[key])
    }
  })
  
  return sanitized
}

/**
 * Helper function to handle tool errors with proper JSON-RPC error codes and security-focused sanitization.
 * 
 * This function processes errors from tool handlers and converts them into appropriate
 * McpError instances with proper JSON-RPC error codes. It includes security measures
 * to prevent sensitive information (API keys, tokens, credentials) from leaking to clients.
 * 
 * @param error - The error to handle (can be any type)
 * @throws {McpError} Always throws an appropriately formatted McpError
 * 
 * @remarks
 * Security features:
 * - Sanitizes error messages to remove API keys, tokens, and credentials
 * - Prevents sensitive environment information from leaking
 * - Provides appropriate error codes for different error types
 * - Maintains detailed logging while protecting client-facing messages
 */
function handleToolError(error: unknown): never {
  // Handle MCP errors (already properly formatted)
  if (error instanceof McpError) {
    // Sanitize existing MCP errors to ensure no sensitive data leaks
    const sanitizedMessage = sanitizeErrorMessage(error.message)
    const sanitizedData = error.data ? sanitizeErrorDetails(error.data) : undefined
    
    throw new McpError(error.code, sanitizedMessage, sanitizedData)
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Invalid input parameters',
      {
        validationErrors: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: sanitizeErrorMessage(issue.message),
          code: issue.code,
        }))
      }
    )
  }

  // Handle Lodgify API errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const sanitizedMessage = sanitizeErrorMessage(error.message)
    
    // Rate limiting errors
    if (message.includes('429') || message.includes('rate limit')) {
      throw new McpError(
        ErrorCode.RequestTimeout,
        'Rate limit exceeded. Please try again later.',
        { 
          originalError: sanitizedMessage,
          retryAfter: (error as any).retryAfter 
        }
      )
    }
    
    // Authentication errors - be extra careful not to leak API key info
    if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) {
      // Production vs development error messages
      const config = getEnvConfig()
      const errorMessage = isProduction(config) 
        ? 'Authentication failed. Please verify your API credentials.'
        : 'Authentication failed. Please check your API key configuration.'
      
      throw new McpError(
        ErrorCode.InvalidRequest,
        errorMessage,
        { 
          originalError: sanitizedMessage,
          hint: 'Check API key validity and permissions in your Lodgify account'
        }
      )
    }
    
    // Not found errors
    if (message.includes('404') || message.includes('not found')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Resource not found. Please verify the ID and your access permissions.',
        { originalError: sanitizedMessage }
      )
    }
    
    // Network errors
    if (message.includes('econnrefused') || message.includes('network') || message.includes('fetch')) {
      throw new McpError(
        ErrorCode.InternalError,
        'Network error occurred while connecting to Lodgify API. Please check your connection.',
        { 
          originalError: sanitizedMessage,
          hint: 'Verify internet connectivity and Lodgify service status'
        }
      )
    }
    
    // Generic API errors with details
    const errorDetails = (error as any)?.detail || (error as any)?.response?.data
    if (errorDetails) {
      throw new McpError(
        ErrorCode.InternalError,
        sanitizedMessage,
        sanitizeErrorDetails(errorDetails)
      )
    }
    
    // Default error handling
    throw new McpError(
      ErrorCode.InternalError,
      sanitizedMessage,
      { type: 'LodgifyAPIError' }
    )
  }

  // Unknown error type - be very careful about what we expose
  const errorString = String(error)
  const sanitizedError = sanitizeErrorMessage(errorString)
  
  throw new McpError(
    ErrorCode.InternalError,
    'An unexpected error occurred while processing your request',
    { error: sanitizedError }
  )
}

/**
 * Check the health status of all dependencies
 */
async function checkDependencies(client: LodgifyClient): Promise<Record<string, {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  lastChecked: string
  error?: string
  details?: string
}>> {
  const dependencies: Record<string, any> = {}
  
  // Check Lodgify API connectivity
  try {
    const startTime = Date.now()
    // Try to make a simple API call to test connectivity
    await client.listProperties({ limit: 1 })
    const responseTime = Date.now() - startTime
    
    dependencies.lodgifyApi = {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: 'Successfully connected to Lodgify API'
    }
  } catch (error) {
    dependencies.lodgifyApi = {
      status: 'unhealthy',
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to connect to Lodgify API'
    }
  }
  
  // Check environment variables
  const envVars = ['LODGIFY_API_KEY', 'LOG_LEVEL']
  const missingEnvVars = envVars.filter(envVar => 
    envVar === 'LODGIFY_API_KEY' ? !process.env[envVar] : false
  )
  
  dependencies.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    lastChecked: new Date().toISOString(),
    details: missingEnvVars.length === 0 
      ? 'All required environment variables are configured'
      : `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    ...(missingEnvVars.length > 0 && { error: `Missing: ${missingEnvVars.join(', ')}` })
  }
  
  // Check rate limit status
  const rateLimitStatus = client.getRateLimitStatus()
  dependencies.rateLimiting = {
    status: rateLimitStatus.utilizationPercent >= 95 ? 'degraded' : 'healthy',
    lastChecked: new Date().toISOString(),
    details: `API rate limit utilization: ${rateLimitStatus.utilizationPercent}% (${rateLimitStatus.requestCount}/${60} requests this minute)`
  }
  
  return dependencies
}

// Function to register resources with the McpServer
function registerResources(server: McpServer, client: LodgifyClient) {
  // Health check resource
  server.registerResource(
    'health',
    'lodgify://health',
    {
      title: 'Health Check',
      description: 'Check the health status of the Lodgify MCP server',
      mimeType: 'application/json',
    },
    async (uri) => {
      // Check dependencies
      const dependencies = await checkDependencies(client)
      
      // Determine overall status
      const allHealthy = Object.values(dependencies).every(dep => dep.status === 'healthy')
      const overallStatus = allHealthy ? 'healthy' : 'unhealthy'
      
      const health = {
        status: overallStatus,
        service: 'lodgify-mcp',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        dependencies,
        runtimeInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: Math.round(process.uptime()),
          memoryUsage: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
          }
        }
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(health, null, 2),
          },
        ],
      }
    }
  )

  // Rate limit status resource
  server.registerResource(
    'rate-limit',
    'lodgify://rate-limit',
    {
      title: 'Rate Limit Status',
      description: 'Monitor current API rate limit usage and status',
      mimeType: 'application/json',
    },
    async (uri) => {
      const rateLimitStatus = client.getRateLimitStatus()
      
      const status = {
        service: 'lodgify-api',
        rateLimitInfo: {
          ...rateLimitStatus,
          status: rateLimitStatus.utilizationPercent >= 95 ? 'critical' : 
                  rateLimitStatus.utilizationPercent >= 80 ? 'warning' : 'ok',
          recommendation: rateLimitStatus.utilizationPercent >= 95 
            ? 'Rate limit nearly exhausted. Consider reducing request frequency.' 
            : rateLimitStatus.utilizationPercent >= 80 
            ? 'High rate limit usage detected. Monitor closely.'
            : 'Rate limit usage is within normal range.'
        },
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      }
    }
  )

  // Deprecation registry resource
  server.registerResource(
    'deprecations',
    'lodgify://deprecations',
    {
      title: 'Tool Deprecation Registry',
      description: 'View current tool deprecation notices and upgrade recommendations',
      mimeType: 'application/json',
    },
    async (uri) => {
      const deprecationList = Object.entries(DEPRECATED_TOOLS).map(([toolName, info]) => ({
        tool: toolName,
        deprecatedSince: info.since,
        removeIn: info.removeIn || 'TBD',
        reason: info.reason,
        replacement: info.replacement,
        warning: generateDeprecationWarning(toolName, info)
      }))

      const registry = {
        service: 'lodgify-mcp-deprecations',
        totalDeprecatedTools: deprecationList.length,
        deprecations: deprecationList,
        recommendations: deprecationList.length > 0 ? [
          'Update your integration to use recommended replacement tools',
          'Test replacement tools before deprecated ones are removed',
          'Subscribe to release notes for deprecation announcements'
        ] : ['No deprecated tools - all tools are current'],
        timestamp: new Date().toISOString(),
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(registry, null, 2),
          },
        ],
      }
    }
  )
}

/**
 * Sets up and configures the Lodgify MCP server with all tools and resources.
 * 
 * This function creates a high-level McpServer instance using the latest SDK patterns,
 * registers all Lodgify API tools with enhanced metadata, declares server capabilities,
 * and configures robust error handling and notification management.
 * 
 * @param injectedClient - Optional pre-configured LodgifyClient for testing purposes.
 *                        If not provided, creates a new client using environment variables.
 * @returns Object containing the configured McpServer instance and LodgifyClient
 * 
 * @example
 * ```typescript
 * // Production usage
 * const { server, client } = setupServer();
 * 
 * // Testing usage with mock client
 * const mockClient = new MockLodgifyClient();
 * const { server, client } = setupServer(mockClient);
 * ```
 * 
 * @throws {Error} When LODGIFY_API_KEY environment variable is missing
 */
export function setupServer(injectedClient?: LodgifyClient) {
  const server = new McpServer(
    {
      name: 'lodgify-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {
          // We support all standard tool capabilities
          listChanged: true,  // Server can notify clients when tool list changes
        },
        resources: {
          // We support all standard resource capabilities
          subscribe: true,    // Clients can subscribe to resource changes
          listChanged: true,  // Server can notify clients when resource list changes
        },
        logging: {},          // Support for structured logging (if client requests it)
        // Note: We do not support prompts, so we don't declare that capability
      },
      // Enable notification debouncing to reduce client noise
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
      ],
    },
  )
  
  const client = injectedClient || (() => {
    // Use validated environment configuration instead of direct process.env access
    const config = getEnvConfig()
    return new LodgifyClient(config.LODGIFY_API_KEY)
  })()

  // Register tools and resources
  registerTools(server, client)
  registerResources(server, client)

  // Return server and client for testing
  return { server, client }
}

// Initialize server for production
const { server } = setupServer()


// ============================================================================
// Tool handlers are now implemented via registerTool calls above
// ============================================================================

// ============================================================================
// Resources are now registered in the registerResources function above
// ============================================================================

// ============================================================================
// Start Server
// ============================================================================

/**
 * Main entry point for the Lodgify MCP server.
 * 
 * Initializes the STDIO transport, configures error handling and graceful shutdown,
 * then connects the server and starts accepting MCP protocol messages.
 * Uses file-based logging to prevent interference with STDIO communication.
 * 
 * @remarks
 * This function:
 * 1. Creates a StdioServerTransport for MCP protocol communication
 * 2. Sets up error handling for transport issues (logged to file)
 * 3. Configures graceful shutdown on SIGINT/SIGTERM signals
 * 4. Connects the server to the transport and starts message processing
 * 5. Logs all events to files to maintain STDIO protocol compatibility
 * 
 * @throws {Error} If server connection fails or environment is misconfigured
 */
async function main() {
  const transport = new StdioServerTransport()

  // Handle errors
  transport.onerror = (error) => {
    safeLogger.error('Transport error:', error)
  }

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    safeLogger.info('Shutting down...')
    await server.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    safeLogger.info('Shutting down...')
    await server.close()
    process.exit(0)
  })

  // Connect and start server
  await server.connect(transport)
  safeLogger.info('Lodgify MCP server started successfully')
}

// Only run main if this is the entry point (not imported for testing)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/server.js')) {
  main().catch((error) => {
    safeLogger.error('Fatal error:', error)
    process.exit(1)
  })
}