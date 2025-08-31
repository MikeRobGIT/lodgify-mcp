#!/usr/bin/env node
import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { config } from 'dotenv'
import { type ZodRawShape, z } from 'zod'
import pkg from '../package.json' with { type: 'json' }
import { ReadOnlyModeError } from './core/errors/read-only-error.js'
import { type EnvConfig, isProduction, loadEnvironment } from './env.js'
import {
  type AvailabilityQueryParams,
  type BookingSearchParams,
  type DailyRatesParams,
  type KeyCodesRequest,
  LodgifyOrchestrator,
  type PaymentLinkRequest,
  type PropertySearchParams,
  type QuoteParams,
  type RateUpdateV1Request,
} from './lodgify-orchestrator.js'
import { safeLogger } from './logger.js'

// ============================================================================
// Common Zod Schemas for Lodgify API Parameter Validation
// ============================================================================

/**
 * Date format validation for YYYY-MM-DD format
 */
const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

/**
 * DateTime format validation for ISO 8601
 */
const DateTimeSchema = z.string().datetime({
  message: 'DateTime must be in ISO 8601 format (e.g., 2024-03-15T10:00:00Z)',
})

/**
 * Stay filter enum for booking queries
 */
const StayFilterEnum = z.enum([
  'Upcoming',
  'Current',
  'Historic',
  'All',
  'ArrivalDate',
  'DepartureDate',
])

/**
 * Trash filter enum for booking queries
 */
const TrashFilterEnum = z.enum(['False', 'True', 'All'])

// Type definitions for API responses
interface PropertyItem {
  id: string
  name?: string
  title?: string
}

interface PropertiesResponse {
  items?: PropertyItem[]
}

interface BookingItem {
  id?: string
  property_id?: string | number
  property_name?: string
}

interface BookingsResponse {
  items?: BookingItem[]
}

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
  client: LodgifyOrchestrator,
  searchTerm?: string,
  includePropertyIds: boolean = true,
  limit: number = 10,
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
      const propertiesData = (await client.properties.listProperties()) as
        | PropertiesResponse
        | PropertyItem[]
      const propertyList = Array.isArray(propertiesData)
        ? propertiesData
        : propertiesData?.items || []

      for (const property of propertyList.slice(0, limit)) {
        if (property.id) {
          const propertyName = property.name || property.title || ''
          const matchesSearch =
            !searchTerm || propertyName.toLowerCase().includes(searchTerm.toLowerCase())

          if (matchesSearch) {
            properties.push({
              id: property.id.toString(),
              name: propertyName,
              source: 'property_list',
            })
            propertyIds.add(property.id.toString())
          }
        }
      }
    } catch (_error) {
      suggestions.push('Property list API may not be available or accessible')
    }

    // Get property IDs from recent bookings if enabled
    if (includePropertyIds && properties.length < limit) {
      try {
        const bookingsData = (await client.bookings.listBookings()) as BookingsResponse
        const bookings: BookingItem[] = bookingsData?.items || []

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
            source: 'bookings',
          })
          propertyIds.add(propId)
        }
      } catch (_error) {
        suggestions.push('Could not retrieve property IDs from bookings')
      }
    }

    // Generate helpful suggestions
    if (properties.length === 0) {
      suggestions.push(
        'No properties found. Try using lodgify_list_properties to see all properties.',
      )
      suggestions.push('Check if your API key has proper permissions to access properties.')
    }

    if (properties.length > 0) {
      suggestions.push(
        'Use one of these property IDs with availability tools like lodgify_check_next_availability',
      )
      if (searchTerm) {
        suggestions.push(
          'Property names are case-insensitive. Try partial matches for better results.',
        )
      }
    }

    const message =
      properties.length > 0
        ? `Found ${properties.length} property(ies)${searchTerm ? ` matching "${searchTerm}"` : ''}`
        : `No properties found${searchTerm ? ` matching "${searchTerm}"` : ''}`

    return {
      properties,
      message,
      suggestions,
    }
  } catch (_error) {
    return {
      properties: [],
      message: 'Error searching for properties',
      suggestions: [
        'Check your API key and permissions',
        'Try using lodgify_list_properties directly',
        'Verify your network connection',
      ],
    }
  }
}

// Store MCP-provided environment variables before dotenv loads
const mcpReadOnly = process.env.LODGIFY_READ_ONLY
const mcpApiKey = process.env.LODGIFY_API_KEY

// Debug logging to understand environment variable flow
if (process.env.DEBUG_HTTP === '1') {
  safeLogger.info('[ENV DEBUG] Before dotenv:', {
    LODGIFY_READ_ONLY: mcpReadOnly,
    LODGIFY_API_KEY_present: !!mcpApiKey,
    source: 'MCP or pre-existing env',
  })
}

// Load environment variables from .env file
// Use override: false to prevent .env from overriding existing environment variables (like those from MCP)
config({ override: false })

// Debug logging after dotenv
if (process.env.DEBUG_HTTP === '1') {
  safeLogger.info('[ENV DEBUG] After dotenv:', {
    LODGIFY_READ_ONLY: process.env.LODGIFY_READ_ONLY,
    LODGIFY_API_KEY_present: !!process.env.LODGIFY_API_KEY,
    mcpReadOnly_was: mcpReadOnly,
  })
}

// Ensure MCP environment variables take precedence (belt and suspenders approach)
if (mcpReadOnly !== undefined) {
  process.env.LODGIFY_READ_ONLY = mcpReadOnly
  if (process.env.DEBUG_HTTP === '1') {
    safeLogger.info('[ENV DEBUG] Restored MCP value:', {
      LODGIFY_READ_ONLY: process.env.LODGIFY_READ_ONLY,
    })
  }
}
if (mcpApiKey !== undefined) {
  process.env.LODGIFY_API_KEY = mcpApiKey
}

// Load and validate environment configuration (only for production execution)
let envConfig: EnvConfig | undefined
let envValidationError: Error | undefined

