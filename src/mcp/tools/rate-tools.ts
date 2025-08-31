/**
 * Rate Management Tools Module
 * Contains all rate and pricing-related MCP tool registrations
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { RateUpdateV1Request } from '../../api/v1/rates/types.js'
import type { QuoteParams } from '../../api/v2/quotes/types.js'
import type { DailyRatesParams } from '../../api/v2/rates/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { DateStringSchema } from '../schemas/common.js'
import {
  createValidator,
  ToolCategory as DateToolCategory,
  type DateValidationInfo,
} from '../utils/date-validator.js'
import type { ToolCategory, ToolRegistration } from '../utils/types.js'
import { validateQuoteParams } from './helper-tools.js'

const CATEGORY: ToolCategory = 'Rates & Pricing'

/**
 * Get all rate management tools
 */
export function getRateTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Daily rates tool
    {
      name: 'lodgify_daily_rates',
      category: CATEGORY,
      config: {
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
      handler: async ({ roomTypeId, houseId, startDate, endDate }) => {
        // Validate date range for rates
        const validator = createValidator(DateToolCategory.RATE)
        const rangeValidation = validator.validateDateRange(startDate, endDate)

        // Check if dates are valid
        if (!rangeValidation.start.isValid) {
          throw new Error(`Start date validation failed: ${rangeValidation.start.error}`)
        }
        if (!rangeValidation.end.isValid) {
          throw new Error(`End date validation failed: ${rangeValidation.end.error}`)
        }
        if (!rangeValidation.rangeValid) {
          throw new Error(rangeValidation.rangeError || 'Invalid date range')
        }

        // Prepare validation info if there's feedback to show
        let dateValidationInfo: DateValidationInfo | null = null
        if (rangeValidation.start.feedback || rangeValidation.end.feedback) {
          dateValidationInfo = {
            dateValidation: {
              startDate: {
                original: rangeValidation.start.originalDate,
                validated: rangeValidation.start.validatedDate,
                feedback: rangeValidation.start.feedback,
                warning: rangeValidation.start.warning,
              },
              endDate: {
                original: rangeValidation.end.originalDate,
                validated: rangeValidation.end.validatedDate,
                feedback: rangeValidation.end.feedback,
                warning: rangeValidation.end.warning,
              },
              message:
                rangeValidation.start.feedback || rangeValidation.end.feedback
                  ? '⚠️ Date validation feedback available'
                  : '✅ Dates validated',
            },
          }
        }

        // Map MCP parameters to API parameters with validated dates
        const params: DailyRatesParams = {
          propertyId: houseId.toString(),
          roomTypeId: roomTypeId.toString(),
          from: rangeValidation.start.validatedDate,
          to: rangeValidation.end.validatedDate,
        }

        const result = await getClient().rates.getDailyRates(params)

        // Merge validation info with result if present
        const finalResult = dateValidationInfo ? { ...result, ...dateValidationInfo } : result

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

    // Rate settings tool
    {
      name: 'lodgify_rate_settings',
      category: CATEGORY,
      config: {
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
      handler: async ({ params }) => {
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
      },
    },

    // Get quote tool
    {
      name: 'lodgify_get_quote',
      category: CATEGORY,
      config: {
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
      handler: async ({ propertyId, params }) => {
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
                'Invalid dates provided. Ensure dates are in YYYY-MM-DD format and the date range is valid.',
              )
            }
            if (
              error.message?.includes('Property configuration') ||
              (error.message?.includes('500') &&
                error.message?.includes('Error getting property configuration'))
            ) {
              throw new McpError(
                ErrorCode.InternalError,
                'Property configuration issue. The property may not be fully configured for quotes. Please verify the property settings in Lodgify.',
              )
            }
          }
          // Re-throw for standard error handling
          throw error
        }
      },
    },

    // Update rates V1 tool
    {
      name: 'lodgify_update_rates',
      category: CATEGORY,
      config: {
        title: 'Update Property Rates',
        description: `[${CATEGORY}] Update rates for properties and room types. This v1 endpoint provides direct rate modification capability not available in v2. Essential for dynamic pricing strategies and rate management across seasons.
      
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
                currency: z
                  .string()
                  .length(3)
                  .optional()
                  .describe('Currency code (e.g., USD, EUR)'),
              }),
            )
            .min(1)
            .describe('Array of rate updates to apply'),
        },
      },
      handler: async (params) => {
        const result = await getClient().updateRatesV1(params as RateUpdateV1Request)
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
