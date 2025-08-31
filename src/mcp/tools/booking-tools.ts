/**
 * Booking Management Tools
 * MCP tools for managing Lodgify bookings and reservations
 */

import { z } from 'zod'
import type { BookingSearchParams } from '../../api/v2/bookings/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import {
  BookingStatusEnum,
  DateTimeSchema,
  StayFilterEnum,
  TrashFilterEnum,
} from '../schemas/common.js'
import { createValidator, ToolCategory } from '../utils/date-validator.js'
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
        description: `[Booking & Reservation Management] Retrieve all bookings with comprehensive filtering options. Filter by dates, status, property, guest information, and more. Returns booking details including guest info, dates, pricing, and payment status. Essential for managing reservations and analyzing booking patterns.

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
      handler: async (params) => {
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
      },
    },

    // Get Booking Details Tool
    {
      name: 'lodgify_get_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get Booking Details',
        description:
          'Retrieve complete details for a specific booking including guest information, property details, room assignments, pricing breakdown, payment status, special requests, and booking timeline. Use this for customer service inquiries and detailed booking management.',
        inputSchema: {
          id: z.string().min(1).describe('Unique booking/reservation ID to retrieve'),
        },
      },
      handler: async ({ id }) => {
        const result = await getClient().bookings.getBooking(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Get Booking Payment Link Tool
    {
      name: 'lodgify_get_booking_payment_link',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get Booking Payment Link',
        description:
          'Retrieve existing payment link for a booking including payment status, amount due, and link expiration. Use this to check if a payment link already exists or to get current payment details for customer service inquiries.',
        inputSchema: {
          id: z.string().min(1).describe('Booking ID to get payment link for'),
        },
      },
      handler: async ({ id }) => {
        const result = await getClient().bookings.getBookingPaymentLink(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Create Booking Payment Link Tool
    {
      name: 'lodgify_create_booking_payment_link',
      category: 'Booking & Reservation Management',
      config: {
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
      handler: async ({ id, payload }) => {
        const result = await getClient().bookings.createBookingPaymentLink(id, payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Update Key Codes Tool
    {
      name: 'lodgify_update_key_codes',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Update Access Key Codes',
        description:
          'Update access key codes for a booking to provide guests with property entry information. Used for smart locks, keypad codes, or other access control systems. Essential for self-check-in processes and property access management.',
        inputSchema: {
          id: z.number().int().describe('Booking ID to update key codes for'),
          payload: z
            .object({
              keyCodes: z.array(z.string()).describe('Array of access codes/keys for the property'),
            })
            .describe('Access key codes and entry information'),
        },
      },
      handler: async ({ id, payload }) => {
        const result = await getClient().bookings.updateKeyCodes(id.toString(), payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Checkin Booking Tool
    {
      name: 'lodgify_checkin_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Check In Booking',
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
      handler: async ({ id, time }) => {
        const result = await getClient().bookings.checkinBooking(id.toString(), time)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Checkout Booking Tool
    {
      name: 'lodgify_checkout_booking',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Check Out Booking',
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
      handler: async ({ id, time }) => {
        const result = await getClient().bookings.checkoutBooking(id.toString(), time)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },

    // Get External Bookings Tool
    {
      name: 'lodgify_get_external_bookings',
      category: 'Booking & Reservation Management',
      config: {
        title: 'Get External Bookings',
        description:
          'Retrieve external bookings associated with a property. These are bookings made through external channels (OTAs like Booking.com, Airbnb, etc.) that are synchronized with Lodgify. Useful for understanding the full booking picture across all channels.',
        inputSchema: {
          id: z.string().min(1).describe('Property ID to get external bookings for'),
        },
      },
      handler: async ({ id }) => {
        const result = await getClient().bookings.getExternalBookings(id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
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
          status: BookingStatusEnum.optional().describe('Booking status'),
          source: z.string().optional().describe('Booking source or channel'),
          notes: z.string().optional().describe('Internal notes or special requests'),
        },
      },
      handler: async (params) => {
        // Validate arrival and departure dates
        const validator = createValidator(ToolCategory.BOOKING)
        const rangeValidation = validator.validateDateRange(params.arrival, params.departure)

        // Check if dates are valid
        if (!rangeValidation.start.isValid) {
          throw new Error(`Arrival date validation failed: ${rangeValidation.start.error}`)
        }
        if (!rangeValidation.end.isValid) {
          throw new Error(`Departure date validation failed: ${rangeValidation.end.error}`)
        }
        if (!rangeValidation.rangeValid) {
          throw new Error(
            rangeValidation.rangeError || 'Invalid date range: departure must be after arrival',
          )
        }

        // Prepare validation feedback if present
        const feedbackMessages: { message: string; feedback: any }[] = []
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
          property_id: params.property_id,
          room_type_id: params.room_type_id,
          arrival: rangeValidation.start.validatedDate,
          departure: rangeValidation.end.validatedDate,
          guest_name: params.guest_name,
          ...(params.guest_email && { guest_email: params.guest_email }),
          ...(params.guest_phone && { guest_phone: params.guest_phone }),
          adults: params.adults,
          children: params.children,
          ...(params.infants !== undefined && { infants: params.infants }),
          ...(params.status && { status: params.status }),
          ...(params.source && { source: params.source }),
          ...(params.notes && { notes: params.notes }),
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
                    arrival: params.arrival,
                    departure: params.departure,
                  },
                  validatedDates: {
                    arrival: rangeValidation.start.validatedDate,
                    departure: rangeValidation.end.validatedDate,
                  },
                },
              }
            : result

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(finalResult, null, 2),
            },
          ],
        }
      },
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
          status: BookingStatusEnum.optional().describe('Updated booking status'),
          source: z.string().optional().describe('Updated booking source'),
          notes: z.string().optional().describe('Updated notes'),
        },
      },
      handler: async (params) => {
        const { id, ...updates } = params
        // Pass flat structure - the V1 client will transform it to nested API structure
        const result = await getClient().updateBookingV1(id, updates)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
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
  "id": 789
}`,
        inputSchema: {
          id: z.number().int().describe('Booking ID to delete permanently'),
        },
      },
      handler: async ({ id }) => {
        const result = await getClient().bookingsV1.deleteBookingV1(id.toString())
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      },
    },
  ]
}