function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    // Log environment variables for debugging (only on first load)
    safeLogger.info('Server starting with environment:', {
      LODGIFY_READ_ONLY: process.env.LODGIFY_READ_ONLY,
      LODGIFY_READ_ONLY_type: typeof process.env.LODGIFY_READ_ONLY,
      LODGIFY_READ_ONLY_value:
        process.env.LODGIFY_READ_ONLY === undefined
          ? 'undefined'
          : `"${process.env.LODGIFY_READ_ONLY}"`,
      LODGIFY_API_KEY_present: !!process.env.LODGIFY_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      source: process.env.LODGIFY_READ_ONLY ? 'MCP or ENV' : 'not set',
    })

    // Additional debug logging for read-only mode
    if (process.env.LODGIFY_READ_ONLY !== undefined) {
      safeLogger.info(
        '[ENV DEBUG] getEnvConfig called with LODGIFY_READ_ONLY:',
        process.env.LODGIFY_READ_ONLY,
      )
    }

    try {
      envConfig = loadEnvironment({
        allowTestKeys: process.env.NODE_ENV === 'test',
        strictValidation: process.env.NODE_ENV !== 'test',
        logWarnings: process.env.NODE_ENV !== 'test',
      })
    } catch (error) {
      // Store validation error for lazy client initialization
      envValidationError = error instanceof Error ? error : new Error(String(error))

      // Log if using fallback config (keeping minimal logging for troubleshooting)
      if (process.env.DEBUG_HTTP === '1') {
        safeLogger.warn('Using fallback configuration', {
          reason: envValidationError.message,
        })
      }

      // Provide fallback config to allow MCP server to start
      envConfig = {
        LODGIFY_API_KEY: process.env.LODGIFY_API_KEY || 'invalid-key',
        LOG_LEVEL: (process.env.LOG_LEVEL as EnvConfig['LOG_LEVEL']) || 'error',
        DEBUG_HTTP: process.env.DEBUG_HTTP === '1',
        // Handle all variations: '0', 'false', false (as string), undefined → write-enabled
        // '1', 'true', true (as string) → read-only mode
        LODGIFY_READ_ONLY: (() => {
          const val = process.env.LODGIFY_READ_ONLY
          if (!val || val === '' || val === '0' || val === 'false') {
            return false // Write-enabled
          }
          return val === '1' || val === 'true' // Read-only
        })(),
        NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'production',
      }
    }
  }
  return envConfig
}

/**
 * Check if environment is properly validated
 */
function isEnvValid(): boolean {
  return !envValidationError
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
  MESSAGING: 'Messaging & Communication',
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
  // Note: Previously deprecated tools that don't exist in the official API have been removed
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
function registerToolWithDeprecation<TInput extends ZodRawShape = ZodRawShape>(
  server: McpServer,
  toolName: string,
  toolConfig: {
    title?: string
    description?: string
    inputSchema?: TInput
  },
  handler: ToolCallback<TInput>,
): void {
  const deprecationInfo = DEPRECATED_TOOLS[toolName]

  if (deprecationInfo) {
    // Add deprecation warning to description
    const warning = generateDeprecationWarning(toolName, deprecationInfo)
    toolConfig.description = `${warning}\n\n${toolConfig.description}`

    // Wrap handler to log deprecation warnings
    const originalHandler = handler
    // Create a properly typed wrapper that handles both cases
    const wrappedHandler = async (input: TInput) => {
      if (deprecationInfo.logWarnings !== false) {
        safeLogger.warn(`Deprecated tool '${toolName}' used`, {
          tool: toolName,
          deprecatedSince: deprecationInfo.since,
          removeIn: deprecationInfo.removeIn,
          replacement: deprecationInfo.replacement,
          reason: deprecationInfo.reason,
        })
      }
      // Call original handler with the arguments
      // The handler is already properly typed, so this maintains type safety
      // @ts-expect-error - Handler may be called with different argument patterns
      return originalHandler(input)
    }

    server.registerTool(toolName, toolConfig, wrappedHandler as unknown as ToolCallback<TInput>)
  } else {
    // Register normally if not deprecated
    server.registerTool(toolName, toolConfig, handler)
  }
}

/**
 * Validates and formats quote parameters to ensure they meet Lodgify API requirements
 */
function validateQuoteParams(params: Record<string, unknown>): Record<string, unknown> {
  const validatedParams: Record<string, unknown> = { ...params }

  // Check for required parameters
  if (!params.from || !params.to) {
    throw new Error('Quote requires both "from" and "to" date parameters (YYYY-MM-DD format)')
  }

  // Validate date format (basic check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(String(params.from))) {
    throw new Error('Invalid "from" date format. Use YYYY-MM-DD format')
  }
  if (!dateRegex.test(String(params.to))) {
    throw new Error('Invalid "to" date format. Use YYYY-MM-DD format')
  }

  // Ensure guest_breakdown[adults] is provided
  if (!params['guest_breakdown[adults]'] && !validatedParams.adults) {
    validatedParams['guest_breakdown[adults]'] = 2 // Default to 2 adults
  }

  // Ensure guest_breakdown[children] is provided (required by API)
  if (
    !params['guest_breakdown[children]'] &&
    validatedParams['guest_breakdown[children]'] === undefined
  ) {
    validatedParams['guest_breakdown[children]'] = 0 // Default to 0 children
  }

  // Set default values for optional parameters if not provided
  if (!params.includeExtras && params.includeExtras !== false) {
    validatedParams.includeExtras = false
  }
  if (!params.includeBreakdown && params.includeBreakdown !== false) {
    validatedParams.includeBreakdown = true
  }

  return validatedParams
}

function registerTools(server: McpServer, getClient: () => LodgifyOrchestrator): void {
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
  "wid": 12345,
  "updatedSince": "2024-01-01T00:00:00Z",
  "includeCount": true,
  "includeInOut": false,
  "page": 1,
  "size": 10
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
    "page": 1,
    "size": 10
  }
}`,
      inputSchema: {
        wid: z.number().int().optional().describe('Website ID'),
        updatedSince: z
          .string()
          .datetime()
          .optional()
          .describe('Return only properties modified since this datetime'),
        includeCount: z.boolean().default(false).describe('Return the total number of results'),
        includeInOut: z
          .boolean()
          .default(false)
          .describe('Include available dates for arrival or departure'),
        page: z.number().int().min(1).default(1).describe('Page number to retrieve'),
        size: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(50)
          .describe('Number of items per page (max 50)'),
      },
    },
    async (params) => {
      try {
        // Map MCP parameters to API parameters
        const mappedParams: PropertySearchParams = {}
        if (params.size !== undefined) mappedParams.limit = params.size
        if (params.page !== undefined) mappedParams.offset = (params.page - 1) * (params.size || 50)
        if (params.wid !== undefined) mappedParams.wid = params.wid
        if (params.updatedSince !== undefined) mappedParams.updatedSince = params.updatedSince
        if (params.includeCount !== undefined) mappedParams.includeCount = params.includeCount
        if (params.includeInOut !== undefined) mappedParams.includeInOut = params.includeInOut

        const result = await getClient().properties.listProperties(mappedParams)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_property',
    {
      title: 'Get Property Details',
      description: `[${TOOL_CATEGORIES.PROPERTY_MANAGEMENT}] Retrieve comprehensive details for a specific property including configuration, amenities, room types, location information, and booking settings. Essential for understanding property structure before making bookings or checking availability.

