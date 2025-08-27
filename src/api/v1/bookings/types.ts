/**
 * V1 Bookings API Types
 * Types specific to the v1 booking endpoints that are not available in v2
 */

/**
 * Guest name structure for API
 */
export interface GuestName {
  first_name: string | null
  last_name: string | null
  name?: string | null // deprecated
}

/**
 * Guest breakdown for room occupancy
 */
export interface GuestBreakdown {
  adults: number
  children?: number
  infants?: number
  pets?: number
  people?: number // deprecated
}

/**
 * Room booking details
 */
export interface Room {
  room_type_id: number
  guest_breakdown: GuestBreakdown
  key_code?: string | null
}

/**
 * Message structure for booking communication
 */
export interface BookingMessage {
  id?: string
  text?: string
  timestamp?: string
  type?: string
  sender?: string
}

/**
 * Guest information for booking
 */
export interface Guest {
  guest_name: GuestName
  external_id?: string | null
  email?: string | null
  phone?: string | null
  locale?: string | null
  street_address1?: string | null
  street_address2?: string | null
  city?: string | null
  country_code?: string | null
  postal_code?: string | null
  state?: string | null
}

/**
 * Actual API structure for creating bookings
 * POST /v1/reservation/booking
 */
export interface CreateBookingV1ApiRequest {
  property_id: number
  arrival: string // YYYY-MM-DD format
  departure: string // YYYY-MM-DD format
  guest: Guest
  rooms: Room[]
  status: 'Open' | 'Booked' | 'Declined' | 'Tentative'
  source_text?: string | null
  messages?: BookingMessage[] | null
  payment_type?: string | null
  payment_address?: string | null
  payment_website_id?: number | null
  bookability?: 'InstantBooking' | 'BookingRequest' | 'EnquiryOnly'
  ip_created?: string | null
  total?: number | null
  currency_code?: string | null
  origin?: string | null
  from?: number // for upgrading from enquiry
}

/**
 * V1 Booking Creation Request (simplified interface for MCP tool)
 * POST /v1/reservation/booking
 */
export interface CreateBookingV1Request {
  property_id: number
  room_type_id: number
  arrival: string // YYYY-MM-DD format
  departure: string // YYYY-MM-DD format
  guest_name: string
  guest_email?: string
  guest_phone?: string
  adults: number
  children?: number
  infants?: number
  status?: 'booked' | 'tentative' | 'declined' | 'confirmed'
  notes?: string
  source?: string
}

/**
 * V1 Booking Update Request
 * PUT /v1/reservations/bookings/{id}
 */
export interface UpdateBookingV1Request {
  property_id?: number
  room_type_id?: number
  arrival?: string // YYYY-MM-DD format
  departure?: string // YYYY-MM-DD format
  guest_name?: string
  guest_email?: string
  guest_phone?: string
  adults?: number
  children?: number
  infants?: number
  status?: 'booked' | 'tentative' | 'declined' | 'confirmed'
  notes?: string
  source?: string
}

/**
 * Actual API structure for updating bookings
 * PUT /v1/reservations/bookings/{id}
 */
export interface UpdateBookingV1ApiRequest {
  property_id?: number
  arrival?: string // YYYY-MM-DD format
  departure?: string // YYYY-MM-DD format
  guest?: Guest
  rooms?: Room[]
  status?: 'Open' | 'Booked' | 'Declined' | 'Tentative'
  source_text?: string | null
  messages?: BookingMessage[] | null
  payment_type?: string | null
  payment_address?: string | null
  payment_website_id?: number | null
  bookability?: 'InstantBooking' | 'BookingRequest' | 'EnquiryOnly'
  ip_created?: string | null
  total?: number | null
  currency_code?: string | null
  origin?: string | null
}

/**
 * V1 Booking Response
 * Response structure for v1 booking operations
 */
export interface BookingV1Response {
  id: number
  property_id: number
  room_type_id?: number
  arrival: string
  departure: string
  guest_name: string
  guest_email?: string
  guest_phone?: string
  adults: number
  children?: number
  infants?: number
  status: string
  notes?: string
  source?: string
  created_at?: string
  updated_at?: string
  amount?: number
  currency?: string
}

/**
 * V1 Delete Booking Response
 */
export interface DeleteBookingV1Response {
  success: boolean
  message?: string
  deleted_booking_id?: number
}
