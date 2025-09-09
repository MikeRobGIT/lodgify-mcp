/**
 * Availability API Types
 * Type definitions for availability-related operations
 */

// Availability and Booking Types
export interface BookingPeriod {
  arrival: string
  departure: string
  status: string
  isBlocked: boolean
}

export interface AvailabilityPeriod {
  start: string
  end: string
  available: boolean
  minStay?: number
  maxStay?: number
}

export interface AvailabilityQueryParams {
  from?: string
  to?: string
  propertyId?: string
  roomTypeId?: string
}

export interface PropertyAvailabilityUpdatePayload {
  available: boolean
  from: string
  to: string
  minStay?: number
  maxStay?: number
}

export interface PropertyAvailabilityResult {
  user_id: number
  property_id: number
  room_type_id: number
  periods: Array<{
    start: string
    end: string
    available: number
    closed_period: null
    bookings: Array<{
      id: number
      arrival: string
      departure: string
      status: string
      guest_name: string
    }>
    channel_calendars: unknown[]
  }>
}
