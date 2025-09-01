/**
 * Property Management Tools
 * MCP tools for managing Lodgify properties
 */

import { z } from 'zod'
import type { PropertySearchParams } from '../../api/v2/properties/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import type { ToolRegistration } from '../utils/types.js'
import { findProperties } from './helper-tools.js'

/**
 * Register all property management tools
 */
export function getPropertyTools(getClient: () => LodgifyOrchestrator): ToolRegistration[] {
  return [
    // List Properties Tool
    {
      name: 'lodgify_list_properties',
      category: 'Property Management',
      config: {
        title: 'List Properties',
        description: `[Property Management] List all properties with optional filtering and pagination. Returns property details including names, IDs, locations, and basic configuration. Supports filtering by status, location, and other criteria.

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
      handler: async (params) => {
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
      },
    },

    // Get Property Details Tool
    {
      name: 'lodgify_get_property',
      category: 'Property Management',
      config: {
        title: 'Get Property Details',
        description: `[Property Management] Retrieve comprehensive details for a specific property including configuration, amenities, room types, location information, and booking settings. Essential for understanding property structure before making bookings or checking availability.

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
      handler: async ({ id, wid, includeInOut }) => {
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
      },
    },

    // List Property Rooms Tool
    {
      name: 'lodgify_list_property_rooms',
      category: 'Property Management',
      config: {
        title: 'List Property Room Types',
        description:
          'Retrieve all room types and configurations for a specific property. Returns room details including capacity, pricing structure, amenities, and booking rules. Use this before checking availability or making bookings to understand available accommodation options.',
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID to list room types for'),
        },
      },
      handler: async ({ propertyId }) => {
        const result = await getClient().properties.listPropertyRooms(propertyId)
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

    // Find Properties Tool
    {
      name: 'lodgify_find_properties',
      category: 'Property Discovery & Search',
      config: {
        title: 'Find Properties',
        description: `[Property Discovery & Search] Find properties in the system when you don't know the exact property ID. Searches properties by name, gets property IDs from bookings, or lists all properties.

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
      handler: async ({ searchTerm, includePropertyIds, limit }) => {
        const result = await findProperties(getClient(), searchTerm, includePropertyIds, limit)
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

    // List Deleted Properties Tool
    {
      name: 'lodgify_list_deleted_properties',
      category: 'Property Management',
      config: {
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
      handler: async ({ params }) => {
        const result = await getClient().properties.listDeletedProperties(params)
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
