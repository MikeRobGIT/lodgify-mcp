/**
 * V1 Bookings API Client Module
 * Handles v1 booking operations that are not available in v2
 */

import { safeLogger } from '../../../logger.js'
import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  BookingV1Response,
  CreateBookingQuoteRequest,
  CreateBookingQuoteResponse,
  CreateBookingV1ApiRequest,
  CreateBookingV1Request,
  DeleteBookingV1Response,
  Guest,
  GuestBreakdown,
  GuestName,
  Room,
  UpdateBookingV1ApiRequest,
  UpdateBookingV1Request,
} from './types.js'

/**
 * V1 Bookings API Client
 * Provides access to v1-only booking operations like create, update, and delete
 * These endpoints are not available in the v2 API
 */
export class BookingsV1Client extends BaseApiModule {
  constructor(client: BaseApiClient) {
    const config: ModuleConfig = {
      name: 'bookings-v1',
      version: 'v1',
      basePath: 'reservation/booking',
    }
    super(client, config)
  }

  /**
   * Create a new booking (v1 API)
   * POST /v1/reservation/booking
   */
  async createBookingV1(booking: CreateBookingV1Request): Promise<BookingV1Response> {
    if (!booking.property_id) {
      throw new Error('Property ID is required')
    }
    if (!booking.arrival || !booking.departure) {
      throw new Error('Arrival and departure dates are required')
    }
    if (!booking.guest_name) {
      throw new Error('Guest name is required')
    }
    if (!booking.adults || booking.adults < 1) {
      throw new Error('At least one adult guest is required')
    }
    if (!booking.room_type_id) {
      throw new Error('Room type ID is required')
    }

    // Validate date format (basic check for YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(booking.arrival) || !datePattern.test(booking.departure)) {
      throw new Error('Dates must be in YYYY-MM-DD format')
    }

    // Transform flat structure to API's nested structure
    const apiRequest = this.transformToApiRequest(booking)

    const result = await this.request<BookingV1Response | string>('POST', '', {
      body: apiRequest,
    })

    // Lodgify v1 API returns just the booking ID as a plain integer on success
    // Check if the response is a simple number (either as number or string)
    if (typeof result === 'number' || (typeof result === 'string' && /^\d+$/.test(result))) {
      const bookingId = typeof result === 'number' ? result : parseInt(result, 10)

      safeLogger.info('Booking created successfully', {
        bookingId,
        property_id: booking.property_id,
        arrival: booking.arrival,
        departure: booking.departure,
        guest_name: booking.guest_name,
      })

      // Return a proper booking response with the ID
      return {
        id: bookingId,
        property_id: booking.property_id,
        arrival: booking.arrival,
        departure: booking.departure,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone,
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        status: booking.status || 'booked',
        source: booking.source,
        room_type_id: booking.room_type_id,
      }
    }

    // If result is an empty object, the booking may have failed
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
      safeLogger.error('Booking creation failed - API returned empty response', {
        property_id: booking.property_id,
        arrival: booking.arrival,
        departure: booking.departure,
        guest_name: booking.guest_name,
      })

