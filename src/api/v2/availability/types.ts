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

export interface NextAvailabilityResult {
  nextAvailableDate: string | null
  availableUntil: string | null
  blockedPeriods: BookingPeriod[]
  totalDaysAvailable: number
  message: string
}

export interface AvailabilityCalendarResult {
  calendar: Array<{
    date: string
    isAvailable: boolean
    bookingStatus?: string
    isToday: boolean
  }>
  summary: {
    totalDays: number
    availableDays: number
    blockedDays: number
    availabilityRate: number
  }
}

export interface DateRangeAvailabilityResult {
  isAvailable: boolean
  conflictingBookings: BookingPeriod[]
  message: string
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
