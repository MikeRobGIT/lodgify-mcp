/**
 * Rates API Client Module
 * Handles all rate-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import {
  type DailyRatesResponse,
  type RateOperationResponse,
  type RateSettingsResponse,
  safeParseDailyRates,
  safeParseRateOperation,
  safeParseRateSettings,
} from './schemas.js'
import type {
  CreateRateRequest,
  DailyRatesParams,
  RateSettingsParams,
  UpdateRateRequest,
} from './types.js'

/**
 * Rates API Client
 * Manages daily rates, rate settings, and rate updates
 */
export class RatesClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'rates',
      version: 'v2',
      basePath: 'rates',
    }
    super(client, config)
  }

  /**
   * Get daily rates calendar
   * GET /v2/rates/calendar
   */
  async getDailyRates(params: DailyRatesParams): Promise<DailyRatesResponse> {
    if (!params) {
      throw new Error('Parameters are required for daily rates')
    }

    const response = await this.request<unknown>('GET', 'calendar', {
      params: params as Record<string, unknown>,
    })

    // Validate response using Zod schema
    const parseResult = safeParseDailyRates(response)
    if (!parseResult.success) {
      throw new Error(
        `Invalid daily rates response format: ${parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      )
    }

    return parseResult.data
  }

  /**
   * Get rate settings
   * GET /v2/rates/settings
   */
  async getRateSettings(params: RateSettingsParams): Promise<RateSettingsResponse> {
    if (!params) {
      throw new Error('Parameters are required for rate settings')
    }

    const response = await this.request<unknown>('GET', 'settings', {
      params: params as Record<string, unknown>,
    })

    // Validate response using Zod schema
    const parseResult = safeParseRateSettings(response)
    if (!parseResult.success) {
      throw new Error(
        `Invalid rate settings response format: ${parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      )
    }

    return parseResult.data
  }

  /**
   * Create or update pricing rates for specific properties and room types
   * POST /v2/rates
   */
  async createRate(payload: CreateRateRequest): Promise<RateOperationResponse> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }

    const response = await this.request<unknown>('POST', '', {
      body: payload,
    })

    // Validate response using Zod schema
    const parseResult = safeParseRateOperation(response)
    if (!parseResult.success) {
      throw new Error(
        `Invalid create rate response format: ${parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      )
    }

    return parseResult.data
  }

  /**
   * Update an existing rate entry
   * PUT /v2/rates/{id}
   */
  async updateRate(id: string, payload: UpdateRateRequest): Promise<RateOperationResponse> {
    if (!id) {
      throw new Error('Rate ID is required')
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload is required')
    }

    const response = await this.request<unknown>('PUT', id, {
      body: payload,
    })

    // Validate response using Zod schema
    const parseResult = safeParseRateOperation(response)
    if (!parseResult.success) {
      throw new Error(
        `Invalid update rate response format: ${parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ')}`,
      )
    }

    return parseResult.data
  }
}
