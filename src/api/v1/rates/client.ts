/**
 * V1 Rates API Client Module
 * Handles v1 rate operations that are not available in v2
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { RateUpdateV1Request, RateUpdateV1Response } from './types.js'

/**
 * V1 Rates API Client
 * Provides access to v1-only rate operations
 * These endpoints are not available in the v2 API
 */
export class RatesV1Client extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'rates-v1',
      version: 'v1',
      basePath: 'rates',
    }
    super(client, config)
  }

  /**
   * Update rates without availability (v1 API)
   * POST /v1/rates/savewithoutavailability
   */
  async updateRatesV1(data: RateUpdateV1Request): Promise<RateUpdateV1Response> {
    if (!data || typeof data !== 'object') {
      throw new Error('Rate data is required')
    }
    if (!data.property_id) {
      throw new Error('Property ID is required')
    }
    if (!data.rates || !Array.isArray(data.rates) || data.rates.length === 0) {
      throw new Error('At least one rate entry is required')
    }

    // Validate each rate entry
    for (const rate of data.rates) {
      if (!rate.room_type_id) {
        throw new Error('Room type ID is required for all rate entries')
      }
      if (!rate.start_date || !rate.end_date) {
        throw new Error('Start date and end date are required for all rate entries')
      }
      if (typeof rate.price_per_day !== 'number' || rate.price_per_day < 0) {
        throw new Error('Valid price per day is required for all rate entries')
      }

      // Validate date format (basic check for YYYY-MM-DD)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (!datePattern.test(rate.start_date) || !datePattern.test(rate.end_date)) {
        throw new Error('Dates must be in YYYY-MM-DD format')
      }

      // Validate date order
      if (rate.start_date > rate.end_date) {
        throw new Error('Start date must be before end date')
      }

      // Validate min_stay if provided
      if (rate.min_stay !== undefined && (typeof rate.min_stay !== 'number' || rate.min_stay < 0)) {
        throw new Error('Min stay must be a non-negative number')
      }
    }

    await this.request<void>('POST', 'savewithoutavailability', { body: data })
    return {
      success: true,
      message: `Successfully updated ${data.rates.length} rate entries for property ${data.property_id}`,
      updated_rates: data.rates.length,
      property_id: data.property_id,
    }
  }
}
