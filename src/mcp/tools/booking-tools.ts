/**
 * Booking Management Tools
 * MCP tools for managing Lodgify bookings and reservations
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { BookingSearchParams } from '../../api/v2/bookings/types.js'
import { BOOKING_CONFIG, PAGINATION, STRING_LIMITS } from '../../core/config/constants.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
// Note: Schemas are inlined directly to avoid $ref issues with MCPO
// Previously imported from '../schemas/common.js'
import {
  createValidator,
  DateToolCategory,
  type DateValidationFeedback,
} from '../utils/date-validator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput } from '../utils/input-sanitizer.js'
import { enhanceResponse, formatMcpResponse } from '../utils/response-enhancer.js'
import { debugLogResponse, safeJsonStringify } from '../utils/response-sanitizer.js'
import type { ToolRegistration } from '../utils/types.js'

/**
 * Register all booking management tools
 */
export function getBookingTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // List Bookings Tool
    {
      name: 'lodgify_list_bookings',
      category: 'Booking & Reservation Management',
      config: {
        title: 'List Bookings & Reservations',
        description: `[Booking & Reservation Management] Retrieve bookings with comprehensive filtering options. Filter by dates, status, property, guest information, and more. Returns booking details including guest info, dates, pricing, and payment status. Essential for managing reservations and analyzing booking patterns.

Note: Maximum page size is 50 items per request. Default stay filter is "Upcoming" for performance and relevance. Avoid using "All" as it can return a very large dataset.

**STAY FILTER OPTIONS - Use these to find bookings by their stay dates:**

- **"Upcoming"** - Bookings with check-in dates in the future (default and recommended)
- **"Current"** - Bookings that are currently active (guests are checked in)
- **"Historic"** - Past bookings where guests have already checked out
- **"All"** - All bookings regardless of date (not recommended; can return excessive results)
- **"ArrivalDate"** - Bookings arriving on a specific date (requires stayFilterDate)
- **"DepartureDate"** - Bookings departing on a specific date (requires stayFilterDate)

**COMMON USE CASES:**
- Find bookings blocking a property: Use "Upcoming" to see future reservations
- Check current guests: Use "Current" to see who's checked in now
- Find bookings for a specific date: Use "ArrivalDate" or "DepartureDate" with stayFilterDate
- Get booking history: Use "Historic" for past reservations

Example request (find upcoming bookings):
{
  "page": 1,                               // Page number to retrieve
  "size": 10,                              // Number of items per page (max 50)
  "includeCount": true,                    // Include total number of results
  "stayFilter": "Upcoming",                // Find future bookings
  "updatedSince": "2024-03-01T00:00:00Z",  // Include only bookings updated since this date
  "includeTransactions": false,            // Include details about transactions and schedule
  "includeQuoteDetails": false             // Include quote details
}

Example request (find bookings arriving on specific date):
{
  "stayFilter": "ArrivalDate",              // Filter by arrival date
  "stayFilterDate": "2024-03-15T00:00:00Z", // Specific arrival date (ISO format)
  "size": 5                                 // Number of items per page (max 50)
}

Example request (find current guests):
{
  "stayFilter": "Current",                  // Find currently checked-in guests
  "size": 20                                // Number of items per page (max 50)
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
          size: z
            .number()
            .int()
            .min(1)
            .max(PAGINATION.MAX_PAGE_SIZE)
            .default(PAGINATION.DEFAULT_PAGE_SIZE)
            .describe('Number of items per page'),
          includeCount: z.boolean().default(false).describe('Include total number of results'),
          stayFilter: z
            .enum(BOOKING_CONFIG.VALID_STAY_FILTERS as unknown as readonly [string, ...string[]])
            .default(BOOKING_CONFIG.DEFAULT_STAY_FILTER)
            .describe(
              'Filter by stay dates. Default is "Upcoming". Avoid "All" unless absolutely necessary (can return too many items). Use "Current" for active guests, "Historic" for past bookings, and "ArrivalDate"/"DepartureDate" with stayFilterDate for specific dates.',
            ),
          stayFilterDate: z
            .string()
            .datetime({
              message: 'DateTime must be in ISO 8601 format (e.g., 2024-03-15T10:00:00Z)',
            })
            .optional()
            .describe(
              'Required when stayFilter is "ArrivalDate" or "DepartureDate". Specify the exact date to search for in ISO 8601 format (e.g., "2024-03-15T00:00:00Z").',
            ),
          updatedSince: z
            .string()
            .datetime({
              message: 'DateTime must be in ISO 8601 format (e.g., 2024-03-15T10:00:00Z)',
            })
            .optional()
            .describe('Include only bookings updated since this date'),
          includeTransactions: z
            .boolean()
            .default(false)
            .describe('Include details about transactions and schedule'),
          includeExternal: z.boolean().default(false).describe('Include external bookings'),
          includeQuoteDetails: z.boolean().default(false).describe('Include quote details'),
          trash: z
            .enum(['False', 'True', 'All'])
            .optional()
            .describe('Query bookings that are in trash'),
        },
      },
      handler: wrapToolHandler(async (params) => {
        // Sanitize input parameters
        const sanitized = sanitizeInput(params)

        // Additional validation for date-based stay filters
        if (
          (sanitized.stayFilter === 'ArrivalDate' || sanitized.stayFilter === 'DepartureDate') &&
          !sanitized.stayFilterDate
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `stayFilterDate is required when using ${sanitized.stayFilter} filter`,
          )
        }

        // Map MCP parameters to API parameters
        const mappedParams: BookingSearchParams = {}
        if (sanitized.size !== undefined) mappedParams.limit = sanitized.size
        if (sanitized.page !== undefined)
          mappedParams.offset = (sanitized.page - 1) * (sanitized.size || 50)
        if (sanitized.includeCount !== undefined) mappedParams.includeCount = sanitized.includeCount
        if (sanitized.stayFilter !== undefined) mappedParams.stayFilter = sanitized.stayFilter
        if (sanitized.stayFilterDate !== undefined)
          mappedParams.stayFilterDate = sanitized.stayFilterDate
        if (sanitized.updatedSince !== undefined) mappedParams.updatedSince = sanitized.updatedSince
        if (sanitized.includeTransactions !== undefined)
          mappedParams.includeTransactions = sanitized.includeTransactions
        if (sanitized.includeExternal !== undefined)
          mappedParams.includeExternal = sanitized.includeExternal
        if (sanitized.includeQuoteDetails !== undefined)
          mappedParams.includeQuoteDetails = sanitized.includeQuoteDetails
        if (sanitized.trash !== undefined) mappedParams.trash = sanitized.trash

        const result = await getClient().bookings.listBookings(mappedParams)

        // For list operations, return raw data as it may contain multiple items
        // Enhancement is more suitable for individual operations
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_list_bookings'),
    },

    // Get Booking Details Tool
    {
      name: 'lodgify_get_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get Booking Details',
        description: `Retrieve complete details for a specific booking including guest information, property details, room assignments, pricing breakdown, payment status, special requests, and booking timeline. Use this for customer service inquiries and detailed booking management.

Example request:
{
  "id": "BK12345"  // Unique booking/reservation ID to retrieve
}`,
        inputSchema: {
          id: z.string().min(1).describe('Unique booking/reservation ID to retrieve'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const { id } = sanitizeInput(input)
        const result = await getClient().bookings.getBooking(id)

        // For get operations, return raw data as it already contains full details
        // The response is comprehensive and doesn't need additional context
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_get_booking'),
    },

    // Get Booking Payment Link Tool
    {
      name: 'lodgify_get_booking_payment_link',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get Booking Payment Link',
        description: `Retrieve existing payment link for a booking including payment status, amount due, and link expiration. Use this to check if a payment link already exists or to get current payment details for customer service inquiries.

Example request:
{
  "id": "BK12345"  // Booking ID to get payment link for
}`,
        inputSchema: {
          id: z.string().min(1).describe('Booking ID to get payment link for'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const { id } = sanitizeInput(input)
        const result = await getClient().getBookingPaymentLink(id)

        // Debug logging
        debugLogResponse('Booking payment link response', result)

        // For get operations, return raw data as it already contains the information needed
        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(result),
            },
          ],
        }
      }, 'lodgify_get_booking_payment_link'),
    },

    // Create Booking Payment Link Tool
    {
      name: 'lodgify_create_booking_payment_link',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Create Booking Payment Link',
        description: `Generate a secure payment link for a booking allowing guests to pay outstanding balances online. Useful for collecting deposits, final payments, or additional charges. The link will be sent to guests via email or can be shared directly.

Example request:
{
  "id": "BK12345",              // Booking ID to create payment link for
  "payload": {
    "amount": 500.00,           // Payment amount (defaults to booking balance)
    "currency": "USD",          // Currency code (e.g., USD, EUR)
    "description": "Final payment for Ocean View Villa booking"  // Payment description for guest
  }
}`,
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
              description: z
                .string()
                .max(STRING_LIMITS.MAX_PAYMENT_DESCRIPTION_LENGTH)
                .optional()
                .describe('Payment description for guest'),
            })
            .describe('Payment link configuration - amount, currency, and description'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const sanitized = sanitizeInput(input) as {
          id: string
          payload: {
            amount: number
            currency: string
            description?: string
          }
        }
        const { id, payload } = sanitized
        const result = await getClient().createBookingPaymentLink(id, payload)

        // Debug logging
        debugLogResponse('Create payment link response', result)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'create',
          entityType: 'payment_link',
          inputParams: { id, payload },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_create_booking_payment_link'),
    },

    // Update Key Codes Tool
    {
      name: 'lodgify_update_key_codes',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Update Access Key Codes',
        description: `Update access key codes for a booking to provide guests with property entry information. Used for smart locks, keypad codes, or other access control systems. Essential for self-check-in processes and property access management.

Example request:
{
  "id": 12345,                   // Booking ID to update key codes for
  "payload": {
    "keyCodes": ["1234", "5678"]  // Array of access codes/keys for the property
  }
}`,
        inputSchema: {
          id: z.number().int().describe('Booking ID to update key codes for'),
          payload: z
            .object({
              keyCodes: z.array(z.string()).describe('Array of access codes/keys for the property'),
            })
            .describe('Access key codes and entry information'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const sanitized = sanitizeInput(input) as {
          id: number
          payload: {
            keyCodes: string[]
          }
        }
        const { id, payload } = sanitized

        // Additional validation for key codes
        if (payload.keyCodes && payload.keyCodes.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, 'At least one key code must be provided')
        }

        const result = await getClient().updateKeyCodes(id.toString(), payload)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'update',
          entityType: 'key_codes',
          inputParams: { id, payload },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_update_key_codes'),
    },

    // Checkin Booking Tool
    {
      name: 'lodgify_checkin_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Check In Booking',
        description: `Mark a booking as checked in. Updates the booking status to reflect that the guest has arrived and checked into the property. Essential for tracking guest arrivals and property occupancy.

Example request:
{
  "id": 12345,                       // Booking ID to check in
  "time": "2024-03-15T15:00:00Z"    // Check-in time in ISO 8601 date-time format (required)
}`,
        inputSchema: {
          id: z.number().int().describe('Booking ID to check in'),
          time: z
            .string()
            .datetime()
            .describe('Check-in time in ISO 8601 date-time format (required)'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const sanitized = sanitizeInput(input) as {
          id: number
          time: string
        }
        const { id, time } = sanitized
        const result = await getClient().checkinBooking(id.toString(), time)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'action',
          entityType: 'booking',
          inputParams: { id, time, action: 'checked in' },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_checkin_booking'),
    },

    // Checkout Booking Tool
    {
      name: 'lodgify_checkout_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Check Out Booking',
        description: `Mark a booking as checked out. Updates the booking status to reflect that the guest has departed from the property. Essential for tracking guest departures and property availability.

Example request:
{
  "id": 12345,                       // Booking ID to check out
  "time": "2024-03-22T11:00:00Z"    // Check-out time in ISO 8601 date-time format (required)
}`,
        inputSchema: {
          id: z.number().int().describe('Booking ID to check out'),
          time: z
            .string()
            .datetime()
            .describe('Check-out time in ISO 8601 date-time format (required)'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const sanitized = sanitizeInput(input) as {
          id: number
          time: string
        }
        const { id, time } = sanitized
        const result = await getClient().checkoutBooking(id.toString(), time)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'action',
          entityType: 'booking',
          inputParams: { id, time, action: 'checked out' },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_checkout_booking'),
    },

    // Get External Bookings Tool
    {
      name: 'lodgify_get_external_bookings',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get External Bookings',
        description: `Retrieve external bookings associated with a property. These are bookings made through external channels (OTAs like Booking.com, Airbnb, etc.) that are synchronized with Lodgify. Useful for understanding the full booking picture across all channels.

Example request:
{
  "id": "123"  // Property ID to get external bookings for
}`,
        inputSchema: {
          id: z.string().min(1).describe('Property ID to get external bookings for'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const { id } = sanitizeInput(input)
        const result = await getClient().bookings.getExternalBookings(id)

        // For list operations with external bookings, return raw data
        // as it contains multiple items from various sources
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_get_external_bookings'),
    },

    // Create Booking Tool (V1)
    {
      name: 'lodgify_create_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Create Booking (V1)',
        description: `[Booking & Reservation Management] Create a new booking in the system. This v1 endpoint provides direct booking creation functionality that is not available in v2. Essential for programmatic booking creation and channel management.

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
  "property_id": 684855,              // Property ID for the booking
  "room_type_id": 751902,             // Room type ID (required - use lodgify_list_property_rooms to find valid IDs)
  "arrival": "2025-08-27",             // Arrival date (YYYY-MM-DD)
  "departure": "2025-08-28",          // Departure date (YYYY-MM-DD)
  "guest_name": "Test Guest",          // Primary guest name
  "guest_email": "test@example.com",   // Guest email address
  "adults": 2,                         // Number of adult guests
  "children": 0,                       // Number of children
  "status": "booked",                  // Booking status
  "source": "Direct Website"           // Booking source or channel
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
            .describe(
              'Room type ID (required - use lodgify_list_property_rooms to find valid IDs)',
            ),
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
          source: z.string().optional().describe('Booking source or channel'),
          notes: z.string().optional().describe('Internal notes or special requests'),
        },
      },
      handler: wrapToolHandler(async (params) => {
        // Sanitize input parameters
        const sanitized = sanitizeInput(params)

        // Validate arrival and departure dates
        const validator = createValidator(DateToolCategory.BOOKING)
        const rangeValidation = validator.validateDateRange(sanitized.arrival, sanitized.departure)

        // Check if dates are valid
        if (!rangeValidation.start.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Arrival date validation failed: ${rangeValidation.start.feedback?.message || 'invalid date'}`,
          )
        }
        if (!rangeValidation.end.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Departure date validation failed: ${rangeValidation.end.feedback?.message || 'invalid date'}`,
          )
        }
        if (!rangeValidation.rangeValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            rangeValidation.rangeError || 'Invalid date range: departure must be after arrival',
          )
        }

        // Prepare validation feedback if present
        const feedbackMessages: { message: string; feedback: DateValidationFeedback }[] = []
        if (rangeValidation.start.feedback) {
          feedbackMessages.push({
            message: `Arrival date: ${rangeValidation.start.feedback.message}`,
            feedback: rangeValidation.start.feedback,
          })
        }
        if (rangeValidation.end.feedback) {
          feedbackMessages.push({
            message: `Departure date: ${rangeValidation.end.feedback.message}`,
            feedback: rangeValidation.end.feedback,
          })
        }

        // Pass flat structure - the V1 client will transform it to nested API structure
        const apiRequest = {
          property_id: sanitized.property_id,
          room_type_id: sanitized.room_type_id,
          arrival: rangeValidation.start.validatedDate,
          departure: rangeValidation.end.validatedDate,
          guest_name: sanitized.guest_name,
          ...(sanitized.guest_email && { guest_email: sanitized.guest_email }),
          ...(sanitized.guest_phone && { guest_phone: sanitized.guest_phone }),
          adults: sanitized.adults,
          children: sanitized.children,
          ...(sanitized.infants !== undefined && { infants: sanitized.infants }),
          ...(sanitized.status && { status: sanitized.status }),
          ...(sanitized.source && { source: sanitized.source }),
          ...(sanitized.notes && { notes: sanitized.notes }),
        }

        const result = await getClient().createBookingV1(apiRequest)

        // Add validation feedback to result if present
        const finalResult =
          feedbackMessages.length > 0
            ? {
                ...result,
                dateValidation: {
                  feedback: feedbackMessages.map((fm) => fm.feedback),
                  messages: feedbackMessages.map((fm) => fm.message),
                  originalDates: {
                    arrival: sanitized.arrival,
                    departure: sanitized.departure,
                  },
                  validatedDates: {
                    arrival: rangeValidation.start.validatedDate,
                    departure: rangeValidation.end.validatedDate,
                  },
                },
              }
            : result

        // Enhance the response with context
        const enhanced = enhanceResponse(finalResult, {
          operationType: 'create',
          entityType: 'booking',
          inputParams: sanitized,
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_create_booking'),
    },

    // Update Booking Tool (V1)
    {
      name: 'lodgify_update_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Update Booking (V1)',
        description: `[Booking & Reservation Management] Update an existing booking's details. This v1 endpoint provides comprehensive booking modification capabilities not available in v2. Use for modifying dates, guest counts, status, or other booking attributes.

**Input Format**: Accepts simple flat parameters (user-friendly)
**API Transform**: Automatically transforms to nested structure required by Lodgify API

Example MCP Tool Input (flat structure):
{
  "id": 789,                           // Booking ID to update
  "arrival": "2024-06-16",             // New arrival date (YYYY-MM-DD)
  "departure": "2024-06-21",          // New departure date (YYYY-MM-DD)
  "guest_name": "Updated Guest Name",  // Updated guest name
  "adults": 3,                         // Updated number of adults
  "status": "tentative",               // Updated booking status
  "notes": "Room upgrade requested"    // Updated notes
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
          source: z.string().optional().describe('Updated booking source'),
          notes: z.string().optional().describe('Updated notes'),
        },
      },
      handler: wrapToolHandler(async (params) => {
        // Sanitize input parameters
        const sanitized = sanitizeInput(params)
        const { id, ...updates } = sanitized
        // Validate/sanitize dates if both are present on update (keep single-date updates as-is)
        const sanitizedUpdates = { ...updates }
        if (updates.arrival !== undefined && updates.departure !== undefined) {
          const validator = createValidator(DateToolCategory.BOOKING)
          const rv = validator.validateDateRange(updates.arrival, updates.departure)
          if (!rv.start.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Arrival date validation failed: ${rv.start.feedback?.message || 'invalid date'}`,
            )
          }
          if (!rv.end.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Departure date validation failed: ${rv.end.feedback?.message || 'invalid date'}`,
            )
          }
          if (!rv.rangeValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              rv.rangeError || 'Invalid date range: departure must be after arrival',
            )
          }
          sanitizedUpdates.arrival = rv.start.validatedDate
          sanitizedUpdates.departure = rv.end.validatedDate
        }
        // Pass flat structure - the V1 client will transform it to nested API structure
        const result = await getClient().updateBookingV1(id, sanitizedUpdates)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'update',
          entityType: 'booking',
          inputParams: { id, ...sanitizedUpdates },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_update_booking'),
    },

    // Delete Booking Tool (V1)
    {
      name: 'lodgify_delete_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Delete Booking (V1)',
        description: `[Booking & Reservation Management] Permanently delete a booking from the system. This v1 endpoint provides deletion capability not available in v2. Use with caution as this action cannot be undone. Consider updating status to 'declined' instead of deletion when possible.
      
Example request:
{
  "id": 789  // Booking ID to delete permanently
}`,
        inputSchema: {
          id: z.number().int().describe('Booking ID to delete permanently'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const { id } = sanitizeInput(input)
        const result = await getClient().deleteBookingV1(id)

        // Enhance the response with context
        const enhanced = enhanceResponse(result, {
          operationType: 'delete',
          entityType: 'booking',
          inputParams: { id },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_delete_booking'),
    },
  ]
}
