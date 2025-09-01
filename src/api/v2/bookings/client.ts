/**
 * Bookings API Client Module
 * Handles all booking/reservation-related API operations
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  Booking,
  BookingSearchParams,
  BookingStatus,
  BookingsListResponse,
  CreateBookingRequest,
  KeyCodesRequest,
  PaymentLink,
  PaymentLinkRequest,
  QuoteRequest,
  QuoteResponse,
  UpdateBookingRequest,
} from './types.js'

/**
 * Bookings API Client
 * Manages reservations, payments, and booking operations
 */
export class BookingsClient extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'bookings',
      version: 'v2',
      basePath: 'reservations/bookings',
    }
    super(client, config)
  }

  /**
   * List bookings with optional filtering
   * GET /v2/reservations/bookings
   */
  async listBookings(params?: BookingSearchParams): Promise<BookingsListResponse> {
    const result = await this.list<Booking>('', params as Record<string, unknown>)

    // Ensure we return a proper BookingsListResponse
    if ('data' in result && Array.isArray(result.data)) {
      return result as BookingsListResponse
    }

    // Handle legacy array response
    if (Array.isArray(result)) {
      return {
        data: result,
        count: result.length,
      }
    }

    // Wrap single booking
    return {
      data: [result as Booking],
      count: 1,
    }
  }

  /**
   * Get detailed booking information
   * GET /v2/reservations/bookings/{id}
   */
  async getBooking(id: string): Promise<Booking> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    return this.get<Booking>('', id)
  }

  /**
   * Create a new booking
   * POST /v2/reservations/bookings
   */
  async createBooking(booking: CreateBookingRequest): Promise<Booking> {
    if (!booking.propertyId) {
      throw new Error('Property ID is required')
    }
    if (!booking.checkIn || !booking.checkOut) {
      throw new Error('Check-in and check-out dates are required')
    }
    if (!booking.guest?.name) {
      throw new Error('Guest name is required')
    }
    if (!booking.guestBreakdown?.adults) {
      throw new Error('At least one adult guest is required')
    }

    return this.create<Booking>('', booking)
  }

  /**
   * Update an existing booking
   * PUT /v2/reservations/bookings/{id}
   */
  async updateBooking(id: string, updates: UpdateBookingRequest): Promise<Booking> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    return this.update<Booking>('', id, updates)
  }

  /**
   * Delete/Cancel a booking
   * DELETE /v2/reservations/bookings/{id}
   */
  async deleteBooking(id: string): Promise<{ success: boolean; message?: string }> {
    if (!id) {
      throw new Error('Booking ID is required')
    }

    try {
      await this.delete('', id)
      return { success: true, message: `Booking ${id} has been cancelled` }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel booking',
      }
    }
  }

  /**
   * Get payment link for a booking
   * GET /v2/reservations/bookings/{id}/quote/paymentLink
   */
  async getBookingPaymentLink(id: string): Promise<PaymentLink> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    return this.request<PaymentLink>('GET', `${id}/quote/paymentLink`)
  }

  /**
   * Create payment link for a booking
   * POST /v2/reservations/bookings/{id}/quote/paymentLink
   */
  async createBookingPaymentLink(
    id: string,
    paymentRequest: PaymentLinkRequest,
  ): Promise<PaymentLink> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    if (!paymentRequest) {
      throw new Error('Payload is required')
    }
    if (!paymentRequest.amount || paymentRequest.amount <= 0) {
      throw new Error('Valid payment amount is required')
    }
    if (!paymentRequest.currency) {
      throw new Error('Currency is required')
    }

    return this.request<PaymentLink>('POST', `${id}/quote/paymentLink`, {
      body: paymentRequest as unknown as Record<string, unknown>,
    })
  }

  /**
   * Update key codes for a booking
   * PUT /v2/reservations/bookings/{id}/keyCodes
   */
  async updateKeyCodes(id: string, keyCodes: KeyCodesRequest): Promise<{ success: boolean }> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    if (!keyCodes.keyCodes || keyCodes.keyCodes.length === 0) {
      throw new Error('At least one key code is required')
    }

    return this.request<{ success: boolean }>('PUT', `${id}/keyCodes`, {
      body: keyCodes as unknown as Record<string, unknown>,
    })
  }

  /**
   * Get a quote for a booking
   * GET /v2/quote/{propertyId}
   */
  async getQuote(
    propertyId: string,
    quoteRequest: Omit<QuoteRequest, 'propertyId'>,
  ): Promise<QuoteResponse> {
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!quoteRequest.checkIn || !quoteRequest.checkOut) {
      throw new Error('Check-in and check-out dates are required')
    }
    if (!quoteRequest.guestBreakdown?.adults) {
      throw new Error('At least one adult guest is required')
    }

    // Build query parameters for the quote
    const params: Record<string, unknown> = {
      from: quoteRequest.checkIn,
      to: quoteRequest.checkOut,
      'guest_breakdown[adults]': quoteRequest.guestBreakdown.adults,
    }

    if (quoteRequest.guestBreakdown.children) {
      params['guest_breakdown[children]'] = quoteRequest.guestBreakdown.children
    }
    if (quoteRequest.guestBreakdown.infants) {
      params['guest_breakdown[infants]'] = quoteRequest.guestBreakdown.infants
    }

    if (quoteRequest.roomTypes) {
      quoteRequest.roomTypes.forEach((room, index) => {
        params[`roomTypes[${index}].Id`] = room.id
        if (room.quantity) {
          params[`roomTypes[${index}].Quantity`] = room.quantity
        }
      })
    }

    if (quoteRequest.promoCode) {
      params.promoCode = quoteRequest.promoCode
    }

    // Quote endpoint is outside the bookings path
    return this.client.request<QuoteResponse>('GET', `quote/${propertyId}`, {
      params,
      apiVersion: 'v2',
    })
  }

  /**
   * Search bookings by various criteria
   * Helper method that provides enhanced search functionality
   */
  async searchBookings(criteria: {
    guestName?: string
    guestEmail?: string
    propertyId?: string | number
    dateRange?: { from: string; to: string }
    status?: BookingStatus | BookingStatus[]
  }): Promise<BookingsListResponse> {
    const params: BookingSearchParams = {}

    if (criteria.guestName) {
      params.guestName = criteria.guestName
    }
    if (criteria.guestEmail) {
      params.guestEmail = criteria.guestEmail
    }
    if (criteria.propertyId) {
      params.propertyId = criteria.propertyId
    }
    if (criteria.dateRange) {
      params.checkInFrom = criteria.dateRange.from
      params.checkInTo = criteria.dateRange.to
    }
    if (criteria.status) {
      params.status = criteria.status
    }

    return this.listBookings(params)
  }

  /**
   * Get upcoming bookings
   * Helper method to get bookings starting from today
   */
  async getUpcomingBookings(
    propertyId?: string | number,
    limit = 10,
  ): Promise<BookingsListResponse> {
    const today = new Date().toISOString().split('T')[0]

    return this.listBookings({
      propertyId,
      checkInFrom: today,
      sort: 'checkIn',
      order: 'asc',
      limit,
      status: ['confirmed', 'booked'],
    })
  }

  /**
   * Get bookings for a date range
   */
  async getBookingsForDateRange(
    from: string,
    to: string,
    propertyId?: string | number,
  ): Promise<BookingsListResponse> {
    return this.listBookings({
      propertyId,
      checkInFrom: from,
      checkOutTo: to,
      sort: 'checkIn',
      order: 'asc',
    })
  }

  /**
   * Check in a booking
   * PUT /v2/reservations/bookings/{id}/checkin
   */
  async checkinBooking(id: string, time?: string): Promise<{ success: boolean }> {
    if (!id) {
      throw new Error('Booking ID is required')
    }

    const body = time ? { time } : {}

    return this.request<{ success: boolean }>('PUT', `${id}/checkin`, {
      body: body as unknown as Record<string, unknown>,
    })
  }

  /**
   * Check out a booking
   * PUT /v2/reservations/bookings/{id}/checkout
   */
  async checkoutBooking(id: string, time?: string): Promise<{ success: boolean }> {
    if (!id) {
      throw new Error('Booking ID is required')
    }

    const body = time ? { time } : {}

    return this.request<{ success: boolean }>('PUT', `${id}/checkout`, {
      body: body as unknown as Record<string, unknown>,
    })
  }

  /**
   * Get external bookings for a property
   * GET /v2/reservations/bookings/{id}/externalBookings
   */
  async getExternalBookings(id: string): Promise<Booking[]> {
    if (!id) {
      throw new Error('Property ID is required')
    }

    return this.request<Booking[]>('GET', `${id}/externalBookings`)
  }
}
