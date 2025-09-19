/**
 * Availability & Calendar Tools
 * MCP tools for managing property availability and calendars
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { AvailabilityQueryParams } from '../../api/v2/availability/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { createValidator, DateToolCategory } from '../utils/date/validator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
import { sanitizeInput } from '../utils/input-sanitizer.js'
import { enhanceResponse } from '../utils/response/builder.js'
import type { ToolRegistration } from '../utils/types.js'

/**
 * Register all availability and calendar tools
 */
export function getAvailabilityTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // Get Property Availability Tool
    {
      name: 'lodgify_get_property_availability',
      category: 'Availability & Calendar',
      config: {
        title: 'Get Property Availability',
        description: `Get availability for a specific property over a period. Useful for granular checks before booking or blocking dates.

Example request:
{
  "propertyId": "123",              // Property ID
  "params": {
    "from": "2024-03-01",          // Start date (YYYY-MM-DD)
    "to": "2024-03-31"             // End date (YYYY-MM-DD)
  }
}`,
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID'),
          params: z
            .object({
              from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
              to: z.string().optional().describe('End date (YYYY-MM-DD)'),
            })
            .optional(),
        },
      },
      handler: wrapToolHandler(async (input) => {
        // Sanitize input
        const sanitized = sanitizeInput(input) as {
          propertyId: string
          params?: { from?: string; to?: string }
        }
        const { propertyId, params } = sanitized

        // Normalize and validate dates using the centralized date validator
        const validator = createValidator(DateToolCategory.AVAILABILITY)
        const fromNorm = params?.from ? params.from.split('T')[0] : undefined
        const toNorm = params?.to ? params.to.split('T')[0] : undefined
        if (fromNorm && toNorm) {
          const rv = validator.validateDateRange(fromNorm, toNorm)
          if (!rv.start.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid from date: ${rv.start.feedback?.message || 'invalid date'}`,
            )
          }
          if (!rv.end.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid to date: ${rv.end.feedback?.message || 'invalid date'}`,
            )
          }
          if (!rv.rangeValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              rv.rangeError || 'Invalid date range: end date must be on/after start date',
            )
          }
        } else if (fromNorm) {
          const res = validator.validateDate(fromNorm)
          if (!res.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid from date: ${res.error || res.warning || 'invalid date'}`,
            )
          }
        } else if (toNorm) {
          const res = validator.validateDate(toNorm)
          if (!res.isValid) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid to date: ${res.error || res.warning || 'invalid date'}`,
            )
          }
        }

        const queryParams: AvailabilityQueryParams = { from: fromNorm, to: toNorm }
        const result = await getClient().availability.getAvailabilityForProperty(
          propertyId,
          queryParams,
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_get_property_availability'),
    },

    // Aggregate Vacant Inventory Tool
    {
      name: 'lodgify_list_vacant_inventory',
      category: 'Availability & Calendar',
      config: {
        title: 'List Vacant Inventory (Properties & Rooms)',
        description: `List all properties that are vacant for a date range, optionally including room details.

Use this to find available inventory in one call instead of checking each property separately.

Example request:
{
  "from": "2025-11-20",
  "to": "2025-11-25",
  "propertyIds": ["435705", "435706"],  // Optional: filter to these properties
  "includeRooms": true,                    // Include room types in the result (default: true)
  "limit": 25                              // Max number of properties when propertyIds not provided (default: 25)
}`,
        inputSchema: {
          from: z.string().min(1).describe('Start date (YYYY-MM-DD)'),
          to: z.string().min(1).describe('End date (YYYY-MM-DD)'),
          propertyIds: z
            .array(z.union([z.string(), z.number()]))
            .optional()
            .describe('Optional list of property IDs to filter'),
          includeRooms: z.boolean().default(true).describe('Include room types for each property'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .default(25)
            .describe('Max number of properties when propertyIds not provided'),
          wid: z.number().int().optional().describe('Website ID filter (if supported)'),
          debug: z.boolean().optional().describe('Include diagnostic information in response'),
        },
      },
      handler: wrapToolHandler(async (input) => {
        const sanitized = sanitizeInput(input) as {
          from: string
          to: string
          propertyIds?: Array<string | number>
          includeRooms?: boolean
          limit?: number
          wid?: number
          debug?: boolean
        }
        const { from, to, propertyIds, includeRooms, limit, wid, debug } = sanitized

        // Validate and normalize dates
        const validator = createValidator(DateToolCategory.AVAILABILITY)
        const fromNorm = from?.split('T')[0]
        const toNorm = to?.split('T')[0]
        const rv = validator.validateDateRange(fromNorm, toNorm)
        if (!rv.start.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid from date: ${rv.start.feedback?.message || 'invalid date'}`,
          )
        }
        if (!rv.end.isValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid to date: ${rv.end.feedback?.message || 'invalid date'}`,
          )
        }
        if (!rv.rangeValid) {
          throw new McpError(
            ErrorCode.InvalidParams,
            rv.rangeError || 'Invalid date range: end date must be on/after start date',
          )
        }

        const result = await getClient().findVacantInventory({
          from: fromNorm,
          to: toNorm,
          propertyIds,
          includeRooms,
          limit,
          wid,
        })

        // Determine if operation was successful based on the result
        const hasIssues =
          result.diagnostics?.possibleIssues && result.diagnostics.possibleIssues.length > 0
        const hasProperties = result.properties && result.properties.length > 0
        const status =
          hasIssues && !hasProperties ? 'failed' : hasProperties ? 'success' : 'partial'

        // Use response enhancer for better formatting
        const enhanced = enhanceResponse(result, {
          operationType: 'read',
          entityType: 'vacant_inventory',
          status,
          inputParams: sanitized,
        })

        // Remove diagnostics from the enhanced response if debug is not enabled
        if (
          !debug &&
          enhanced.data &&
          typeof enhanced.data === 'object' &&
          'diagnostics' in enhanced.data
        ) {
          const responseData = { ...enhanced.data }
          delete responseData.diagnostics
          enhanced.data = responseData
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(enhanced, null, 2),
            },
          ],
        }
      }, 'lodgify_list_vacant_inventory'),
    },
  ]
}