      throw new Error(
        'Booking creation failed. The API returned an empty response. ' +
          'Please check the property availability, dates, and ensure all required fields are valid.',
      )
    }

    // If we got a full booking object, return it
    return result as BookingV1Response
  }

  /**
   * Transform flat booking request to nested API structure
   */
  private transformToApiRequest(booking: CreateBookingV1Request): CreateBookingV1ApiRequest {
    // Split guest name into first/last (simple approach)
    const nameParts = booking.guest_name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const guestName: GuestName = {
      first_name: firstName,
      last_name: lastName,
    }

    const guest: Guest = {
      guest_name: guestName,
      email: booking.guest_email || null,
      phone: booking.guest_phone || null,
    }

    const guestBreakdown: GuestBreakdown = {
      adults: booking.adults,
      children: booking.children || 0,
      infants: booking.infants || 0,
    }

    const room: Room = {
      room_type_id: booking.room_type_id || 0, // Default to 0 if not specified
      guest_breakdown: guestBreakdown,
    }

    // Map lowercase status to capitalized API values
    const statusMap: Record<string, 'Open' | 'Booked' | 'Declined' | 'Tentative'> = {
      booked: 'Booked',
      tentative: 'Tentative',
      declined: 'Declined',
      confirmed: 'Booked', // Map confirmed to Booked
    }

    const apiRequest: CreateBookingV1ApiRequest = {
      property_id: booking.property_id,
      arrival: booking.arrival,
      departure: booking.departure,
      guest: guest,
      rooms: [room],
      status: statusMap[booking.status || 'booked'] || 'Booked',
      source_text: booking.source || null,
    }

    return apiRequest
  }

  /**
   * Transform flat booking update request to nested API structure
   */
  private transformToUpdateApiRequest(updates: UpdateBookingV1Request): UpdateBookingV1ApiRequest {
    const apiRequest: UpdateBookingV1ApiRequest = {}

    // Copy over simple fields that don't need transformation
    if (updates.property_id !== undefined) apiRequest.property_id = updates.property_id
    if (updates.arrival !== undefined) apiRequest.arrival = updates.arrival
    if (updates.departure !== undefined) apiRequest.departure = updates.departure

    // Handle guest information if any guest-related field is provided
    if (updates.guest_name || updates.guest_email || updates.guest_phone) {
      let guestName: GuestName | undefined

      if (updates.guest_name) {
        // Split guest name into first/last (simple approach)
        const nameParts = updates.guest_name.trim().split(' ')
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        guestName = {
          first_name: firstName,
          last_name: lastName,
        }
      }

      const guest: Guest = {
        guest_name: guestName || { first_name: null, last_name: null },
        email: updates.guest_email || null,
        phone: updates.guest_phone || null,
      }

      apiRequest.guest = guest
    }

    // Handle room information; avoid defaults that can unintentionally alter state
    // Only include rooms when we have both adults and room_type_id available
    if (
      updates.adults !== undefined ||
      updates.room_type_id !== undefined ||
      updates.children !== undefined ||
      updates.infants !== undefined
    ) {
      if (updates.adults !== undefined && updates.room_type_id !== undefined) {
        const guestBreakdown: GuestBreakdown = {
          adults: updates.adults,
        }
        if (updates.children !== undefined) guestBreakdown.children = updates.children
        if (updates.infants !== undefined) guestBreakdown.infants = updates.infants

        const room: Room = {
          room_type_id: updates.room_type_id,
          guest_breakdown: guestBreakdown,
        }

        apiRequest.rooms = [room]
      }
      // If either adults or room_type_id is missing, skip rooms payload for safety
    }

    // Handle status mapping
    if (updates.status) {
      const statusMap: Record<string, 'Open' | 'Booked' | 'Declined' | 'Tentative'> = {
        booked: 'Booked',
        tentative: 'Tentative',
        declined: 'Declined',
        confirmed: 'Booked', // Map confirmed to Booked
      }

      apiRequest.status = statusMap[updates.status] || 'Booked'
    }

    // Handle source
    if (updates.source !== undefined) {
      apiRequest.source_text = updates.source || null
    }

    return apiRequest
  }

  /**
   * Update an existing booking (v1 API)
   * PUT /v1/reservation/booking/{id}
   */
  async updateBookingV1(
    id: string | number,
    updates: UpdateBookingV1Request,
  ): Promise<BookingV1Response> {
    if (!id) {
      throw new Error('Booking ID is required')
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('Update data is required')
    }

    // Validate date formats if provided (treat empty string as invalid)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (updates.arrival !== undefined && (!updates.arrival || !datePattern.test(updates.arrival))) {
      throw new Error('Arrival date must be in YYYY-MM-DD format')
    }
    if (
      updates.departure !== undefined &&
      (!updates.departure || !datePattern.test(updates.departure))
    ) {
      throw new Error('Departure date must be in YYYY-MM-DD format')
    }

    // Validate adults count if provided
    if (updates.adults !== undefined && updates.adults < 1) {
      throw new Error('At least one adult guest is required')
    }

    // Fetch current booking data; v1 updates typically require a complete structure
    let currentBooking: BookingV1Response | null = null
    try {
      currentBooking = await this.getBookingV1(id)
    } catch (error) {
      safeLogger.warn('Could not fetch current booking data for update', {
        bookingId: id,
        error: error instanceof Error ? error.message : String(error),
      })
      // Continue with partial update if fetch fails
    }

    // Build a complete update payload by merging current values with updates
    const mergedUpdates = { ...updates }

    if (currentBooking) {
      // Ensure both arrival and departure are present
      if (mergedUpdates.arrival === undefined) {
        mergedUpdates.arrival = currentBooking.arrival
      }
      if (mergedUpdates.departure === undefined) {
        mergedUpdates.departure = currentBooking.departure
      }

      // Property
      if (mergedUpdates.property_id === undefined) {
        mergedUpdates.property_id = currentBooking.property_id
      }

      // Room and occupancy
      if (mergedUpdates.room_type_id === undefined && currentBooking.room_type_id !== undefined) {
        mergedUpdates.room_type_id = currentBooking.room_type_id
      }
      if (mergedUpdates.adults === undefined && currentBooking.adults !== undefined) {
        mergedUpdates.adults = currentBooking.adults
      }
      if (mergedUpdates.children === undefined && currentBooking.children !== undefined) {
        mergedUpdates.children = currentBooking.children
      }
      if (mergedUpdates.infants === undefined && currentBooking.infants !== undefined) {
        mergedUpdates.infants = currentBooking.infants
      }

      // Guest info
      if (mergedUpdates.guest_name === undefined && currentBooking.guest_name) {
        mergedUpdates.guest_name = currentBooking.guest_name
      }
      if (mergedUpdates.guest_email === undefined && currentBooking.guest_email !== undefined) {
        mergedUpdates.guest_email = currentBooking.guest_email
      }
      if (mergedUpdates.guest_phone === undefined && currentBooking.guest_phone !== undefined) {
        mergedUpdates.guest_phone = currentBooking.guest_phone
      }
      // Intentionally do not copy status/source to avoid unintended changes
    }

    // Transform flat structure to API's nested structure
    const apiRequest = this.transformToUpdateApiRequest(mergedUpdates)

    // For update operations, use the singular path structure
    const updatePath = `reservation/booking/${id}`
    const result = await this.client.request<BookingV1Response>('PUT', updatePath, {
      apiVersion: 'v1',
      body: apiRequest,
    })

    // If the API returns an empty response (which it often does for successful updates),
    // fetch the updated booking to return complete data
    if (!result || (typeof result === 'object' && Object.keys(result).length === 0)) {
      try {
        return await this.getBookingV1(id)
      } catch (error) {
        safeLogger.warn(`Could not fetch updated booking after update: ${error}`)
        // Return the empty result if fetch fails
        return result
      }
    }

    return result
  }

  /**
   * Delete a booking (v1 API)
   * DELETE /v1/reservation/booking/{id}
   */
  async deleteBookingV1(id: string | number): Promise<DeleteBookingV1Response> {
    if (!id) {
      throw new Error('Booking ID is required')
    }

    // For delete operations, use the singular path structure
    const deletePath = `reservation/booking/${id}`
    const result = await this.client.request<DeleteBookingV1Response>('DELETE', deletePath, {
      apiVersion: 'v1',
    })

    // Result logged internally by client
    return result
  }

  /**
   * Check if a booking exists (helper method)
   * GET /v1/reservations/bookings/{id}
   */
  async bookingExistsV1(id: string | number): Promise<boolean> {
    if (!id) {
      return false
    }

    try {
      // For get operations, we need to use the singular path structure
      const getPath = `reservation/booking/${id}`
      await this.client.request<BookingV1Response>('GET', getPath, {
        apiVersion: 'v1',
      })
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * Get booking details (v1 API)
   * GET /v1/reservation/booking/{id}
   */
  async getBookingV1(id: string | number): Promise<BookingV1Response> {
    if (!id) {
      throw new Error('Booking ID is required')
    }

    // For get operations, use the singular path structure
    const getPath = `reservation/booking/${id}`
    return this.client.request<BookingV1Response>('GET', getPath, {
      apiVersion: 'v1',
    })
  }

  /**
   * Create a quote for an existing booking (v1 API)
   * POST /v1/reservation/booking/{bookingId}/quote
   *
   * This endpoint creates a new quote for an existing booking,
   * allowing custom pricing adjustments, discounts, and fees.
   */
  async createBookingQuote(
    bookingId: string,
    payload: CreateBookingQuoteRequest,
  ): Promise<CreateBookingQuoteResponse> {
    if (!bookingId) {
      throw new Error('Booking ID is required')
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('Valid quote creation payload is required')
    }

    // Use the specific path for creating a booking quote
    const quotePath = `reservation/booking/${bookingId}/quote`
    return this.client.request<CreateBookingQuoteResponse>('POST', quotePath, {
      apiVersion: 'v1',
      body: payload,
    })
  }
}
