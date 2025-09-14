/**
 * Availability API Client Module
 * Handles all availability-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { AvailabilityQueryParams, PropertyAvailabilityUpdatePayload } from './types.js'

/**
 * Availability API Client
 * Manages property availability, booking conflicts, and calendar operations
 */
export class AvailabilityClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'availability',
      version: 'v2',
      basePath: 'availability',
    }
    super(client, config)
  }

  /**
   * Get all availabilities for the calling user
   * GET /v2/availability
   */
  async getAvailabilityAll<T = unknown>(params?: AvailabilityQueryParams): Promise<T> {
    // Map from/to to start/end if provided
    const apiParams: Record<string, unknown> = {}
    if (params?.from)
      apiParams.start = params.from.includes('T') ? params.from : `${params.from}T00:00:00Z`
    if (params?.to) apiParams.end = params.to.includes('T') ? params.to : `${params.to}T23:59:59Z`
    if (params?.from && params?.to) apiParams.includeDetails = true
    if (params?.propertyId) apiParams.propertyId = params.propertyId
    if (params?.roomTypeId) apiParams.roomTypeId = params.roomTypeId

    const hasParams = Object.keys(apiParams).length > 0
    return this.request<T>('GET', '', hasParams ? { params: apiParams } : {})
  }

  /**
   * Get availability for a specific property
   * GET /v2/availability/{propertyId}
   */
  async getAvailabilityForProperty<T = unknown>(
    propertyId: string,
    params?: AvailabilityQueryParams,
  ): Promise<T> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }

    // Convert from/to parameters to start/end for the availability API
    const apiParams: Record<string, unknown> = {}

    if (params?.from) {
      // Convert YYYY-MM-DD to ISO date-time format if needed
      apiParams.start = params.from.includes('T') ? params.from : `${params.from}T00:00:00Z`
    }

    if (params?.to) {
      // Convert YYYY-MM-DD to ISO date-time format if needed
      apiParams.end = params.to.includes('T') ? params.to : `${params.to}T23:59:59Z`
    }

    // Add includeDetails to get booking information when available
    if (params?.from && params?.to) {
      apiParams.includeDetails = true
    }

    return this.request<T>('GET', propertyId, { params: apiParams })
  }

  /**
   * Get availability for a specific room type
   * GET /v2/availability/{propertyId}/{roomTypeId}
   */
  async getAvailabilityForRoom<T = unknown>(
    propertyId: string,
    roomTypeId: string,
    params?: AvailabilityQueryParams,
  ): Promise<T> {
    if (!propertyId || !roomTypeId) {
      throw new Error('Property ID and Room Type ID are required')
    }

    const apiParams: Record<string, unknown> = {}
    if (params?.from)
      apiParams.start = params.from.includes('T') ? params.from : `${params.from}T00:00:00Z`
    if (params?.to) apiParams.end = params.to.includes('T') ? params.to : `${params.to}T23:59:59Z`
    if (params?.from && params?.to) apiParams.includeDetails = true

    return this.request<T>('GET', `${propertyId}/${roomTypeId}`, {
      params: apiParams,
    })
  }

  /**
   * Update property availability settings
   * PUT /v2/properties/{propertyId}/availability
   */
  async updatePropertyAvailability(
    propertyId: string,
    payload: PropertyAvailabilityUpdatePayload,
  ): Promise<void> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }

    // This endpoint is on the properties resource, so we need to construct the full path
    return this.request<void>('PUT', `../properties/${propertyId}/availability`, {
      body: payload,
    })
  }
}
