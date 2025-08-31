/**
 * Availability & Calendar Tools
 * MCP tools for managing property availability and calendars
 */

import { z } from 'zod'
import type { AvailabilityQueryParams } from '../../api/v2/availability/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { DateStringSchema } from '../schemas/common.js'
import {
  createValidator,
  type DateValidationInfo,
  DateValidator,
  ToolCategory,
} from '../utils/date-validator.js'
import type { ToolRegistration } from '../utils/types.js'

/**
 * Register all availability and calendar tools
 */
export function getAvailabilityTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Get All Availabilities Tool
    {
      name: 'lodgify_availability_all',
      category: 'Availability & Calendar',
      config: {
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
      handler: async ({ params }) => {
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
      },
    },

    // Check Next Availability Tool
    {
      name: 'lodgify_check_next_availability',
      category: 'Availability & Calendar',
      config: {
        title: 'Find Next Available Date',
        description: `[Availability & Calendar] Find the next available date for a property by analyzing bookings. Returns when the property is next available and for how long. If property ID is unknown, use lodgify_find_properties first.

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
          fromDate: DateStringSchema.optional().describe(
            'Start date to check from (YYYY-MM-DD). Defaults to today if not provided.',
          ),
          daysToCheck: z
            .number()
            .min(1)
            .max(365)
            .optional()
            .describe('Number of days to check ahead (1-365). Defaults to 90 days.'),
        },
      },
      handler: async ({ propertyId, fromDate, daysToCheck }) => {
        let validatedFromDate = fromDate
        let dateValidationInfo: DateValidationInfo | null = null

        // Validate the fromDate if provided
        if (fromDate) {
          const validator = createValidator(ToolCategory.AVAILABILITY)
          const validation = validator.validateDate(fromDate)

          if (!validation.isValid) {
            throw new Error(`Date validation failed: ${validation.error}`)
          }

          validatedFromDate = validation.validatedDate

          // Include validation info if there's feedback to show
          if (validation.feedback) {
            dateValidationInfo = {
              dateValidation: {
                feedback: validation.feedback,
                originalDate: validation.originalDate,
                validatedDate: validation.validatedDate,
                message: DateValidator.formatUserMessage(validation),
              },
            }
          }
        }

        const result = await getClient().availability.getNextAvailableDate(
          propertyId,
          validatedFromDate,
          daysToCheck,
        )

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

    // Check Date Range Availability Tool
    {
      name: 'lodgify_check_date_range_availability',
      category: 'Availability & Calendar',
      config: {
        title: 'Check Date Range Availability',
        description:
          'Verify if a specific date range is available for booking at a property. Returns detailed availability status including any conflicts or restrictions. Use this before creating bookings to ensure availability and avoid booking conflicts.',
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID to check availability for'),
          checkInDate: DateStringSchema.describe('Desired check-in date (YYYY-MM-DD)'),
          checkOutDate: DateStringSchema.describe('Desired check-out date (YYYY-MM-DD)'),
        },
      },
      handler: async ({ propertyId, checkInDate, checkOutDate }) => {
        const validator = createValidator(ToolCategory.AVAILABILITY)
        const rangeValidation = validator.validateDateRange(checkInDate, checkOutDate)

        // Check if dates are valid
        if (!rangeValidation.start.isValid) {
          throw new Error(`Check-in date validation failed: ${rangeValidation.start.error}`)
        }
        if (!rangeValidation.end.isValid) {
          throw new Error(`Check-out date validation failed: ${rangeValidation.end.error}`)
        }
        if (!rangeValidation.rangeValid) {
          throw new Error(rangeValidation.rangeError || 'Invalid date range')
        }

        // Prepare validation info if there's feedback to show
        let dateValidationInfo: DateValidationInfo | null = null
        if (rangeValidation.start.feedback || rangeValidation.end.feedback) {
          dateValidationInfo = {
            dateValidation: {
              checkIn: {
                original: rangeValidation.start.originalDate,
                validated: rangeValidation.start.validatedDate,
                feedback: rangeValidation.start.feedback,
                message: rangeValidation.start.warning,
              },
              checkOut: {
                original: rangeValidation.end.originalDate,
                validated: rangeValidation.end.validatedDate,
                feedback: rangeValidation.end.feedback,
                message: rangeValidation.end.warning,
              },
              summary: `${rangeValidation.start.feedback || rangeValidation.end.feedback ? '⚠️ Date validation feedback available' : '✅ Dates validated'}`,
            },
          }
        }

        const result = await getClient().availability.checkDateRangeAvailability(
          propertyId,
          rangeValidation.start.validatedDate,
          rangeValidation.end.validatedDate,
        )

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

    // Get Availability Calendar Tool
    {
      name: 'lodgify_get_availability_calendar',
      category: 'Availability & Calendar',
      config: {
        title: 'Get Availability Calendar View',
        description:
          'Retrieve a visual calendar view of property availability showing available, booked, and blocked dates. Perfect for displaying availability to guests, planning maintenance windows, or understanding booking patterns over time.',
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID to get calendar for'),
          fromDate: DateStringSchema.optional().describe(
            'Calendar start date (YYYY-MM-DD). Defaults to today',
          ),
          daysToShow: z
            .number()
            .min(1)
            .max(90)
            .optional()
            .describe('Number of days to display (1-90). Default: 30 days'),
        },
      },
      handler: async ({ propertyId, fromDate, daysToShow }) => {
        let validatedFromDate = fromDate
        let dateValidationInfo: DateValidationInfo | null = null

        // Validate the fromDate if provided
        if (fromDate) {
          const validator = createValidator(ToolCategory.AVAILABILITY)
          const validation = validator.validateDate(fromDate)

          if (!validation.isValid) {
            throw new Error(`Date validation failed: ${validation.error}`)
          }

          validatedFromDate = validation.validatedDate

          // Include validation info if there's feedback to show
          if (validation.feedback) {
            dateValidationInfo = {
              dateValidation: {
                feedback: validation.feedback,
                originalDate: validation.originalDate,
                validatedDate: validation.validatedDate,
                message: DateValidator.formatUserMessage(validation),
              },
            }
          }
        }

        const result = await getClient().availability.getAvailabilityCalendar(
          propertyId,
          validatedFromDate,
          daysToShow,
        )

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
  ]
}
