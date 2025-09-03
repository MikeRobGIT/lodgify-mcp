/**
 * Property Management Tools
 * MCP tools for managing Lodgify properties
 */

import { z } from 'zod'
import type { PropertySearchParams } from '../../api/v2/properties/types.js'
import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'
import { wrapToolHandler } from '../utils/error-wrapper.js'
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
  "wid": 12345,                          // Website ID (typically a 3-5 digit number, e.g., 12345)
  "updatedSince": "2024-01-01T00:00:00Z", // Return only properties modified since this datetime
  "includeCount": true,                   // Return the total number of results
  "includeInOut": false,                  // Include available dates for arrival or departure
  "page": 1,                              // Page number to retrieve
  "size": 10                              // Number of items per page (max 50)
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
          wid: z
            .number()
            .int()
            .optional()
            .describe('Website ID (typically a 3-5 digit number, e.g., 12345)'),
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
      handler: wrapToolHandler(async (params) => {
        // Map MCP parameters to API parameters
        const mappedParams: PropertySearchParams = {}
        if (params.size !== undefined) mappedParams.limit = params.size
        if (params.page !== undefined) mappedParams.offset = (params.page - 1) * (params.size || 50)

        // Validate wid parameter - warn if suspiciously low but still allow the request
        if (params.wid !== undefined) {
          if (params.wid < 100) {
            console.warn(
              `Warning: Website ID (wid) ${params.wid} seems unusually low. Valid website IDs are typically 3+ digit numbers (e.g., 12345). This may cause an error if the website ID doesn't exist in Lodgify.`,
            )
          }
          mappedParams.wid = params.wid
        }

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
      }, 'lodgify_list_properties'),
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
  "id": 123,           // Property ID (required)
  "wid": 456,          // Website ID, only use this if you know the website ID
  "includeInOut": true // Include available dates for arrival or departure
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
      handler: wrapToolHandler(async ({ id, wid, includeInOut }) => {
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
      }, 'lodgify_get_property'),
    },

    // List Property Rooms Tool
    {
      name: 'lodgify_list_property_rooms',
      category: 'Property Management',
      config: {
        title: 'List Property Room Types',
        description: `Retrieve all room types and configurations for a specific property. Returns room details including capacity, pricing structure, amenities, and booking rules. Use this before checking availability or making bookings to understand available accommodation options.

Example request:
{
  "propertyId": "123"  // Property ID to list room types for
}`,
        inputSchema: {
          propertyId: z.string().min(1).describe('Property ID to list room types for'),
        },
      },
      handler: wrapToolHandler(async ({ propertyId }) => {
        const result = await getClient().properties.listPropertyRooms(propertyId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_list_property_rooms'),
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
  "searchTerm": "beach",        // Optional search term to filter properties by name (case-insensitive)
  "includePropertyIds": true,  // Include property IDs found in recent bookings (default: true)
  "limit": 5                   // Maximum number of properties to return (default: 10)
}

Example request (list all):
{
  "includePropertyIds": true,  // Include property IDs found in recent bookings (default: true)
  "limit": 10                  // Maximum number of properties to return (default: 10)
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
      handler: wrapToolHandler(async ({ searchTerm, includePropertyIds, limit }) => {
        const result = await findProperties(getClient(), searchTerm, includePropertyIds, limit)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_find_properties'),
    },

    // List Deleted Properties Tool
    {
      name: 'lodgify_list_deleted_properties',
      category: 'Property Management',
      config: {
        title: 'List Deleted Properties',
        description: `Retrieve properties that have been soft-deleted from the system. Useful for auditing, recovery operations, and understanding property lifecycle. Returns properties that were previously active but have been removed from general availability.

Example request:
{
  "params": {
    "deletedSince": "2024-01-01T00:00:00Z"  // Optional: filter properties deleted after this date (optional)
  }
}`,
        inputSchema: {
          params: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .optional()
            .describe(
              'Optional query parameters. Available: deletedSince (date-time, filter properties deleted after this date)',
            ),
        },
      },
      handler: wrapToolHandler(async ({ params }) => {
        const result = await getClient().properties.listDeletedProperties(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }, 'lodgify_list_deleted_properties'),
    },
  ]
}
