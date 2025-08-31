/**
 * Lodgify API Orchestrator
 * Coordinates all API modules and provides a unified interface
 * Replaces the monolithic lodgify.ts client
 */

import { ApiClientOrchestrator } from './api/client-orchestrator.js'
import { BookingsV1Client } from './api/v1/bookings/index.js'
import type {
  BookingV1Response,
  CreateBookingV1Request,
  DeleteBookingV1Response,
  UpdateBookingV1Request,
} from './api/v1/bookings/types.js'
import { RatesV1Client } from './api/v1/rates/index.js'
import type { RateUpdateV1Request, RateUpdateV1Response } from './api/v1/rates/types.js'
import { WebhooksClient } from './api/v1/webhooks/index.js'
import type {
  WebhookEvent,
  WebhookListResponse,
  WebhookSubscribeRequest,
  WebhookSubscribeResponse,
  WebhookUnsubscribeRequest,
} from './api/v1/webhooks/types.js'
import { AvailabilityClient } from './api/v2/availability/index.js'
import type {
  AvailabilityCalendarResult,
  AvailabilityQueryParams,
  BookingPeriod,
  DateRangeAvailabilityResult,
  NextAvailabilityResult,
} from './api/v2/availability/types.js'
import { BookingsClient } from './api/v2/bookings/index.js'
import type {
  Booking,
  BookingSearchParams,
  BookingsListResponse,
  CreateBookingRequest,
  KeyCodesRequest,
  PaymentLink,
  PaymentLinkRequest,
  UpdateBookingRequest,
} from './api/v2/bookings/types.js'
import { MessagingClient } from './api/v2/messaging/index.js'
import type { Message, MessageThread, Participant } from './api/v2/messaging/types.js'
// Import all API modules
import { PropertiesClient } from './api/v2/properties/index.js'
// Import types for backward compatibility
import type {
  PropertiesListResponse,
  Property,
  PropertySearchParams,
  RoomType,
} from './api/v2/properties/types.js'
import { QuotesClient } from './api/v2/quotes/index.js'
import type { QuoteParams, QuoteRequest, QuoteResponse } from './api/v2/quotes/types.js'
import { RatesClient } from './api/v2/rates/index.js'
import type { DailyRatesResponse, RateSettingsResponse } from './api/v2/rates/schemas.js'
import type { DailyRatesParams } from './api/v2/rates/types.js'
import { ReadOnlyModeError } from './core/errors/read-only-error.js'
import { safeLogger } from './logger.js'

/**
 * Lodgify API Orchestrator Configuration
 */
export interface LodgifyOrchestratorConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  debugHttp?: boolean
  readOnly?: boolean
}

/**
 * Main Lodgify API Orchestrator Class
 * Provides unified access to all Lodgify API functionality
 */
export class LodgifyOrchestrator {
  private client: ApiClientOrchestrator
  private readonly readOnly: boolean

  // API module instances
  public readonly properties: PropertiesClient
  public readonly bookings: BookingsClient
  public readonly availability: AvailabilityClient
  public readonly rates: RatesClient
  public readonly quotes: QuotesClient
  public readonly messaging: MessagingClient
  public readonly webhooks: WebhooksClient

  // V1 API module instances
  public readonly bookingsV1: BookingsV1Client
  public readonly ratesV1: RatesV1Client

  constructor(config: LodgifyOrchestratorConfig) {
    // Store read-only mode - default to false (write-enabled) when not set
    this.readOnly = config.readOnly === true

    // Debug logging for read-only mode
    if (config.debugHttp && config.readOnly !== undefined) {
      safeLogger.debug('[LodgifyOrchestrator] Read-only mode configuration', {
        readOnlyProvided: !!config.readOnly,
        readOnly: this.readOnly,
      })
    }

    // Initialize the API client orchestrator
    this.client = new ApiClientOrchestrator({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.lodgify.com',
      defaultVersion: 'v2',
      readOnly: this.readOnly, // Use normalized boolean value
    })

    // Initialize all API modules
    this.properties = new PropertiesClient(this.client)
    this.bookings = new BookingsClient(this.client)
    this.availability = new AvailabilityClient(this.client)
    this.rates = new RatesClient(this.client)
    this.quotes = new QuotesClient(this.client)
    this.messaging = new MessagingClient(this.client)
    this.webhooks = new WebhooksClient(this.client)

    // Initialize v1 API modules
    this.bookingsV1 = new BookingsV1Client(this.client)
    this.ratesV1 = new RatesV1Client(this.client)
  }

  /**
   * Check if read-only mode is enabled and throw error if write operation attempted
   */
  private checkReadOnly(operation: string, path: string): void {
    if (this.readOnly) {
      throw ReadOnlyModeError.forApiOperation('POST', path, operation)
    }
  }

