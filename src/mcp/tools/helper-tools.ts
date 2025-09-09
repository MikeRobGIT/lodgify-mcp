/**
 * Helper Tools Module
 * Contains utility functions and tools used across the MCP server
 */

import type { LodgifyOrchestrator } from '../../lodgify-orchestrator.js'

// Type definitions for API responses
interface PropertyItem {
  id: string | number
  name?: string
  internal_name?: string
  title?: string
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
export async function findProperties(
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
      const propertiesData = await client.properties.listProperties()
      let propertyList: PropertyItem[] = []

      // Debug logging to understand the structure
      console.log('[findProperties] Raw response type check:', {
        hasData: 'data' in propertiesData,
        hasItems: 'items' in propertiesData,
        hasCount: 'count' in propertiesData,
      })

      // The actual response from Lodgify v2 API has structure: { data: [{ count: null, items: [...] }] }
      if (propertiesData && 'data' in propertiesData && Array.isArray(propertiesData.data)) {
        if (propertiesData.data.length > 0) {
          const firstDataItem = propertiesData.data[0]
          // Check if the first data item has an items array
          if (firstDataItem && 'items' in firstDataItem && Array.isArray(firstDataItem.items)) {
            propertyList = firstDataItem.items
            console.log(`[findProperties] Found ${propertyList.length} properties in data[0].items`)
          }
        }
      } else if (Array.isArray(propertiesData)) {
        // Fallback: Direct array of properties
        propertyList = propertiesData as PropertyItem[]
      } else if (
        propertiesData &&
        'items' in propertiesData &&
        Array.isArray(propertiesData.items)
      ) {
        // Fallback: Direct items array
        propertyList = propertiesData.items
      }

      // Process found properties
      let matchCount = 0
      for (const property of propertyList) {
        if (matchCount >= limit) break

        if (property.id) {
          // Use name, internal_name, or fallback to ID
          const propertyName =
            property.name || property.internal_name || property.title || `Property ${property.id}`
          const matchesSearch =
            !searchTerm || propertyName.toLowerCase().includes(searchTerm.toLowerCase())

          if (matchesSearch) {
            properties.push({
              id: property.id.toString(),
              name: propertyName,
              source: 'properties',
            })
            propertyIds.add(property.id.toString())
            matchCount++
          }
        }
      }

      console.log(`[findProperties] Processed ${matchCount} matching properties from API`)
    } catch (error) {
      console.error('[findProperties] Error fetching properties:', error)
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
        'Use one of these property IDs with availability tools like lodgify_get_property_availability',
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

/**
 * Validates and formats quote parameters to ensure they meet Lodgify API requirements
 * @param params The parameters to validate
 * @param skipDateValidation If true, skips date format validation (use when dates are pre-validated)
 */
export function validateQuoteParams(
  params: Record<string, unknown>,
  skipDateValidation = false,
): Record<string, unknown> {
  const validatedParams: Record<string, unknown> = { ...params }

  // The v2 API expects 'arrival' and 'departure', but we may receive 'from' and 'to'
  // Map from/to to arrival/departure if needed
  if (params.from && !params.arrival) {
    validatedParams.arrival = params.from
    delete validatedParams.from
  }
  if (params.to && !params.departure) {
    validatedParams.departure = params.to
    delete validatedParams.to
  }

  // Check for required parameters (now checking for arrival/departure)
  if (!validatedParams.arrival || !validatedParams.departure) {
    throw new Error(
      'Quote requires both "arrival" and "departure" date parameters (YYYY-MM-DD format)',
    )
  }

  // Validate date format (basic check) - skip if dates are pre-validated
  if (!skipDateValidation) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(String(validatedParams.arrival))) {
      throw new Error('Invalid "arrival" date format. Use YYYY-MM-DD format')
    }
    if (!dateRegex.test(String(validatedParams.departure))) {
      throw new Error('Invalid "departure" date format. Use YYYY-MM-DD format')
    }
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

  // If roomTypes[0].Id is provided, ensure all required room parameters are set
  if (validatedParams['roomTypes[0].Id']) {
    // Calculate total people from guest breakdown
    const adults = Number(validatedParams['guest_breakdown[adults]'] || 2)
    const children = Number(validatedParams['guest_breakdown[children]'] || 0)
    const totalPeople = adults + children

    // Set the People parameter for the room type
    if (!validatedParams['roomTypes[0].People']) {
      validatedParams['roomTypes[0].People'] = totalPeople > 0 ? totalPeople : 2 // Default to 2 if calculation fails
    }

    // Also set guest_breakdown under roomTypes[0] as per the API docs
    validatedParams['roomTypes[0].guest_breakdown.adults'] = adults
    validatedParams['roomTypes[0].guest_breakdown.children'] = children
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
