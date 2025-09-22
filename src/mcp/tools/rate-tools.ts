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
import { debugLogResponse, safeJsonStringify } from '../serialization/json-sanitizer.js'
import { isISODateTime, isYYYYMMDD } from '../utils/date/format.js'
// Note: Schemas are inlined directly to avoid $ref issues with MCPO
// Previously imported DateStringSchema from '../schemas/common.js'
import {
  createValidator,
  DateToolCategory,
  type DateValidationInfo,
} from '../utils/date/validator.js'
import { extractRateDetails } from '../utils/entity-extractors.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput, validateDatePair } from '../utils/input-sanitizer.js'
import { flexibleEnhanceResponse as enhanceResponseBuilder } from '../utils/response/builder.js'
import { formatMcpResponse } from '../utils/response/index.js'
import { toApiResponseData } from '../utils/response/validators.js'
import { generateSuggestions } from '../utils/suggestion-generator.js'
import { generateSummary } from '../utils/summary-generator.js'
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
  "roomTypeId": 123,           // Room Type ID (required)
  "houseId": 456,              // House/Property ID (required)
  "startDate": "2024-03-01",   // Start date for rates calendar (YYYY-MM-DD)
  "endDate": "2024-03-31"      // End date for rates calendar (YYYY-MM-DD)
}`,
        inputSchema: {
          roomTypeId: z.number().int().describe('Room Type ID (required)'),
          houseId: z.number().int().describe('House/Property ID (required)'),
          startDate: z
            .string()
            .refine(isYYYYMMDD, 'Date must be in YYYY-MM-DD format')
            .describe('Start date for rates calendar (YYYY-MM-DD)'),
          endDate: z
            .string()
            .refine(isYYYYMMDD, 'Date must be in YYYY-MM-DD format')
            .describe('End date for rates calendar (YYYY-MM-DD)'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { roomTypeId, houseId, startDate, endDate } = sanitizeInput(input)

        // Validate date range for rates
        const validator = createValidator(DateToolCategory.RATE)
        const rangeValidation = validator.validateDateRange(startDate, endDate)

        // Check if dates are valid
        if (!rangeValidation.start.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid startDate: ${rangeValidation.start.error}`,
          )
        }
        if (!rangeValidation.end.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid endDate: ${rangeValidation.end.error}`,
          )
        }
        if (!rangeValidation.rangeValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            rangeValidation.rangeError || 'Invalid date range',
          )
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
        // Note: Lodgify API expects PascalCase parameter names
        const params: DailyRatesParams = {
          RoomTypeId: roomTypeId.toString(),
          HouseId: houseId.toString(),
          StartDate: rangeValidation.start.validatedDate,
          EndDate: rangeValidation.end.validatedDate,
        }

        const result = await getClient().rates.getDailyRates(params)

        // Debug logging
        debugLogResponse('Daily rates API response', result)

        // Merge validation info with result if present
        const finalResult = dateValidationInfo ? { ...result, ...dateValidationInfo } : result

        // Extract rate details
        const rateDetails = extractRateDetails(finalResult)

        // Generate summary for daily rates
        const summary = generateSummary(
          toApiResponseData(finalResult, 'daily_rates'),
          'daily_rates',
        )

        // Generate suggestions for rate analysis
        const suggestions = generateSuggestions('rate_analysis', 'rates', {
          roomTypeId,
          houseId,
          startDate: rangeValidation.start.validatedDate,
          endDate: rangeValidation.end.validatedDate,
        })

        // Use enhanceResponse to build the response
        const enhanced = enhanceResponseBuilder(finalResult, {
          entityType: 'daily_rates',
          operation: 'get',
          inputParams: toApiResponseData(params, 'daily_rates_input'),
          extractedInfo: rateDetails,
          metadata: {
            summary,
            suggestions,
          },
        })

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(enhanced),
            },
          ],
        }
      }, 'lodgify_daily_rates'),
    },

    // Rate settings tool
    {
      name: 'lodgify_rate_settings',
      category: CATEGORY,
      config: {
        title: 'Get Rate Configuration Settings',
        description: `Retrieve rate configuration settings including pricing rules, modifiers, seasonal adjustments, and rate calculation parameters. This shows HOW rates are calculated, not the actual prices themselves. Use lodgify_daily_rates to view actual pricing. Essential for understanding rate calculation logic and configuring pricing strategies.

Example request:
{
  "params": {
    "houseId": 456  // House/Property ID (optional)
  }
}`,
        inputSchema: {
          params: z
            .object({
              houseId: z.number().int().optional().describe('House/Property ID'),
            })
            .optional()
            .describe('Query parameters for rate settings'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { params } = sanitizeInput(input)
        // Pass params directly to the API (expecting houseId)
        const rateParams = params?.houseId ? { houseId: params.houseId.toString() } : {}
        const result = await getClient().rates.getRateSettings(rateParams)

        // Debug logging
        debugLogResponse('Rate settings API response', result)

        // Extract rate configuration details
        const rateDetails = extractRateDetails(result)

        // Generate summary for rate settings
        const summary = generateSummary(result, 'rate_settings')

        // Generate suggestions for rate configuration
        const suggestions = generateSuggestions('rate_settings', 'rates', {
          houseId: params?.houseId,
        })

        // Use enhanceResponse to build the response
        const enhanced = enhanceResponseBuilder(result, {
          entityType: 'rate_settings',
          operation: 'get',
          inputParams: { params },
          extractedInfo: rateDetails,
          metadata: {
            summary: summary || 'Rate configuration and pricing rules',
            suggestions,
          },
        })

        return {
          content: [
            {
              type: 'text',
              text: safeJsonStringify(enhanced),
            },
          ],
        }
      }, 'lodgify_rate_settings'),
    },

    // Get quote tool
    {
      name: 'lodgify_get_quote',
      category: CATEGORY,
      config: {
        title: 'Calculate Pricing Quote',
        description: `Calculate pricing for a potential booking. This tool checks availability and calculates total pricing for specified dates, room types, and guest counts. Use this to get a price quote BEFORE creating a booking.

⚠️ Important: This calculates NEW pricing for available dates. It does NOT retrieve existing quotes from bookings. For existing booking quotes, use lodgify_create_booking_quote.

Workflow: Use this tool to check prices → If acceptable, create booking → Use lodgify_create_booking_quote to modify existing booking quotes.

Required parameters: dates (use either "from"/"to" or "arrival"/"departure" in YYYY-MM-DD format), plus room type and guest information.

Example request:
{
  "propertyId": "123",                   // Property ID to check pricing for
  "params": {
    "from": "2025-09-01",                // Check-in date (or use "arrival")
    "to": "2025-09-03",                  // Check-out date (or use "departure")
    "roomTypes[0].Id": 123,              // Room type ID (uses bracket notation)
    "guest_breakdown[adults]": 2,        // Number of adults (uses bracket notation)
    "guest_breakdown[children]": 0       // Number of children (optional, uses bracket notation)
  }
}`,
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID to calculate pricing for'),
          params: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .describe(
              'Pricing calculation parameters: dates (from/to or arrival/departure), room types (roomTypes[0].Id), guest breakdown (guest_breakdown[adults]). Uses bracket notation for complex parameters.',
            ),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { propertyId, params } = sanitizeInput(input)

        try {
          // First, validate dates using the comprehensive date validation system
          const validator = createValidator(DateToolCategory.QUOTE)
          let dateValidationInfo: DateValidationInfo | null = null

          // Extract dates - support both from/to and arrival/departure
          const fromDate = String(params.from || params.arrival || '')
          const toDate = String(params.to || params.departure || '')

          // Validate date range
          const rangeValidation = validator.validateDateRange(fromDate, toDate)

          // Check if dates are valid
          if (!rangeValidation.start.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid arrival date: ${rangeValidation.start.error || rangeValidation.start.feedback?.message || 'Invalid date format'}`,
            )
          }
          if (!rangeValidation.end.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid departure date: ${rangeValidation.end.error || rangeValidation.end.feedback?.message || 'Invalid date format'}`,
            )
          }
          if (!rangeValidation.rangeValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              rangeValidation.rangeError ||
                rangeValidation.rangeFeedback?.message ||
                'Invalid date range',
            )
          }

          // Update params with validated dates - use arrival/departure for v2 API
          const validatedParams = { ...params }
          // Remove old params if they exist
          delete validatedParams.from
          delete validatedParams.to
          // Set the correct parameter names with validated dates
          validatedParams.arrival = rangeValidation.start.validatedDate
          validatedParams.departure = rangeValidation.end.validatedDate

          // Prepare validation info if there's feedback to show
          if (
            rangeValidation.start.feedback ||
            rangeValidation.end.feedback ||
            rangeValidation.rangeFeedback
          ) {
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
                rangeFeedback: rangeValidation.rangeFeedback,
                message:
                  rangeValidation.start.feedback ||
                  rangeValidation.end.feedback ||
                  rangeValidation.rangeFeedback
                    ? '⚠️ Date validation feedback available'
                    : '✅ Dates validated',
              },
            }
          }

          // Now validate remaining quote parameters
          const fullyValidatedParams = validateQuoteParams(validatedParams, true) // Pass true to skip date validation

          // Pass validated params as QuoteParams (which supports bracket notation)
          const result = await getClient().getQuote(propertyId, fullyValidatedParams as QuoteParams)

          // Debug logging
          debugLogResponse('Quote API response', result)

          // Merge validation info with result if present
          const finalResult = dateValidationInfo ? { ...result, ...dateValidationInfo } : result

          // Extract rate quote details
          const rateDetails = extractRateDetails(finalResult)

          // Generate summary for quote
          const summary = generateSummary(finalResult, 'quote')

          // Generate suggestions based on quote results
          const suggestions = generateSuggestions('quote_calculated', 'rates', {
            propertyId,
            from: validatedParams.from || validatedParams.arrival,
            to: validatedParams.to || validatedParams.departure,
            totalPrice: finalResult?.totalPrice,
          })

          // Use enhanceResponse to build the response
          const enhanced = enhanceResponseBuilder(finalResult, {
            entityType: 'quote',
            operation: 'calculate',
            inputParams: { propertyId, params },
            extractedInfo: rateDetails,
            metadata: {
              summary,
              suggestions,
            },
          })

          return {
            content: [
              {
                type: 'text',
                text: safeJsonStringify(enhanced),
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
      }, 'lodgify_get_quote'),
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
  "property_id": 123,           // Property ID to update rates for
  "rates": [
    {
      "room_type_id": 456,      // Room type ID
      "start_date": "2024-06-01", // Start date for rate period (YYYY-MM-DD)
      "end_date": "2024-08-31",   // End date for rate period (YYYY-MM-DD)
      "price_per_day": 150.00,  // Rate amount per day
      "min_stay": 3,             // Minimum stay requirement
      "currency": "USD"          // Currency code (e.g., USD, EUR)
    },
    {
      "room_type_id": 457,      // Room type ID
      "start_date": "2024-06-01", // Start date for rate period (YYYY-MM-DD)
      "end_date": "2024-08-31",   // End date for rate period (YYYY-MM-DD)
      "price_per_day": 200.00,  // Rate amount per day
      "min_stay": 2,             // Minimum stay requirement
      "currency": "USD"          // Currency code (e.g., USD, EUR)
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
      handler: wrapToolHandler(async (params) => {
        // Sanitize input and validate rates
        const sanitized = sanitizeInput(params)

        // Additional validation for rate dates
        if (sanitized.rates) {
          for (const rate of sanitized.rates) {
            // Use consolidated date validation helper
            const validation = validateDatePair(
              rate.start_date,
              rate.end_date,
              'start_date',
              'end_date',
            )

            if (!validation.isValid) {
              throw new McpError(ErrorCode.InvalidParams, validation.errors.join(' '))
            }
          }
        }

        const result = await getClient().updateRatesV1(sanitized as RateUpdateV1Request)

        // Debug logging
        debugLogResponse('Update rates API response', result)

        // Generate summary for rate update
        const summary = generateSummary(toApiResponseData(result, 'rate_update'), 'rate_update')

        // Generate suggestions for rate updates
        const suggestions = generateSuggestions('rates_updated', 'rates', {
          propertyId: sanitized.property_id,
          rateCount: sanitized.rates?.length || 0,
        })

        // Use enhanceResponse to build the response
        const enhanced = enhanceResponseBuilder(result, {
          entityType: 'rate',
          operation: 'update',
          inputParams: toApiResponseData(params, 'rate_update_input'),
          metadata: {
            summary: summary || 'Rates have been successfully updated',
            suggestions,
          },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_update_rates'),
    },

    // Create Booking Quote tool
    {
      name: 'lodgify_create_booking_quote',
      category: CATEGORY,
      config: {
        title: 'Create Custom Quote for Booking',
        description: `[${CATEGORY}] Create a custom quote for an existing booking with pricing adjustments. This allows property managers to provide personalized pricing for specific bookings.

⚠️ **Important**: This is a WRITE operation that modifies booking data. It will be blocked in read-only mode.

⚠️ **Note**: Fees and discounts are not currently supported by this tool. The adjustments field is included for future compatibility but will not be processed.

**Use Cases**:
- Provide modified total pricing for bookings
- Create custom quotes with specific validity periods
- Send personalized pricing to guests

Example request:
{
  "bookingId": "BK12345",        // Booking ID to create quote for
  "payload": {
    "totalPrice": 1500.00,      // Total quote amount
    "currency": "USD",           // Currency code (e.g., USD, EUR)
    "breakdown": {
      "accommodation": 1200.00, // Accommodation cost
      "taxes": 150.00,          // Tax amount
      "fees": 100.00,           // Service fees
      "discount": 50.00         // Discount amount
    },
    "adjustments": [              // Custom pricing adjustments
      {
        "type": "discount",        // Type of adjustment
        "description": "Early booking discount",  // Description of adjustment
        "amount": 50.00,           // Adjustment amount
        "isPercentage": false      // Is this a percentage?
      }
    ],
    "validUntil": "2024-03-31T23:59:59Z",  // Quote expiration date (ISO 8601)
    "notes": "Special rate for returning guest",  // Internal notes about the quote
    "sendToGuest": true            // Send quote to guest via email
  }
}

Example response:
{
  "id": "Q12345",
  "bookingId": "BK12345",
  "status": "created",
  "totalPrice": 1500.00,
  "currency": "USD",
  "createdAt": "2024-03-15T10:00:00Z",
  "validUntil": "2024-03-31T23:59:59Z",
  "guestViewUrl": "https://lodgify.com/quote/view/Q12345",
  "paymentUrl": "https://lodgify.com/quote/pay/Q12345"
}`,
        inputSchema: {
          bookingId: z.string().min(1).describe('Booking ID to create quote for'),
          payload: z
            .object({
              // Pricing
              totalPrice: z.number().positive().optional().describe('Total quote amount'),
              subtotal: z.number().positive().optional().describe('Subtotal before taxes/fees'),
              currency: z.string().length(3).optional().describe('Currency code (e.g., USD, EUR)'),

              // Breakdown
              breakdown: z
                .object({
                  accommodation: z.number().optional().describe('Accommodation cost'),
                  taxes: z.number().optional().describe('Tax amount'),
                  fees: z.number().optional().describe('Service fees'),
                  extras: z.number().optional().describe('Extra services cost'),
                  discount: z.number().optional().describe('Discount amount'),
                })
                .optional()
                .describe('Price breakdown details'),

              // Adjustments
              adjustments: z
                .array(
                  z.object({
                    type: z
                      .enum(['discount', 'fee', 'tax', 'extra'])
                      .describe('Type of adjustment'),
                    description: z.string().describe('Description of adjustment'),
                    amount: z.number().describe('Adjustment amount'),
                    isPercentage: z.boolean().optional().describe('Is this a percentage?'),
                  }),
                )
                .optional()
                .describe('Custom pricing adjustments'),

              // Metadata
              validUntil: z.string().optional().describe('Quote expiration date (ISO 8601)'),
              notes: z.string().optional().describe('Internal notes about the quote'),
              customTerms: z.string().optional().describe('Custom terms and conditions'),

              // References
              policyId: z.string().optional().describe('Cancellation policy ID'),
              rentalAgreementId: z.string().optional().describe('Rental agreement ID'),

              // Options
              sendToGuest: z.boolean().optional().describe('Send quote to guest via email'),
              replaceExisting: z.boolean().optional().describe('Replace existing quote if any'),
            })
            .describe('Quote creation payload with pricing and terms'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const { bookingId, payload } = sanitizeInput(input)

        // Additional validation for quote payload
        if (payload.totalPrice !== undefined && payload.totalPrice <= 0) {
          throw new McpError(ErrorCode.InvalidParams, 'Total price must be a positive number')
        }

        if (payload.validUntil) {
          // Validate ISO date-time format
          if (!isISODateTime(payload.validUntil)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid validUntil format. Use ISO 8601 format (e.g., 2024-03-31T23:59:59Z)',
            )
          }
        }

        // Use the orchestrator's createBookingQuote method which handles read-only mode
        const result = await getClient().createBookingQuote(bookingId, payload)

        // Debug logging
        debugLogResponse('Create booking quote response', result)

        // Extract rate details from quote
        const rateDetails = extractRateDetails(result)

        // Generate summary for created quote
        const summary = generateSummary(result, 'booking_quote')

        // Generate suggestions for quote follow-up
        const suggestions = generateSuggestions('quote_created', 'rates', {
          bookingId,
          quoteId: result?.id,
          totalPrice: payload.totalPrice,
          validUntil: payload.validUntil,
          sentToGuest: payload.sendToGuest,
        })

        // Use enhanceResponse to build the response
        const enhanced = enhanceResponseBuilder(result, {
          entityType: 'quote',
          operation: 'create',
          inputParams: { bookingId, payload },
          extractedInfo: rateDetails,
          metadata: {
            summary: summary || 'Quote has been successfully created',
            suggestions,
          },
        })

        return {
          content: [
            {
              type: 'text',
              text: formatMcpResponse(enhanced),
            },
          ],
        }
      }, 'lodgify_create_booking_quote'),
    },
  ]
}
