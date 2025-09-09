/**
 * Availability & Calendar Tools
 * MCP tools for managing property availability and calendars
 */

import { z } from 'zod'
import type { AvailabilityQueryParams } from '../../api/v2/availability/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
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
      handler: wrapToolHandler(async ({ propertyId, params }) => {
        const queryParams: AvailabilityQueryParams = {
          from: params?.from,
          to: params?.to,
        }
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
  ]
}
