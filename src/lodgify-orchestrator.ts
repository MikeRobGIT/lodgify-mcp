/**
 * Lodgify API Orchestrator
 * Coordinates all API modules and provides a unified interface
 * Replaces the monolithic lodgify.ts client
 */

import { ApiClientOrchestrator } from './api/client-orchestrator.js'
import { BookingsV1Client } from './api/v1/bookings/index.js'
import type {
  BookingV1Response,
  CreateBookingQuoteRequest,
  CreateBookingQuoteResponse,
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
import type { AvailabilityQueryParams, BookingPeriod } from './api/v2/availability/types.js'
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
import { PAGINATION } from './core/config/constants.js'
import { ReadOnlyModeError } from './core/errors/read-only-error.js'
import { safeLogger } from './logger.js'

// Aggregated vacant inventory types
export interface VacantInventoryParams {
  from: string
  to: string
  propertyIds?: Array<string | number>
  includeRooms?: boolean
  limit?: number
  wid?: number
  timeoutSeconds?: number
}

export interface VacantInventoryRoomResult {
  id: string
  name?: string
  maxOccupancy?: number
  available: boolean
}

export interface VacantInventoryPropertyResult {
  id: string
  name?: string
  available: boolean
  rooms?: VacantInventoryRoomResult[]
}

export interface VacantInventoryDiagnostic {
  endpoint: string
  responseStructure: string
  itemsFound: number
  error?: string
}

export interface VacantInventoryDiagnostics {
  apiCalls: VacantInventoryDiagnostic[]
  possibleIssues: string[]
  debugInfo?: {
    rawResponse?: unknown
    extractionAttempts: string[]
  }
}

export interface VacantInventoryResult {
  from: string
  to: string
  counts: {
    propertiesRequested: number
    propertiesFound: number
    propertiesChecked: number
    availableProperties: number
  }
  properties: VacantInventoryPropertyResult[]
  diagnostics?: VacantInventoryDiagnostics
}

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

    // Debug logging for read-only mode (always log this critical config)
    safeLogger.info('[LodgifyOrchestrator] Read-only mode configuration', {
      readOnlyProvided: config.readOnly !== undefined,
      readOnlyValue: config.readOnly,
      readOnlyFinal: this.readOnly,
    })

    // Additional debug logging when HTTP debug is enabled
    if (config.debugHttp) {
      safeLogger.debug('[LodgifyOrchestrator] Full config received', {
        hasApiKey: !!config.apiKey,
        readOnly: config.readOnly,
        debugHttp: config.debugHttp,
        baseUrl: config.baseUrl,
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

  /**
   * Create a quote for an existing booking
   * POST /v1/reservation/booking/{id}/quote
   *
   * This endpoint creates a new quote for an existing booking,
   * allowing custom pricing adjustments, discounts, and fees.
   * Note: This is a v1 API endpoint.
   */
  async createBookingQuote(
    bookingId: string,
    payload: CreateBookingQuoteRequest,
  ): Promise<CreateBookingQuoteResponse> {
    this.checkReadOnly('Create Booking Quote', `/v1/reservation/booking/${bookingId}/quote`)
    return this.bookingsV1.createBookingQuote(bookingId, payload)
  }

  // Availability backward compatibility
  async getPropertyAvailability(
    propertyId: string,
    params?: AvailabilityQueryParams,
  ): Promise<unknown> {
    return this.availability.getAvailabilityForProperty(propertyId, params)
  }

  /**
   * Aggregate: Find vacant inventory (properties and optionally rooms) for a date range
   * Note: This performs multiple reads (list properties, availability per property, rooms optional).
   * It determines vacancy by checking if any bookings overlap the range in the availability details.
   */
  async findVacantInventory(params: VacantInventoryParams): Promise<VacantInventoryResult> {
    const {
      from,
      to,
      propertyIds,
      includeRooms = true,
      limit = PAGINATION.DEFAULT_VACANT_INVENTORY_LIMIT,
      wid,
      timeoutSeconds = 180, // Default 3 minutes
    } = params

    // Set up timeout for the entire operation
    const timeoutMs = timeoutSeconds * 1000
    const startTime = Date.now()

    const checkTimeout = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > timeoutMs) {
        throw new Error(`Operation timeout after ${timeoutSeconds} seconds`)
      }
    }

    // Helper: exclusive-end overlap between [aStart, aEnd) and [bStart, bEnd)
    const toDateOnly = (s: string) => (s.includes('T') ? s.split('T')[0] : s)
    const toExclusiveMs = (dateStr: string) => {
      const d = new Date(`${toDateOnly(dateStr)}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      return d.getTime()
    }
    const startMs = (dateStr: string) => new Date(`${toDateOnly(dateStr)}T00:00:00Z`).getTime()
    const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
      const as = startMs(aStart)
      const ae = toExclusiveMs(aEnd)
      const bs = startMs(bStart)
      const be = toExclusiveMs(bEnd)
      return as < be && bs < ae
    }

    // Initialize diagnostics
    const diagnostics: VacantInventoryDiagnostics = {
      apiCalls: [],
      possibleIssues: [],
      debugInfo: {
        extractionAttempts: [],
      },
    }

    // Resolve properties to check
    let propertiesToCheck: Property[] = []
    if (propertyIds && propertyIds.length > 0) {
      // Fetch properties individually
      const fetched: Property[] = []
      for (const pid of propertyIds.slice(0, limit)) {
        try {
          checkTimeout()
          const p = await this.properties.getProperty(String(pid))
          if (p) fetched.push(p)
        } catch (e) {
          safeLogger.warn('Skipping property due to fetch error', {
            id: pid,
            error: (e as Error)?.message,
          })
        }
      }
      propertiesToCheck = fetched
    } else {
      try {
        checkTimeout()
        const list = await this.properties.listProperties({ limit, ...(wid ? { wid } : {}) })

        // Track API call
        diagnostics.apiCalls.push({
          endpoint: 'listProperties',
          responseStructure: 'pending',
          itemsFound: 0,
        })

        // Handle nested response structure from Lodgify API
        if (list.data && Array.isArray(list.data) && list.data.length > 0) {
          const firstItem = list.data[0] as unknown as Record<string, unknown>

          // Check if properties are nested in data[0].items
          if (
            firstItem &&
            typeof firstItem === 'object' &&
            'items' in firstItem &&
            Array.isArray(firstItem.items)
          ) {
            propertiesToCheck = firstItem.items as Property[]
            diagnostics.apiCalls[diagnostics.apiCalls.length - 1].responseStructure =
              'nested_data_items'
            diagnostics.apiCalls[diagnostics.apiCalls.length - 1].itemsFound =
              propertiesToCheck.length
            diagnostics.debugInfo?.extractionAttempts.push(
              `Successfully extracted ${propertiesToCheck.length} properties from data[0].items`,
            )
            safeLogger.debug('Properties extracted from nested structure', {
              count: propertiesToCheck.length,
            })
          }
          // Check if properties are directly in data array
          else if (
            list.data.every((item: unknown) => item && typeof item === 'object' && 'id' in item)
          ) {
            propertiesToCheck = list.data as Property[]
            diagnostics.apiCalls[diagnostics.apiCalls.length - 1].responseStructure =
              'direct_data_array'
            diagnostics.apiCalls[diagnostics.apiCalls.length - 1].itemsFound =
              propertiesToCheck.length
            diagnostics.debugInfo?.extractionAttempts.push(
              `Successfully extracted ${propertiesToCheck.length} properties from data array`,
            )
            safeLogger.debug('Properties extracted from direct array', {
              count: propertiesToCheck.length,
            })
          } else {
            diagnostics.apiCalls[diagnostics.apiCalls.length - 1].responseStructure = 'unexpected'
            diagnostics.debugInfo?.extractionAttempts.push(
              'Could not extract properties from data array - unexpected structure',
            )
          }
        } else {
          diagnostics.apiCalls[diagnostics.apiCalls.length - 1].responseStructure =
            'empty_or_invalid'
          diagnostics.debugInfo?.extractionAttempts.push(
            'No data array found or data array is empty',
          )
        }

        // If we still don't have properties, try using findProperties as fallback
        if (!propertiesToCheck.length) {
          safeLogger.warn('No properties found in list response, trying findProperties fallback')
          diagnostics.debugInfo?.extractionAttempts.push(
            'No properties found in listProperties response, attempting findProperties fallback',
          )

          try {
            checkTimeout()
            const foundProps = await this.properties.findProperties(undefined, false, limit)
            diagnostics.apiCalls.push({
              endpoint: 'findProperties (fallback)',
              responseStructure: foundProps.properties.length > 0 ? 'success' : 'empty',
              itemsFound: foundProps.properties.length,
            })

            propertiesToCheck = []
            // Convert found properties to Property objects
            for (const prop of foundProps.properties.slice(0, limit)) {
              try {
                checkTimeout()
                const fullProp = await this.properties.getProperty(prop.id)
                if (fullProp) propertiesToCheck.push(fullProp)
              } catch (e) {
                diagnostics.debugInfo?.extractionAttempts.push(
                  `Failed to fetch property ${prop.id}: ${(e as Error)?.message}`,
                )
                safeLogger.warn('Could not fetch property details', {
                  id: prop.id,
                  error: (e as Error)?.message,
                })
              }
            }
          } catch (fallbackError) {
            diagnostics.apiCalls.push({
              endpoint: 'findProperties (fallback)',
              responseStructure: 'error',
              itemsFound: 0,
              error: (fallbackError as Error)?.message,
            })
          }
        }
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Unknown error'
        diagnostics.apiCalls.push({
          endpoint: 'listProperties',
          responseStructure: 'error',
          itemsFound: 0,
          error: errorMessage,
        })
        diagnostics.possibleIssues.push(
          'Failed to list properties - check API key and permissions',
          errorMessage.includes('401') ? 'Authentication failed - invalid API key' : '',
          errorMessage.includes('403') ? 'Access denied - check API key permissions' : '',
        )
        safeLogger.error('Failed to list properties', {
          error: errorMessage,
        })
        propertiesToCheck = []
      }
    }

    const results: VacantInventoryPropertyResult[] = []
    let availableCount = 0

    // If no properties to check, return early with empty results and diagnostics
    if (!propertiesToCheck.length) {
      // Add possible issues if we couldn't find any properties
      if (diagnostics.possibleIssues.length === 0) {
        diagnostics.possibleIssues.push(
          'No properties found in the account',
          'API key may not have proper permissions',
          wid
            ? 'Website ID filter may be too restrictive'
            : 'Try specifying a website ID if properties are associated with specific websites',
        )
      }

      // Filter out empty strings from possibleIssues
      diagnostics.possibleIssues = diagnostics.possibleIssues.filter((issue) => issue.length > 0)

      safeLogger.warn('No properties found to check availability', {
        from,
        to,
        limit,
        wid,
        hadPropertyIds: !!propertyIds && propertyIds.length > 0,
      })

      return {
        from,
        to,
        counts: {
          propertiesRequested: propertyIds?.length || limit,
          propertiesFound: 0,
          propertiesChecked: 0,
          availableProperties: 0,
        },
        properties: [],
        diagnostics,
      }
    }

    for (const prop of propertiesToCheck) {
      const propertyId = String(prop.id)

      try {
        // Fetch availability with details for the given range
        checkTimeout()
        const availabilityResponse = await this.availability.getAvailabilityForProperty(
          propertyId,
          {
            from,
            to,
          },
        )

        // Track availability API call
        diagnostics.apiCalls.push({
          endpoint: `getAvailabilityForProperty(${propertyId})`,
          responseStructure: Array.isArray(availabilityResponse) ? 'array' : 'object',
          itemsFound: Array.isArray(availabilityResponse) ? availabilityResponse.length : 1,
        })

        // Handle both array and object response formats
        let availability: {
          periods?: Array<{
            start: string
            end: string
            available?: number | boolean
            bookings?: Array<{ arrival: string; departure: string }>
          }>
        }

        if (Array.isArray(availabilityResponse)) {
          // If response is an array, take the first element
          availability = availabilityResponse.length > 0 ? availabilityResponse[0] : { periods: [] }
        } else if (availabilityResponse && typeof availabilityResponse === 'object') {
          // If response is already an object, use it directly
          availability = availabilityResponse as typeof availability
        } else {
          // Fallback for unexpected response formats
          availability = { periods: [] }
        }

        // Determine if any booking overlaps the requested range
        const periods = availability?.periods ?? []
        let hasOverlapBooking = false
        let anyUnavailableFlag = false
        for (const pr of periods) {
          if (typeof pr.available !== 'undefined') {
            // Treat 0/false as unavailable for this period block
            const availBool = typeof pr.available === 'number' ? pr.available > 0 : !!pr.available
            if (!availBool && overlaps(pr.start, pr.end, from, to)) {
              anyUnavailableFlag = true
            }
          }
          if (Array.isArray(pr.bookings)) {
            for (const b of pr.bookings) {
              // Handle flexible booking date fields from different API versions
              const booking = b as {
                arrival?: string
                checkIn?: string
                start?: string
                from?: string
                departure?: string
                checkOut?: string
                end?: string
                to?: string
              }
              const bStart = booking.arrival || booking.checkIn || booking.start || booking.from
              const bEnd = booking.departure || booking.checkOut || booking.end || booking.to
              if (bStart && bEnd && overlaps(bStart, bEnd, from, to)) {
                hasOverlapBooking = true
                break
              }
            }
          }
          if (hasOverlapBooking) break
        }

        // Fallback check via bookings endpoint ONLY when no period data is available
        const hasPeriodData = periods.length > 0
        if (!hasPeriodData && !hasOverlapBooking && !anyUnavailableFlag) {
          try {
            const overlapBookings = await this.bookings.listBookings({
              propertyId,
              status: ['booked', 'confirmed'],
              checkInTo: to,
              checkOutFrom: from,
              limit: PAGINATION.DEFAULT_VACANT_INVENTORY_LIMIT,
            })
            if (overlapBookings?.data && overlapBookings.data.length > 0) {
              for (const b of overlapBookings.data) {
                if (b.checkIn && b.checkOut && overlaps(b.checkIn, b.checkOut, from, to)) {
                  hasOverlapBooking = true
                  break
                }
              }
            }
          } catch (e) {
            safeLogger.debug('Fallback booking overlap check failed', {
              id: propertyId,
              error: (e as Error)?.message,
            })
          }
        }

        const propertyAvailable = !hasOverlapBooking && !anyUnavailableFlag

        // Track property availability result
        if (!propertyAvailable) {
          diagnostics.debugInfo?.extractionAttempts.push(
            `Property ${propertyId} unavailable: hasOverlapBooking=${hasOverlapBooking}, anyUnavailableFlag=${anyUnavailableFlag}`,
          )
        }

        const entry: VacantInventoryPropertyResult = {
          id: propertyId,
          name: prop.name,
          available: false, // compute from rooms below when includeRooms=true; otherwise use propertyAvailable
        }

        if (includeRooms) {
          checkTimeout()
          const rooms = await this.properties.listPropertyRooms(propertyId)
          const roomResults: VacantInventoryRoomResult[] = []
          let anyRoomAvailable = false

          // If the property is unavailable at the property level, all rooms are unavailable
          if (!propertyAvailable) {
            for (const r of rooms) {
              // Handle room data that could be just an ID or a full object
              const room =
                typeof r === 'object'
                  ? (r as { id?: string | number; name?: string; maxOccupancy?: number })
                  : { id: r }
              const roomId = String(room.id ?? r)
              roomResults.push({
                id: roomId,
                name: room.name,
                maxOccupancy: room.maxOccupancy,
                available: false,
              })
            }
            entry.rooms = roomResults
            entry.available = false
          } else {
            // Property is available at the property level, check individual rooms in parallel
            // Check timeout before processing rooms
            checkTimeout()

            // Process all rooms in parallel for better performance
            const roomCheckPromises = rooms.map(async (r) => {
              // Handle room data that could be just an ID or a full object
              const room =
                typeof r === 'object'
                  ? (r as { id?: string | number; name?: string; maxOccupancy?: number })
                  : { id: r }
              const roomId = String(room.id ?? r)

              try {
                // Fetch per-room availability to avoid over-reporting
                const roomAvailability = (await this.availability.getAvailabilityForRoom(
                  propertyId,
                  roomId,
                  {
                    from,
                    to,
                  },
                )) as unknown as {
                  periods?: Array<{
                    start: string
                    end: string
                    available?: number | boolean
                    bookings?: Array<{
                      arrival?: string
                      departure?: string
                      checkIn?: string
                      checkOut?: string
                    }>
                  }>
                }

                // Track room availability API call
                diagnostics.apiCalls.push({
                  endpoint: `getAvailabilityForRoom(${propertyId}/${roomId})`,
                  responseStructure: 'room_availability',
                  itemsFound: 1,
                })

                const rPeriods = roomAvailability?.periods ?? []
                let roomUnavailable = false
                for (const pr of rPeriods) {
                  // If any overlapped period is explicitly unavailable, mark room unavailable
                  if (typeof pr.available !== 'undefined') {
                    const availBool =
                      typeof pr.available === 'number' ? pr.available > 0 : !!pr.available
                    if (!availBool && overlaps(pr.start, pr.end, from, to)) {
                      roomUnavailable = true
                      break
                    }
                  }
                  if (Array.isArray(pr.bookings)) {
                    for (const b of pr.bookings) {
                      // Handle flexible booking date fields from different API versions
                      const booking = b as {
                        arrival?: string
                        checkIn?: string
                        departure?: string
                        checkOut?: string
                      }
                      const bStart = booking.arrival || booking.checkIn
                      const bEnd = booking.departure || booking.checkOut
                      if (bStart && bEnd && overlaps(bStart, bEnd, from, to)) {
                        roomUnavailable = true
                        break
                      }
                    }
                  }
                  if (roomUnavailable) break
                }

                const roomAvailable = !roomUnavailable
                return {
                  id: roomId,
                  name: room.name,
                  maxOccupancy: room.maxOccupancy,
                  available: roomAvailable,
                }
              } catch (error) {
                // Log error but return room as unavailable to avoid breaking the entire check
                safeLogger.warn('Failed to check room availability', {
                  propertyId,
                  roomId,
                  error: (error as Error)?.message,
                })
                return {
                  id: roomId,
                  name: room.name,
                  maxOccupancy: room.maxOccupancy,
                  available: false,
                }
              }
            })

            // Wait for all room checks to complete in parallel with timeout enforcement
            const roomsChecked = await Promise.race([
              Promise.all(roomCheckPromises),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Operation timeout after ${timeoutSeconds} seconds`)),
                  Math.max(0, timeoutMs - (Date.now() - startTime)),
                ),
              ),
            ])
            roomResults.push(...roomsChecked)
            anyRoomAvailable = roomsChecked.some((r) => r.available)

            entry.rooms = roomResults
            entry.available = anyRoomAvailable
          }
        } else {
          entry.available = propertyAvailable
        }

        if (entry.available) availableCount++
        results.push(entry)
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Unknown error'
        safeLogger.warn('Failed to check availability for property', {
          propertyId,
          error: errorMessage,
        })

        // Track error in diagnostics
        diagnostics.apiCalls.push({
          endpoint: `getAvailabilityForProperty(${propertyId})`,
          responseStructure: 'error',
          itemsFound: 0,
          error: errorMessage,
        })
        diagnostics.debugInfo?.extractionAttempts.push(
          `Failed to check availability for property ${propertyId}: ${errorMessage}`,
        )

        // Skip this property and continue with others
      }
    }

    // Add final summary to diagnostics
    if (availableCount === 0 && propertiesToCheck.length > 0) {
      diagnostics.possibleIssues.push(
        `All ${propertiesToCheck.length} properties are unavailable for the requested dates`,
        'Consider checking different date ranges or more properties',
        'Some properties may have minimum stay requirements not met by the date range',
      )
    } else if (availableCount > 0) {
      diagnostics.debugInfo?.extractionAttempts.push(
        `Successfully found ${availableCount} available properties out of ${propertiesToCheck.length} checked`,
      )
    }

    // Filter out empty strings from possibleIssues
    diagnostics.possibleIssues = diagnostics.possibleIssues.filter((issue) => issue.length > 0)

    return {
      from,
      to,
      counts: {
        propertiesRequested: propertyIds?.length || limit,
        propertiesFound: propertiesToCheck.length,
        propertiesChecked: propertiesToCheck.length,
        availableProperties: availableCount,
      },
      properties: results,
      diagnostics,
    }
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
  // Messaging - Only GET thread endpoint exists and works in v2
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
  DeleteBookingV1Response,
  KeyCodesRequest,
  Message,
  // Messaging
  MessageThread,
  Participant,
  PaymentLink,
  PaymentLinkRequest,
  PropertiesListResponse,
  // Properties
  Property,
  PropertySearchParams,
  CreateBookingQuoteRequest,
  CreateBookingQuoteResponse,
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