  /**
   * Get read-only mode status
   */
  public isReadOnly(): boolean {
    return this.readOnly
  }

  /**
   * Test API connectivity
   * Returns basic API information to verify connection
   */
  async testConnection(): Promise<{ status: string; timestamp: string }> {
    try {
      // Use a simple properties list call to test connectivity
      await this.properties.listProperties({ limit: 1 })
      return {
        status: 'connected',
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to Lodgify API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get health status of all API modules
   * Useful for monitoring and debugging
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'unhealthy'
    modules: Record<string, { status: 'up' | 'down'; lastChecked: string; error?: string }>
  }> {
    const modules: Record<string, { status: 'up' | 'down'; lastChecked: string; error?: string }> =
      {}
    let healthyCount = 0

    const moduleTests = [
      { name: 'properties', test: () => this.properties.listProperties({ limit: 1 }) },
      { name: 'bookings', test: () => this.bookings.listBookings({ limit: 1 }) },
      { name: 'rates', test: () => this.rates.getRateSettings({}) },
      { name: 'webhooks', test: () => this.webhooks.listWebhooks({ limit: 1 }) },
    ]

    for (const { name, test } of moduleTests) {
      try {
        await test()
        modules[name] = {
          status: 'up',
          lastChecked: new Date().toISOString(),
        }
        healthyCount++
      } catch (error) {
        modules[name] = {
          status: 'down',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    return {
      overall: healthyCount === moduleTests.length ? 'healthy' : 'unhealthy',
      modules,
    }
  }

  /**
   * Backward compatibility: Legacy method names
   * These methods delegate to the appropriate module methods
   */

  // Properties backward compatibility
  async getProperties(params?: PropertySearchParams): Promise<PropertiesListResponse> {
    return this.properties.listProperties(params)
  }

  async getProperty(id: string): Promise<Property> {
    return this.properties.getProperty(id)
  }

  async getPropertyRooms(propertyId: string): Promise<RoomType[]> {
    return this.properties.listPropertyRooms(propertyId)
  }

  // Bookings backward compatibility
  async getBookings(params?: BookingSearchParams): Promise<BookingsListResponse> {
    return this.bookings.listBookings(params)
  }

  async getBooking(id: string): Promise<Booking> {
    return this.bookings.getBooking(id)
  }

  async createBooking(booking: CreateBookingRequest): Promise<Booking> {
    this.checkReadOnly('Create Booking', '/v2/bookings')
    return this.bookings.createBooking(booking)
  }

  async updateBooking(id: string, updates: UpdateBookingRequest): Promise<Booking> {
    this.checkReadOnly('Update Booking', `/v2/bookings/${id}`)
    return this.bookings.updateBooking(id, updates)
  }

  async deleteBooking(id: string): Promise<{ success: boolean; message?: string }> {
    this.checkReadOnly('Delete Booking', `/v2/bookings/${id}`)
    return this.bookings.deleteBooking(id)
  }

  // Rates backward compatibility
  async getDailyRates(params: DailyRatesParams): Promise<DailyRatesResponse> {
    return this.rates.getDailyRates(params)
  }

  async getRateSettings(params?: Record<string, unknown>): Promise<RateSettingsResponse> {
    return this.rates.getRateSettings(params || {})
  }

  async updateRates(rateUpdate: RateUpdateV1Request): Promise<RateUpdateV1Response> {
    this.checkReadOnly('Update Rates', '/v1/rates/savewithoutavailability')
    return this.ratesV1.updateRatesV1(rateUpdate)
  }

  // Quotes backward compatibility
  async getQuote(propertyId: string, params: QuoteParams): Promise<QuoteResponse> {
    return this.quotes.getQuoteRaw(propertyId, params)
  }

  // Availability backward compatibility
  async getNextAvailableDate(
    propertyId: string,
    fromDate?: string,
    daysToCheck = 90,
  ): Promise<NextAvailabilityResult> {
    return this.availability.getNextAvailableDate(propertyId, fromDate, daysToCheck)
  }

  async checkDateRangeAvailability(
    propertyId: string,
    checkInDate: string,
    checkOutDate: string,
  ): Promise<DateRangeAvailabilityResult> {
    return this.availability.checkDateRangeAvailability(propertyId, checkInDate, checkOutDate)
  }

  async getAvailabilityCalendar(
    propertyId: string,
    fromDate?: string,
    daysToShow = 30,
  ): Promise<AvailabilityCalendarResult> {
    return this.availability.getAvailabilityCalendar(propertyId, fromDate, daysToShow)
  }

  // Payment Links backward compatibility
  async getBookingPaymentLink(id: string): Promise<PaymentLink> {
    return this.bookings.getBookingPaymentLink(id)
  }

  async createBookingPaymentLink(
    id: string,
    paymentRequest: PaymentLinkRequest,
  ): Promise<PaymentLink> {
    this.checkReadOnly('Create Payment Link', `/v2/bookings/${id}/quote/paymentLink`)
    return this.bookings.createBookingPaymentLink(id, paymentRequest)
  }

  // Key Codes backward compatibility
  async updateKeyCodes(id: string, keyCodes: KeyCodesRequest): Promise<{ success: boolean }> {
    this.checkReadOnly('Update Key Codes', `/v2/bookings/${id}/keyCodes`)
    return this.bookings.updateKeyCodes(id, keyCodes)
  }

  // Messaging backward compatibility
  async getThread(threadGuid: string): Promise<MessageThread> {
    return this.messaging.getThread(threadGuid)
  }

  // Webhooks backward compatibility
  async listWebhooks(): Promise<WebhookListResponse> {
    return this.webhooks.listWebhooks()
  }

  async subscribeWebhook(data: WebhookSubscribeRequest): Promise<WebhookSubscribeResponse> {
    this.checkReadOnly('Subscribe Webhook', '/v1/webhooks/subscribe')
    return this.webhooks.subscribeWebhook(data)
  }

  async unsubscribeWebhook(data: WebhookUnsubscribeRequest): Promise<void> {
    this.checkReadOnly('Unsubscribe Webhook', '/v1/webhooks/unsubscribe')
    return this.webhooks.unsubscribeWebhook(data)
  }

  async deleteWebhook(id: string): Promise<void> {
    this.checkReadOnly('Delete Webhook', `/v1/webhooks/${id}`)
    return this.webhooks.deleteWebhook(id)
  }

  // Checkout/Checkin backward compatibility
  async checkinBooking(id: string, time?: string): Promise<{ success: boolean }> {
    this.checkReadOnly('Checkin Booking', `/v2/bookings/${id}/checkin`)
    return this.bookings.checkinBooking(id, time)
  }

  async checkoutBooking(id: string, time?: string): Promise<{ success: boolean }> {
    this.checkReadOnly('Checkout Booking', `/v2/bookings/${id}/checkout`)
    return this.bookings.checkoutBooking(id, time)
  }

  async getExternalBookings(id: string): Promise<Booking[]> {
    return this.bookings.getExternalBookings(id)
  }

  // V1 API backward compatibility methods
  async createBookingV1(booking: CreateBookingV1Request): Promise<BookingV1Response> {
    this.checkReadOnly('Create Booking V1', '/v1/bookings')
    return this.bookingsV1.createBookingV1(booking)
  }

  async updateBookingV1(
    id: string | number,
    updates: UpdateBookingV1Request,
  ): Promise<BookingV1Response> {
    this.checkReadOnly('Update Booking V1', `/v1/bookings/${id}`)
    return this.bookingsV1.updateBookingV1(id, updates)
  }

  async deleteBookingV1(id: string | number): Promise<DeleteBookingV1Response> {
    this.checkReadOnly('Delete Booking V1', `/v1/bookings/${id}`)
    return this.bookingsV1.deleteBookingV1(id)
  }

  async updateRatesV1(data: RateUpdateV1Request): Promise<RateUpdateV1Response> {
    this.checkReadOnly('Update Rates V1', '/v1/rates/savewithoutavailability')
    return this.ratesV1.updateRatesV1(data)
  }
}

// Export types for external use
export type {
  AvailabilityCalendarResult,
  // Availability
  AvailabilityQueryParams,
  // Bookings
  Booking,
  BookingPeriod,
  BookingSearchParams,
  BookingsListResponse,
  // V1 Bookings
  BookingV1Response,
  CreateBookingRequest,
  CreateBookingV1Request,
  // Rates
  DailyRatesParams,
  DailyRatesResponse,
  DateRangeAvailabilityResult,
  DeleteBookingV1Response,
  KeyCodesRequest,
  Message,
  // Messaging
  MessageThread,
  NextAvailabilityResult,
  Participant,
  PaymentLink,
  PaymentLinkRequest,
  PropertiesListResponse,
  // Properties
  Property,
  PropertySearchParams,
  QuoteParams,
  // Quotes
  QuoteRequest,
  QuoteResponse,
  RateSettingsResponse,
  // V1 Rates
  RateUpdateV1Request,
  RateUpdateV1Response,
  RoomType,
  UpdateBookingRequest,
  UpdateBookingV1Request,
  // Webhooks
  WebhookEvent,
  WebhookListResponse,
  WebhookSubscribeRequest,
  WebhookSubscribeResponse,
  WebhookUnsubscribeRequest,
}