Example request:
{
  "id": 123,
  "wid": 456,
  "includeInOut": true
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
        id: z.number().int().describe('Property ID (required)'),
        wid: z.number().int().optional().describe('Website ID'),
        includeInOut: z
          .boolean()
          .default(false)
          .describe('Include available dates for arrival or departure'),
      },
    },
    async ({ id, wid, includeInOut }) => {
      try {
        // Build params object for the API call
        const params: { wid?: number; includeInOut?: boolean } = {}
        if (wid !== undefined) params.wid = wid
        if (includeInOut !== undefined) params.includeInOut = includeInOut

        // Call with property ID and optional query params
        const result = await getClient().properties.getProperty(
          id.toString(),
          Object.keys(params).length > 0 ? params : undefined,
        )
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_list_property_rooms',
    {
      title: 'List Property Room Types',
      description:
        'Retrieve all room types and configurations for a specific property. Returns room details including capacity, pricing structure, amenities, and booking rules. Use this before checking availability or making bookings to understand available accommodation options.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to list room types for'),
      },
    },
    async ({ propertyId }) => {
      try {
        const result = await getClient().properties.listPropertyRooms(propertyId)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_list_bookings',
    {
      title: 'List Bookings & Reservations',
      description: `[${TOOL_CATEGORIES.BOOKING_MANAGEMENT}] Retrieve all bookings with comprehensive filtering options. Filter by dates, status, property, guest information, and more. Returns booking details including guest info, dates, pricing, and payment status. Essential for managing reservations and analyzing booking patterns.

Note: Maximum page size is 50 items per request.

Example request (filter by stay dates):
{
  "page": 1,
  "size": 10,
  "includeCount": true,
  "stayFilter": "Upcoming",
  "updatedSince": "2024-03-01T00:00:00Z",
  "includeTransactions": false,
  "includeQuoteDetails": false
}

Example request (filter by arrival date):
{
  "stayFilter": "ArrivalDate",
  "stayFilterDate": "2024-03-15T00:00:00Z",
  "size": 5
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
        page: z.number().int().min(1).default(1).describe('Page number to retrieve'),
        size: z.number().int().min(1).max(50).default(50).describe('Number of items per page'),
        includeCount: z.boolean().default(false).describe('Include total number of results'),
        stayFilter: StayFilterEnum.optional().describe('Filter bookings by stay dates'),
        stayFilterDate: DateTimeSchema.optional().describe(
          'Date to filter when using ArrivalDate or DepartureDate in stayFilter',
        ),
        updatedSince: DateTimeSchema.optional().describe(
          'Include only bookings updated since this date',
        ),
        includeTransactions: z
          .boolean()
          .default(false)
          .describe('Include details about transactions and schedule'),
        includeExternal: z.boolean().default(false).describe('Include external bookings'),
        includeQuoteDetails: z.boolean().default(false).describe('Include quote details'),
        trash: TrashFilterEnum.optional().describe('Query bookings that are in trash'),
      },
    },
    async (params) => {
      try {
        // Map MCP parameters to API parameters
        const mappedParams: BookingSearchParams = {}
        if (params.size !== undefined) mappedParams.limit = params.size
        if (params.page !== undefined) mappedParams.offset = (params.page - 1) * (params.size || 50)
        if (params.includeCount !== undefined) mappedParams.includeCount = params.includeCount
        if (params.stayFilter !== undefined) mappedParams.stayFilter = params.stayFilter
        if (params.stayFilterDate !== undefined) mappedParams.stayFilterDate = params.stayFilterDate
        if (params.updatedSince !== undefined) mappedParams.updatedSince = params.updatedSince
        if (params.includeTransactions !== undefined)
          mappedParams.includeTransactions = params.includeTransactions
        if (params.includeExternal !== undefined)
          mappedParams.includeExternal = params.includeExternal
        if (params.includeQuoteDetails !== undefined)
          mappedParams.includeQuoteDetails = params.includeQuoteDetails
        if (params.trash !== undefined) mappedParams.trash = params.trash

        const result = await getClient().bookings.listBookings(mappedParams)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_booking',
    {
      title: 'Get Booking Details',
      description:
        'Retrieve complete details for a specific booking including guest information, property details, room assignments, pricing breakdown, payment status, special requests, and booking timeline. Use this for customer service inquiries and detailed booking management.',
      inputSchema: {
        id: z.string().min(1).describe('Unique booking/reservation ID to retrieve'),
      },
    },
    async ({ id }) => {
      try {
        const result = await getClient().bookings.getBooking(id)
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
    },
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
  "message": "Found 3 property(ies) matching "beach"",
  "suggestions": [
    "Use one of these property IDs with availability tools like lodgify_check_next_availability",
    "Property names are case-insensitive. Try partial matches for better results."
  ]
}`,
      inputSchema: {
        searchTerm: z
          .string()
          .optional()
          .describe('Optional search term to filter properties by name (case-insensitive)'),
        includePropertyIds: z
          .boolean()
          .default(true)
          .optional()
          .describe('Include property IDs found in recent bookings (default: true)'),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .optional()
          .describe('Maximum number of properties to return (default: 10)'),
      },
    },
    async ({ searchTerm, includePropertyIds, limit }) => {
      try {
        const result = await findProperties(getClient(), searchTerm, includePropertyIds, limit)
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
    },
  )

  // Deleted Properties Tools
  registerToolWithDeprecation(
    server,
    'lodgify_list_deleted_properties',
    {
      title: 'List Deleted Properties',
      description:
        'Retrieve properties that have been soft-deleted from the system. Useful for auditing, recovery operations, and understanding property lifecycle. Returns properties that were previously active but have been removed from general availability.',
      inputSchema: {
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe(
            'Optional query parameters. Available: deletedSince (date-time, filter properties deleted after this date)',
          ),
      },
    },
    async ({ params }) => {
      try {
        const result = await getClient().properties.listDeletedProperties(params)
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
    },
  )

  // Rates Management Tools
  registerToolWithDeprecation(
    server,
    'lodgify_daily_rates',
    {
      title: 'Get Daily Pricing Rates',
      description: `View daily pricing rates for properties across date ranges. This shows the actual nightly rates that would be charged for specific dates. Use this tool to check prices BEFORE creating a booking.

✅ Use this for: Price checking, rate analysis, understanding seasonal pricing
❌ Don't use lodgify_get_quote for new pricing - that's only for existing booking quotes

Essential for pricing analysis, revenue optimization, and understanding seasonal rate variations. Returns detailed rate information including base rates, modifiers, and availability-based pricing.
      
Example request:
{
  "roomTypeId": 123,
  "houseId": 456,
  "startDate": "2024-03-01",
  "endDate": "2024-03-31"
}`,
      inputSchema: {
        roomTypeId: z.number().int().describe('Room Type ID (required)'),
        houseId: z.number().int().describe('House/Property ID (required)'),
        startDate: DateStringSchema.describe('Start date for rates calendar (YYYY-MM-DD)'),
        endDate: DateStringSchema.describe('End date for rates calendar (YYYY-MM-DD)'),
      },
    },
    async ({ roomTypeId, houseId, startDate, endDate }) => {
      try {
        // Map MCP parameters to API parameters
        const params: DailyRatesParams = {
          propertyId: houseId.toString(),
          roomTypeId: roomTypeId.toString(),
          from: startDate,
          to: endDate,
        }
        const result = await getClient().rates.getDailyRates(params)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_rate_settings',
    {
      title: 'Get Rate Configuration Settings',
      description:
        'Retrieve rate configuration settings including pricing rules, modifiers, seasonal adjustments, and rate calculation parameters. This shows HOW rates are calculated, not the actual prices themselves. Use lodgify_daily_rates to view actual pricing. Essential for understanding rate calculation logic and configuring pricing strategies.',
      inputSchema: {
        params: z
          .object({
            houseId: z.number().int().optional().describe('House/Property ID'),
          })
          .optional()
          .describe('Query parameters for rate settings'),
      },
    },
    async ({ params }) => {
      try {
        // Map houseId to propertyId if provided
        const rateParams = params?.houseId ? { propertyId: params.houseId.toString() } : {}
        const result = await getClient().rates.getRateSettings(rateParams)
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
    },
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
      description:
        'Retrieve existing payment link for a booking including payment status, amount due, and link expiration. Use this to check if a payment link already exists or to get current payment details for customer service inquiries.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to get payment link for'),
      },
    },
    async ({ id }) => {
      try {
        const result = await getClient().bookings.getBookingPaymentLink(id)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_create_booking_payment_link',
    {
      title: 'Create Booking Payment Link',
      description:
        'Generate a secure payment link for a booking allowing guests to pay outstanding balances online. Useful for collecting deposits, final payments, or additional charges. The link will be sent to guests via email or can be shared directly.',
      inputSchema: {
        id: z.string().min(1).describe('Booking ID to create payment link for'),
        payload: z
          .object({
            amount: z
              .number()
              .positive()
              .optional()
              .describe('Payment amount (defaults to booking balance)'),
            currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),
            description: z.string().max(500).optional().describe('Payment description for guest'),
          })
          .describe('Payment link configuration - amount, currency, and description'),
      },
    },
    async ({ id, payload }) => {
      try {
        // PaymentLinkRequest requires amount and currency to be provided
        const paymentRequest: PaymentLinkRequest = {
          amount: payload.amount ?? 0,
          currency: payload.currency ?? 'USD',
          description: payload.description,
        }
        const result = await getClient().bookings.createBookingPaymentLink(id, paymentRequest)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_update_key_codes',
    {
      title: 'Update Access Key Codes',
      description:
        'Update access key codes for a booking to provide guests with property entry information. Used for smart locks, keypad codes, or other access control systems. Essential for self-check-in processes and property access management.',
      inputSchema: {
        id: z.number().int().describe('Booking ID to update key codes for'),
        payload: z
          .object({
            keyCodes: z
              .array(z.string())
              .optional()
              .describe('Array of access codes/keys for the property'),
          })
          .describe('Access key codes and entry information'),
      },
    },
    async ({ id, payload }) => {
      try {
        // KeyCodesRequest requires keyCodes to be provided
        const keyCodesRequest: KeyCodesRequest = {
          keyCodes: payload.keyCodes ?? [],
        }
        const result = await getClient().bookings.updateKeyCodes(id.toString(), keyCodesRequest)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_checkin_booking',
    {
      title: 'Check-in Booking',
      description:
        'Mark a booking as checked in. Updates the booking status to reflect that the guest has arrived and checked into the property. Essential for tracking guest arrivals and property occupancy.',
      inputSchema: {
        id: z.number().int().describe('Booking ID to check in'),
        time: z
          .string()
          .datetime()
          .describe('Check-in time in ISO 8601 date-time format (required)'),
      },
    },
    async ({ id, time }) => {
      try {
        const result = await getClient().bookings.checkinBooking(id.toString(), time)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_checkout_booking',
    {
      title: 'Check-out Booking',
      description:
        'Mark a booking as checked out. Updates the booking status to reflect that the guest has departed from the property. Essential for tracking guest departures and property availability.',
      inputSchema: {
        id: z.number().int().describe('Booking ID to check out'),
        time: z
          .string()
          .datetime()
          .describe('Check-out time in ISO 8601 date-time format (required)'),
      },
    },
    async ({ id, time }) => {
      try {
        const result = await getClient().bookings.checkoutBooking(id.toString(), time)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_external_bookings',
    {
      title: 'Get External Bookings',
      description:
        'Retrieve external bookings associated with a property. These are bookings made through external channels (OTAs like Booking.com, Airbnb, etc.) that are synchronized with Lodgify. Useful for understanding the full booking picture across all channels.',
      inputSchema: {
        id: z.string().min(1).describe('Property ID to get external bookings for'),
      },
    },
    async ({ id }) => {
      try {
        const result = await getClient().bookings.getExternalBookings(id)
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
    },
  )

  // Availability Tools
  registerToolWithDeprecation(
    server,
    'lodgify_availability_all',
    {
      title: 'Get All Availabilities',
      description:
        'Get all availabilities for the calling user. Returns availability information for all properties for a given period.',
      inputSchema: {
        params: z
          .object({
            start: z
              .string()
              .datetime()
              .optional()
              .describe('Calendar start date (ISO 8601 date-time)'),
            end: z
              .string()
              .datetime()
              .optional()
              .describe('Calendar end date (ISO 8601 date-time)'),
          })
          .optional()
          .describe('Optional query parameters for filtering availabilities'),
      },
    },
    async ({ params }) => {
      try {
        const queryParams: AvailabilityQueryParams = {
          from: params?.start,
          to: params?.end,
        }
        const result = await getClient().availability.getAvailabilityAll(queryParams)
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
    },
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
        fromDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .optional()
          .describe('Start date to check from (YYYY-MM-DD). Defaults to today if not provided.'),
        daysToCheck: z
          .number()
          .min(1)
          .max(365)
          .optional()
          .describe('Number of days to check ahead (1-365). Defaults to 90 days.'),
      },
    },
    async ({ propertyId, fromDate, daysToCheck }) => {
      try {
        const result = await getClient().availability.getNextAvailableDate(
          propertyId,
          fromDate,
          daysToCheck,
        )
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_check_date_range_availability',
    {
      title: 'Check Date Range Availability',
      description:
        'Verify if a specific date range is available for booking at a property. Returns detailed availability status including any conflicts or restrictions. Use this before creating bookings to ensure availability and avoid booking conflicts.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to check availability for'),
        checkInDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .describe('Desired check-in date (YYYY-MM-DD)'),
        checkOutDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .describe('Desired check-out date (YYYY-MM-DD)'),
      },
    },
    async ({ propertyId, checkInDate, checkOutDate }) => {
      try {
        const result = await getClient().availability.checkDateRangeAvailability(
          propertyId,
          checkInDate,
          checkOutDate,
        )
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_availability_calendar',
    {
      title: 'Get Availability Calendar View',
      description:
        'Retrieve a visual calendar view of property availability showing available, booked, and blocked dates. Perfect for displaying availability to guests, planning maintenance windows, or understanding booking patterns over time.',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID to get calendar for'),
        fromDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
          .optional()
          .describe('Calendar start date (YYYY-MM-DD). Defaults to today'),
        daysToShow: z
          .number()
          .min(1)
          .max(90)
          .optional()
          .describe('Number of days to display (1-90). Default: 30 days'),
      },
    },
    async ({ propertyId, fromDate, daysToShow }) => {
      try {
        const result = await getClient().availability.getAvailabilityCalendar(
          propertyId,
          fromDate,
          daysToShow,
        )
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
    },
  )

  // Quote & Messaging Tools
  registerToolWithDeprecation(
    server,
    'lodgify_get_quote',
    {
      title: 'Get Existing Booking Quote',
      description:
        'Retrieve an existing quote that was created when a booking was made. Quotes are associated with bookings and contain the pricing details that were calculated at booking time.\n\n⚠️ Important: This does NOT calculate new pricing. Use lodgify_daily_rates to view current pricing before creating a booking.\n\nWorkflow: Check prices with lodgify_daily_rates → Create booking → Use this tool to retrieve the quote from that booking.\n\nRequired parameters: "from" and "to" dates in YYYY-MM-DD format, plus guest breakdown.\n\nExample: {"from": "2025-09-01", "to": "2025-09-03", "guest_breakdown[adults]": 2}',
      inputSchema: {
        propertyId: z.string().min(1).describe('Property ID with existing booking/quote'),
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .describe(
            'Quote retrieval parameters: dates (from/to) that match the booking, room types (roomTypes[0].Id), guest breakdown (guest_breakdown[adults]). Uses bracket notation for complex parameters.',
          ),
      },
    },
    async ({ propertyId, params }) => {
      try {
        // Validate and format parameters before making the API call
        const validatedParams = validateQuoteParams(params)

        // Pass validated params as QuoteParams (which supports bracket notation)
        const result = await getClient().quotes.getQuoteRaw(
          propertyId,
          validatedParams as QuoteParams,
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error) {
        // Handle validation errors specifically for quotes
        if (
          error instanceof Error &&
          (error.message.includes('Quote requires') ||
            error.message.includes('Invalid') ||
            error.message.includes('date format'))
        ) {
          throw new McpError(ErrorCode.InvalidParams, `Quote validation error: ${error.message}`)
        }

        // Handle common API responses that indicate property configuration issues
        if (error instanceof Error) {
          if (
            error.message?.includes('Invalid dates') ||
            (error.message?.includes('400') && error.message?.includes('Invalid dates'))
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Property may not have availability calendar configured or dates are outside available range. Check property in_out_max_date field.',
            )
          }
        }

        handleToolError(error)
      }
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_get_thread',
    {
      title: 'Get Messaging Thread',
      description:
        'Retrieve a messaging conversation thread including all messages, participants, and thread metadata. Use this for customer service inquiries, guest communication history, or managing ongoing conversations with guests and staff.',
      inputSchema: {
        threadGuid: z
          .string()
          .min(1)
          .describe('Unique thread identifier (GUID) for the conversation'),
      },
    },
    async ({ threadGuid }) => {
      try {
        const result = await getClient().messaging.getThread(threadGuid)
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
    },
  )

  // Property Management Tools

  // ============================================================================
  // Webhook Management Tools (v1 API)
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_list_webhooks',
    {
      title: 'List Webhooks',
      description: `[${TOOL_CATEGORIES.WEBHOOKS}] List all webhook subscriptions configured for the account. Returns webhook details including event types, target URLs, status, and last triggered timestamps. Essential for monitoring and managing webhook integrations.
      
Example response:
{
  "webhooks": [
    {
      "id": "webhook_123",
      "event": "booking_new_status_booked",
      "target_url": "https://example.com/webhooks/lodgify",
      "created_at": "2024-01-15T10:00:00Z",
      "last_triggered_at": "2024-03-20T14:30:00Z",
      "status": "active"
    }
  ],
  "total": 5
}`,
      inputSchema: {},
    },
    async () => {
      try {
        const result = await getClient().webhooks.listWebhooks()
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_subscribe_webhook',
    {
      title: 'Subscribe to Webhook Events',
      description: `[${TOOL_CATEGORIES.WEBHOOKS}] Subscribe to webhook events to receive real-time notifications when specific events occur in Lodgify. Supports various event types including booking changes, rate updates, and guest messages.
      
Available event types:
- rate_change: Rate or pricing changes
- availability_change: Availability updates
- booking_new_any_status: Any new booking created
- booking_new_status_booked: New confirmed bookings only
- booking_change: Any booking modification
- booking_status_change_booked: Booking status changed to booked
- booking_status_change_tentative: Booking status changed to tentative
- booking_status_change_open: Booking status changed to open
- booking_status_change_declined: Booking status changed to declined
- guest_message_received: New guest message received

Example request:
{
  "event": "booking_new_status_booked",
  "target_url": "https://example.com/webhooks/lodgify"
}`,
      inputSchema: {
        event: z
          .enum([
            'rate_change',
            'availability_change',
            'booking_new_any_status',
            'booking_new_status_booked',
            'booking_change',
            'booking_status_change_booked',
            'booking_status_change_tentative',
            'booking_status_change_open',
            'booking_status_change_declined',
            'guest_message_received',
          ])
          .describe('Event type to subscribe to'),
        target_url: z
          .string()
          .url()
          .describe('HTTPS URL endpoint to receive webhook notifications'),
      },
    },
    async ({ event, target_url }) => {
      try {
        const result = await getClient().webhooks.subscribeWebhook({ event, target_url })
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_unsubscribe_webhook',
    {
      title: 'Unsubscribe from Webhook',
      description: `[${TOOL_CATEGORIES.WEBHOOKS}] Remove a webhook subscription to stop receiving event notifications. This is a permanent action that cannot be undone. Use the webhook ID obtained from lodgify_list_webhooks.
      
Example request:
{
  "id": "webhook_123"
}`,
      inputSchema: {
        id: z.string().min(1).describe('Webhook subscription ID to remove'),
      },
    },
    async ({ id }) => {
      try {
        await getClient().webhooks.unsubscribeWebhook({ id })
        return {
          content: [
            {
              type: 'text',
              text: `Successfully unsubscribed from webhook: ${id}`,
            },
          ],
        }
      } catch (error) {
        handleToolError(error)
      }
    },
  )

  // ============================================================================
  // Booking CRUD Tools (v1 API)
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_create_booking',
    {
      title: 'Create New Booking',
      description: `[${TOOL_CATEGORIES.BOOKING_MANAGEMENT}] Create a new booking in the system. This v1 endpoint provides direct booking creation functionality that is not available in v2. Essential for programmatic booking creation and channel management.

**REQUIRED FIELDS**:
- property_id: Property ID (use lodgify_list_properties to find valid IDs)
- room_type_id: Room type ID (use lodgify_list_property_rooms to find valid room IDs for the property)
- arrival: Check-in date (YYYY-MM-DD format)  
- departure: Check-out date (YYYY-MM-DD format)
- guest_name: Primary guest name
- adults: Number of adult guests (minimum 1)

**OPTIONAL FIELDS**:
- guest_email: Guest email address (recommended)
- guest_phone: Guest phone number
- children: Number of children (default: 0)
- infants: Number of infants
- status: Booking status (booked, tentative, declined, confirmed)
- source: Booking source/channel
- notes: Internal notes or special requests

**Input Format**: Accepts simple flat parameters (user-friendly)
**API Transform**: Automatically transforms to nested structure required by Lodgify API

Example MCP Tool Input (flat structure):
{
  "property_id": 684855,
  "room_type_id": 751902,
  "arrival": "2025-08-27",
  "departure": "2025-08-28", 
  "guest_name": "Test Guest",
  "guest_email": "test@example.com",
  "adults": 2,
  "children": 0,
  "status": "booked",
  "source": "Direct Website"
}

This gets automatically transformed to the nested API structure:
{
  "property_id": 684855,
  "arrival": "2025-08-27", 
  "departure": "2025-08-28",
  "guest": {
    "guest_name": {"first_name": "Test", "last_name": "Guest"},
    "email": "test@example.com"
  },
  "rooms": [{"room_type_id": 751902, "guest_breakdown": {"adults": 2, "children": 0}}],
  "status": "Booked",
  "source_text": "Direct Website"
}

The transformation handles: guest name splitting, room structuring, status capitalization, and field mapping.`,
      inputSchema: {
        property_id: z.number().int().describe('Property ID for the booking'),
        room_type_id: z
          .number()
          .int()
          .describe('Room type ID (required - use lodgify_list_property_rooms to find valid IDs)'),
        arrival: z.string().describe('Arrival date (YYYY-MM-DD)'),
        departure: z.string().describe('Departure date (YYYY-MM-DD)'),
        guest_name: z.string().min(1).describe('Primary guest name'),
        guest_email: z.string().email().optional().describe('Guest email address'),
        guest_phone: z.string().optional().describe('Guest phone number'),
        adults: z.number().int().min(1).describe('Number of adult guests'),
        children: z.number().int().min(0).default(0).describe('Number of children'),
        infants: z.number().int().min(0).optional().describe('Number of infants'),
        status: z
          .enum(['booked', 'tentative', 'declined', 'confirmed'])
          .optional()
          .describe('Booking status'),
        notes: z.string().optional().describe('Internal notes or special requests'),
        source: z.string().optional().describe('Booking source or channel'),
      },
    },
    async (params) => {
      try {
        // Call v1 booking creation endpoint
        const result = await getClient().createBookingV1({
          property_id: params.property_id,
          room_type_id: params.room_type_id,
          arrival: params.arrival,
          departure: params.departure,
          guest_name: params.guest_name,
          guest_email: params.guest_email,
          guest_phone: params.guest_phone,
          adults: params.adults,
          children: params.children || 0,
          infants: params.infants,
          status: params.status,
          notes: params.notes,
          source: params.source,
        })
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_update_booking',
    {
      title: 'Update Existing Booking',
      description: `[${TOOL_CATEGORIES.BOOKING_MANAGEMENT}] Update an existing booking's details. This v1 endpoint provides comprehensive booking modification capabilities not available in v2. Use for modifying dates, guest counts, status, or other booking attributes.

**Input Format**: Accepts simple flat parameters (user-friendly)
**API Transform**: Automatically transforms to nested structure required by Lodgify API

Example MCP Tool Input (flat structure):
{
  "id": 789,
  "arrival": "2024-06-16",
  "departure": "2024-06-21", 
  "guest_name": "Updated Guest Name",
  "adults": 3,
  "status": "tentative",
  "notes": "Room upgrade requested"
}

This gets automatically transformed to the nested API structure with guest objects, rooms arrays, and proper field mapping similar to create_booking.`,
      inputSchema: {
        id: z.number().int().describe('Booking ID to update'),
        property_id: z.number().int().optional().describe('New property ID'),
        room_type_id: z.number().int().optional().describe('New room type ID'),
        arrival: z.string().optional().describe('New arrival date (YYYY-MM-DD)'),
        departure: z.string().optional().describe('New departure date (YYYY-MM-DD)'),
        guest_name: z.string().optional().describe('Updated guest name'),
        guest_email: z.string().email().optional().describe('Updated guest email'),
        guest_phone: z.string().optional().describe('Updated guest phone'),
        adults: z.number().int().min(1).optional().describe('Updated number of adults'),
        children: z.number().int().min(0).optional().describe('Updated number of children'),
        infants: z.number().int().min(0).optional().describe('Updated number of infants'),
        status: z
          .enum(['booked', 'tentative', 'declined', 'confirmed'])
          .optional()
          .describe('Updated booking status'),
        notes: z.string().optional().describe('Updated notes'),
        source: z.string().optional().describe('Updated booking source'),
      },
    },
    async ({ id, ...updateData }) => {
      try {
        const result = await getClient().updateBookingV1(id, updateData)
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
    },
  )

  registerToolWithDeprecation(
    server,
    'lodgify_delete_booking',
    {
      title: 'Delete Booking',
      description: `[${TOOL_CATEGORIES.BOOKING_MANAGEMENT}] Permanently delete a booking from the system. This v1 endpoint provides deletion capability not available in v2. Use with caution as this action cannot be undone. Consider updating status to 'declined' instead of deletion when possible.
      
Example request:
{
  "id": 789
}`,
      inputSchema: {
        id: z.number().int().describe('Booking ID to delete permanently'),
      },
    },
    async ({ id }) => {
      try {
        const result = await getClient().deleteBookingV1(id)
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
    },
  )

  // ============================================================================
  // Rate Management Tools (v1 API)
  // ============================================================================
  registerToolWithDeprecation(
    server,
    'lodgify_update_rates',
    {
      title: 'Update Property Rates',
      description: `[${TOOL_CATEGORIES.RATES_PRICING}] Update rates for properties and room types. This v1 endpoint provides direct rate modification capability not available in v2. Essential for dynamic pricing strategies and rate management across seasons.
      
Example request:
{
  "property_id": 123,
  "rates": [
    {
      "room_type_id": 456,
      "start_date": "2024-06-01",
      "end_date": "2024-08-31",
      "price_per_day": 150.00,
      "min_stay": 3,
      "currency": "USD"
    },
    {
      "room_type_id": 457,
      "start_date": "2024-06-01",
      "end_date": "2024-08-31",
      "price_per_day": 200.00,
      "min_stay": 2,
      "currency": "USD"
    }
  ]
}`,
      inputSchema: {
        property_id: z.number().int().describe('Property ID to update rates for'),
        rates: z
          .array(
            z.object({
              room_type_id: z.number().int().describe('Room type ID'),
              start_date: z.string().describe('Start date for rate period (YYYY-MM-DD)'),
              end_date: z.string().describe('End date for rate period (YYYY-MM-DD)'),
              price_per_day: z.number().positive().describe('Rate amount per day'),
              min_stay: z.number().int().min(1).optional().describe('Minimum stay requirement'),
              currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),
            }),
          )
          .min(1)
          .describe('Array of rate updates to apply'),
      },
    },
    async (params) => {
      try {
        const result = await getClient().updateRatesV1(params as RateUpdateV1Request)
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
    },
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
function sanitizeErrorDetails(errorDetails: unknown): unknown {
  if (!errorDetails || typeof errorDetails !== 'object') {
    return errorDetails
  }

  // Type guard to ensure errorDetails is a proper object
  const errorObj = errorDetails as Record<string, unknown>
  const sanitized: Record<string, unknown> = { ...errorObj }

  // Remove sensitive fields
  const sensitiveFields = [
    'apiKey',
    'api_key',
    'authorization',
    'x-api-key',
    'token',
    'secret',
    'password',
  ]
  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '***'
    }
  })

  // Sanitize nested objects
  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key]
    if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorDetails(value)
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
  // Debug logging to understand error structure (remove in production)
  if (process.env.DEBUG_HTTP === '1') {
    safeLogger.debug('handleToolError received:', {
      type: typeof error,
      constructor: error?.constructor?.name,
      isError: error instanceof Error,
      isMcpError: error instanceof McpError,
      errorObj: error,
    })
  }

  // Handle ReadOnlyModeError specially
  if (error instanceof ReadOnlyModeError) {
    throw new McpError(ErrorCode.InvalidRequest, error.message, {
      ...(error.detail || {}),
      type: 'ReadOnlyModeError',
    })
  }

  // Handle MCP errors (already properly formatted)
  if (error instanceof McpError) {
    // Sanitize existing MCP errors to ensure no sensitive data leaks
    const sanitizedMessage = sanitizeErrorMessage(error.message)
    const sanitizedData = error.data ? sanitizeErrorDetails(error.data) : undefined

    throw new McpError(error.code, sanitizedMessage, sanitizedData)
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid input parameters', {
      validationErrors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: sanitizeErrorMessage(issue.message),
        code: issue.code,
      })),
    })
  }

  // Handle structured Lodgify errors first (from ErrorHandler)
  const errorObj = error as unknown as Record<string, unknown>
  const isLodgifyError =
    errorObj?.error === true &&
    typeof errorObj?.status === 'number' &&
    typeof errorObj?.message === 'string'

  if (isLodgifyError) {
    // Extract status and message from Lodgify error
    const status = errorObj.status as number
    const lodgifyMessage = errorObj.message as string
    const detail = errorObj.detail

    if (process.env.DEBUG_HTTP === '1') {
      safeLogger.debug('Processing structured Lodgify error:', {
        status,
        message: lodgifyMessage,
        hasDetail: !!detail,
      })
    }

    // Map Lodgify status codes to appropriate MCP error codes
    let mcpErrorCode: ErrorCode
    if (status === 400) {
      mcpErrorCode = ErrorCode.InvalidParams
    } else if (status === 401 || status === 403) {
      mcpErrorCode = ErrorCode.InvalidRequest
    } else if (status === 404) {
      mcpErrorCode = ErrorCode.InvalidParams
    } else if (status === 429) {
      mcpErrorCode = ErrorCode.RequestTimeout
    } else if (status >= 500) {
      mcpErrorCode = ErrorCode.InternalError
    } else {
      mcpErrorCode = ErrorCode.InternalError
    }

    // Use the Lodgify error message directly (it's already sanitized by ErrorHandler)
    throw new McpError(mcpErrorCode, lodgifyMessage, {
      status,
      detail: detail ? sanitizeErrorDetails(detail) : undefined,
      type: 'LodgifyAPIError',
    })
  }

  // Handle regular JavaScript Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const sanitizedMessage = sanitizeErrorMessage(error.message)

    // Rate limiting errors
    if (message.includes('429') || message.includes('rate limit')) {
      throw new McpError(ErrorCode.RequestTimeout, 'Rate limit exceeded. Please try again later.', {
        originalError: sanitizedMessage,
        retryAfter: (error as { retryAfter?: number }).retryAfter,
      })
    }

    // Authentication errors - be extra careful not to leak API key info
    if (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('api key')
    ) {
      // Production vs development error messages
      const config = getEnvConfig()
      const errorMessage = isProduction(config)
        ? 'Authentication failed. Please verify your API credentials.'
        : 'Authentication failed. Please check your API key configuration.'

      throw new McpError(ErrorCode.InvalidRequest, errorMessage, {
        originalError: sanitizedMessage,
        hint: 'Check API key validity and permissions in your Lodgify account',
      })
    }

    // Not found errors
    if (message.includes('404') || message.includes('not found')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Resource not found. Please verify the ID and your access permissions.',
        { originalError: sanitizedMessage },
      )
    }

    // Network errors
    if (
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('fetch')
    ) {
      throw new McpError(
        ErrorCode.InternalError,
        'Network error occurred while connecting to Lodgify API. Please check your connection.',
        {
          originalError: sanitizedMessage,
          hint: 'Verify internet connectivity and Lodgify service status',
        },
      )
    }

    // Generic API errors with details (fallback)
    const errorDetails =
      errorObj?.detail || (errorObj as { response?: { data?: unknown } })?.response?.data
    if (errorDetails) {
      throw new McpError(
        ErrorCode.InternalError,
        sanitizedMessage,
        sanitizeErrorDetails(errorDetails),
      )
    }

    // Default error handling - preserve more of the original message
    // Only sanitize credentials, but keep the actual error description
    const preservedMessage = error.message.includes('Lodgify')
      ? sanitizedMessage // Already formatted Lodgify error
      : `Lodgify API Error: ${sanitizedMessage}` // Generic error with context

    throw new McpError(ErrorCode.InternalError, preservedMessage, {
      type: 'LodgifyAPIError',
      originalMessage: sanitizedMessage,
    })
  }

  // Unknown error type - be very careful about what we expose
  const errorString = String(error)
  const sanitizedError = sanitizeErrorMessage(errorString)

  throw new McpError(
    ErrorCode.InternalError,
    'An unexpected error occurred while processing your request',
    { error: sanitizedError },
  )
}

/**
 * Check the health status of all dependencies
 */
async function checkDependencies(client: LodgifyOrchestrator): Promise<
  Record<
    string,
    {
      status: 'healthy' | 'unhealthy' | 'degraded'
      responseTime?: number
      lastChecked: string
      error?: string
      details?: string
    }
  >
> {
  const dependencies: Record<
    string,
    {
      status: 'healthy' | 'unhealthy' | 'degraded'
      responseTime?: number
      lastChecked: string
      error?: string
      details?: string
    }
  > = {}

  // Check Lodgify API connectivity
  try {
    const startTime = Date.now()
    // Try to make a simple API call to test connectivity
    await client.properties.listProperties({ limit: 1 })
    const responseTime = Date.now() - startTime

    dependencies.lodgifyApi = {
      status: 'healthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: 'Successfully connected to Lodgify API',
    }
  } catch (error) {
    dependencies.lodgifyApi = {
      status: 'unhealthy',
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Failed to connect to Lodgify API',
    }
  }

  // Check environment variables
  const envVars = ['LODGIFY_API_KEY', 'LOG_LEVEL']
  const missingEnvVars = envVars.filter((envVar) =>
    envVar === 'LODGIFY_API_KEY' ? !process.env[envVar] : false,
  )

  dependencies.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    lastChecked: new Date().toISOString(),
    details:
      missingEnvVars.length === 0
        ? 'All required environment variables are configured'
        : `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    ...(missingEnvVars.length > 0 && { error: `Missing: ${missingEnvVars.join(', ')}` }),
  }

  // Rate limiting check - placeholder for future implementation
  dependencies.rateLimiting = {
    status: 'healthy',
    lastChecked: new Date().toISOString(),
    details: 'Rate limiting status not implemented',
  }

  return dependencies
}

// Function to register resources with the McpServer
function registerResources(server: McpServer, getClient: () => LodgifyOrchestrator) {
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
      const dependencies = await checkDependencies(getClient())

      // Determine overall status
      const allHealthy = Object.values(dependencies).every((dep) => dep.status === 'healthy')
      const overallStatus = allHealthy ? 'healthy' : 'unhealthy'

      const health = {
        status: overallStatus,
        service: '@mikerob/lodgify-mcp',
        version: pkg.version,
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
            unit: 'MB',
          },
        },
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
    },
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
      const rateLimitStatus = { available: true, resetTime: null, utilizationPercent: 0 }

      const status = {
        service: 'lodgify-api',
        rateLimitInfo: {
          ...rateLimitStatus,
          status:
            rateLimitStatus.utilizationPercent >= 95
              ? 'critical'
              : rateLimitStatus.utilizationPercent >= 80
                ? 'warning'
                : 'ok',
          recommendation:
            rateLimitStatus.utilizationPercent >= 95
              ? 'Rate limit nearly exhausted. Consider reducing request frequency.'
              : rateLimitStatus.utilizationPercent >= 80
                ? 'High rate limit usage detected. Monitor closely.'
                : 'Rate limit usage is within normal range.',
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
    },
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
        warning: generateDeprecationWarning(toolName, info),
      }))

      const registry = {
        service: '@mikerob/lodgify-mcp-deprecations',
        totalDeprecatedTools: deprecationList.length,
        deprecations: deprecationList,
        recommendations:
          deprecationList.length > 0
            ? [
                'Update your integration to use recommended replacement tools',
                'Test replacement tools before deprecated ones are removed',
                'Subscribe to release notes for deprecation announcements',
              ]
            : ['No deprecated tools - all tools are current'],
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
    },
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
export function setupServer(injectedClient?: LodgifyOrchestrator) {
  const server = new McpServer(
    {
      name: '@mikerob/lodgify-mcp',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {
          // We support all standard tool capabilities
          listChanged: true, // Server can notify clients when tool list changes
        },
        resources: {
          // We support all standard resource capabilities
          subscribe: true, // Clients can subscribe to resource changes
          listChanged: true, // Server can notify clients when resource list changes
        },
        logging: {}, // Support for structured logging (if client requests it)
        // Note: We do not support prompts, so we don't declare that capability
      },
      // Enable notification debouncing to reduce client noise
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
      ],
    },
  )

  // Lazy client initialization - only create when needed
  let clientInstance: LodgifyOrchestrator | undefined = injectedClient

  const getClient = (): LodgifyOrchestrator => {
    if (!clientInstance) {
      // Check if environment is valid before creating client
      if (!isEnvValid()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Server configuration error: ${envValidationError?.message || 'Invalid environment'}`,
          {
            hint: 'Please check your LODGIFY_API_KEY environment variable',
            error: envValidationError?.message,
          },
        )
      }

      const config = getEnvConfig()

      // Log read-only mode status if enabled (useful for operational awareness)
      if (config.LODGIFY_READ_ONLY) {
        safeLogger.info('Read-only mode is enabled - write operations will be blocked')
      }

      clientInstance = new LodgifyOrchestrator({
        apiKey: config.LODGIFY_API_KEY,
        debugHttp: config.DEBUG_HTTP,
        readOnly: config.LODGIFY_READ_ONLY,
      })
    }
    return clientInstance
  }

  // Register tools and resources with lazy client
  registerTools(server, getClient)
  registerResources(server, getClient)

  // Return server and client getter for testing
  // Include 'client' for backward compatibility with tests when injectedClient is provided
  return { server, getClient, client: injectedClient }
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

// Export main for wrapper script
export { main }

// Only run main if this is the direct entry point (not imported)
// Check if running directly (not via the bin wrapper which imports this module)
if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1]?.endsWith('/server.js') && !process.argv[1]?.includes('node_modules'))
) {
  main().catch((error) => {
    safeLogger.error('Fatal error:', error)
    process.exit(1)
  })
}
