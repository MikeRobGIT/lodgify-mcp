/**
 * Quotes API Client Module
 * Handles all quote-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type { QuoteParams, QuoteRequest, QuoteResponse } from './types.js'

/**
 * Quotes API Client
 * Manages property quote calculations and pricing
 */
export class QuotesClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'quotes',
      version: 'v2',
      basePath: 'quote',
    }
    super(client, config)
  }

  /**
   * Convert QuoteRequest to QuoteParams (bracket notation)
   */
  private convertQuoteRequest(request: QuoteRequest): QuoteParams {
    const params: QuoteParams = {
      from: request.from,
      to: request.to,
      'guest_breakdown[adults]': request.guestBreakdown.adults,
      currency: request.currency,
      includeExtras: request.includeExtras,
      includeBreakdown: request.includeBreakdown,
    }

    // Add optional guest breakdown
    if (request.guestBreakdown.children !== undefined) {
      params['guest_breakdown[children]'] = request.guestBreakdown.children
    }
    if (request.guestBreakdown.infants !== undefined) {
      params['guest_breakdown[infants]'] = request.guestBreakdown.infants
    }

    // Add room types with bracket notation
    request.roomTypes.forEach((roomType, index) => {
      params[`roomTypes[${index}].Id`] = roomType.Id
      if (roomType.quantity !== undefined) {
        params[`roomTypes[${index}].quantity`] = roomType.quantity
      }
    })

    return params
  }

  /**
   * Get a quote for a property (using structured request)
   * GET /v2/quote/{propertyId}
   */
  async getQuote(propertyId: string, request: QuoteRequest): Promise<QuoteResponse> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!request || typeof request !== 'object') {
      throw new Error('Valid quote request object is required')
    }

    const params = this.convertQuoteRequest(request)
    return this.request<QuoteResponse>('GET', propertyId, {
      params: params as Record<string, unknown>,
    })
  }

  /**
   * Get a quote for a property (using raw parameters)
   * GET /v2/quote/{propertyId}
   */
  async getQuoteRaw<T = unknown>(
    propertyId: string,
    params: QuoteParams | Record<string, unknown>,
  ): Promise<T> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!params || typeof params !== 'object') {
      throw new Error('Valid parameters object is required for quote')
    }

    return this.request<T>('GET', propertyId, { params: params as Record<string, unknown> })
  }
}
