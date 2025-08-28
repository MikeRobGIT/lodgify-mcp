/**
 * V1 Bookings API Client Module
 * Handles v1 booking operations that are not available in v2
 */

import type { BaseApiClient } from '../../base-client.js'
import { BaseApiModule, type ModuleConfig } from '../../base-module.js'
import type {
  BookingV1Response,
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

    return this.request<BookingV1Response>('POST', '', {
      body: apiRequest,
    })
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

    // Handle room information if any room-related field is provided
    if (
      updates.room_type_id !== undefined ||
      updates.adults !== undefined ||
      updates.children !== undefined ||
      updates.infants !== undefined
    ) {
      const guestBreakdown: GuestBreakdown = {
        adults: updates.adults || 1, // Default to 1 if not specified
        children: updates.children || 0,
        infants: updates.infants || 0,
      }

      const room: Room = {
        room_type_id: updates.room_type_id || 0, // Default to 0 if not specified
        guest_breakdown: guestBreakdown,
      }

      apiRequest.rooms = [room]
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

    // Validate date formats if provided
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (updates.arrival && !datePattern.test(updates.arrival)) {
      throw new Error('Arrival date must be in YYYY-MM-DD format')
    }
    if (updates.departure && !datePattern.test(updates.departure)) {
      throw new Error('Departure date must be in YYYY-MM-DD format')
    }

    // Validate adults count if provided
    if (updates.adults !== undefined && updates.adults < 1) {
      throw new Error('At least one adult guest is required')
    }

    // Transform flat structure to API's nested structure
    const apiRequest = this.transformToUpdateApiRequest(updates)

    // For update operations, use the singular path structure
    const updatePath = `reservation/booking/${id}`
    return this.client.request<BookingV1Response>('PUT', updatePath, {
      apiVersion: 'v1',
      body: apiRequest,
    })
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
}
