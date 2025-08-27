/**
 * Properties API Client Module
 * Handles all property-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  FindPropertiesResult,
  PropertiesListResponse,
  Property,
  PropertySearchParams,
  RoomType,
} from './types.js'

/**
 * Properties API Client
 * Manages property listings, rooms, and property search operations
 */
export class PropertiesClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'properties',
      version: 'v2',
      basePath: 'properties',
    }
    super(client, config)
  }

  /**
   * List all properties with optional filtering
   * GET /v2/properties
   */
  async listProperties(params?: PropertySearchParams): Promise<PropertiesListResponse> {
    const result = await this.list<Property>('', params as Record<string, unknown>)

    // Ensure we return a proper PropertiesListResponse
    if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
      return result as PropertiesListResponse
    }

    // Handle legacy array response
    if (Array.isArray(result)) {
      return {
        data: result,
        count: result.length,
      }
    }

    // Wrap single property
    return {
      data: [result as Property],
      count: 1,
    }
  }

  /**
   * Get detailed information about a specific property
   * GET /v2/properties/{id}
   */
  async getProperty(id: string): Promise<Property> {
    if (!id) {
      throw new Error('Property ID is required')
    }
    return this.get<Property>('', id)
  }

  /**
   * List all room types for a property
   * GET /v2/properties/{propertyId}/rooms
   */
  async listPropertyRooms(propertyId: string): Promise<RoomType[]> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    const result = await this.request<RoomType[] | { data: RoomType[] }>(
      'GET',
      `${propertyId}/rooms`,
    )

    // Handle both array and wrapped response
    if (Array.isArray(result)) {
      return result
    }
    if (result && typeof result === 'object' && 'data' in result) {
      return result.data
    }

    return []
  }

  /**
   * List deleted properties
   * GET /v2/deletedProperties
   */
  async listDeletedProperties(params?: PropertySearchParams): Promise<PropertiesListResponse> {
    // Use a different base path for deleted properties
    const result = await this.client.request<Property[] | PropertiesListResponse>(
      'GET',
      'deletedProperties',
      { params: params as Record<string, unknown>, apiVersion: 'v2' },
    )

    // Ensure we return a proper PropertiesListResponse
    if (Array.isArray(result)) {
      return {
        data: result,
        count: result.length,
      }
    }

    return result as PropertiesListResponse
  }

  /**
   * Find properties by name or other criteria
   * This is a helper method that searches across properties and bookings
   */
  async findProperties(
    searchTerm?: string,
    includeBookings = true,
    limit = 10,
  ): Promise<FindPropertiesResult> {
    const foundProperties: Array<{
      id: string
      name: string
      source: 'properties' | 'bookings'
    }> = []

    try {
      // Search in properties
      const properties = await this.listProperties({ limit: 50 })

      for (const property of properties.data) {
        if (!searchTerm || property.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
          foundProperties.push({
            id: String(property.id),
            name: property.name || `Property ${property.id}`,
            source: 'properties',
          })

          if (foundProperties.length >= limit) break
        }
      }

      // Optionally search in bookings for property references
      if (includeBookings && foundProperties.length < limit) {
        try {
          const bookingsResult = await this.client.request<unknown>(
            'GET',
            'reservations/bookings',
            {
              params: { limit: 20 },
              apiVersion: 'v2',
            },
          )

          const bookingData = bookingsResult as
            | Array<{ propertyId?: string | number; propertyName?: string }>
            | { data?: Array<{ propertyId?: string | number; propertyName?: string }> }
          const bookings = Array.isArray(bookingData) ? bookingData : bookingData.data || []
          const propertyIdsFromBookings = new Set<string>()

          for (const booking of bookings) {
            if (booking.propertyId && !propertyIdsFromBookings.has(String(booking.propertyId))) {
              propertyIdsFromBookings.add(String(booking.propertyId))

              const propertyName = booking.propertyName || `Property ${booking.propertyId}`
              if (!searchTerm || propertyName.toLowerCase().includes(searchTerm.toLowerCase())) {
                foundProperties.push({
                  id: String(booking.propertyId),
                  name: `${propertyName} (from booking)`,
                  source: 'bookings',
                })

                if (foundProperties.length >= limit) break
              }
            }
          }
        } catch (error) {
          // Silently ignore booking search errors
          console.debug('Could not search bookings for properties:', error)
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to find properties: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const message = searchTerm
      ? `Found ${foundProperties.length} property(ies) matching "${searchTerm}"`
      : `Found ${foundProperties.length} property(ies)`

    return {
      properties: foundProperties.slice(0, limit),
      message,
      suggestions:
        foundProperties.length === 0
          ? [
              'Try a different search term',
              'Check if the property exists in the system',
              'Use listProperties() to see all available properties',
            ]
          : undefined,
    }
  }

  /**
   * Update property availability
   * PUT /v2/properties/{propertyId}/availability
   */
  async updatePropertyAvailability(
    propertyId: string,
    availability: {
      from: string
      to: string
      available: boolean
      minStay?: number
      maxStay?: number
    },
  ): Promise<{ success: boolean }> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    return this.request<{ success: boolean }>('PUT', `${propertyId}/availability`, {
      body: availability as Record<string, unknown>,
    })
  }

  /**
   * Get property statistics
   * GET /v2/properties/{propertyId}/statistics
   */
  async getPropertyStatistics(
    propertyId: string,
    params?: {
      from?: string
      to?: string
      metrics?: string[]
    },
  ): Promise<Record<string, unknown>> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    return this.request<Record<string, unknown>>('GET', `${propertyId}/statistics`, { params })
  }
}
