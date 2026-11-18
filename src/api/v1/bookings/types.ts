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
  // Override Lodgify's rate-plan calculated total. When provided, the booking's
  // total_amount is set to this value instead of being recalculated from rate plans.
  total?: number
  currency_code?: string
  // Without this, Lodgify defaults new bookings to EnquiryOnly. The dashboard
  // hides per-unit totals on enquiries even when total_amount is set, so any
  // sync workflow that wants the booking to render as a real reservation needs
  // to pass `InstantBooking` (or `BookingRequest`) explicitly.
  bookability?: 'InstantBooking' | 'BookingRequest' | 'EnquiryOnly'
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
  total?: number
  currency_code?: string
  bookability?: 'InstantBooking' | 'BookingRequest' | 'EnquiryOnly'
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
  /** Set when the follow-up status change failed and the booking is not in the requested status */
  statusUpdateError?: string
}

/**
 * V1 Delete Booking Response
 */
export interface DeleteBookingV1Response {
  success: boolean
  message?: string
  deleted_booking_id?: number
}

/**
 * Create Booking Quote Request (CreateQuoteDto)
 * POST /v1/reservation/booking/{bookingId}/quote
 *
 * Lodgify prices the quote from the property's rate plans. The API has no
 * field for a custom total, so callers cannot override the price here.
 * `room_types[].custom_fee_amount` adds a flat "Fee" line on top of the room rate.
 */
export interface CreateBookingQuoteRequest {
  /**
   * true  = attach the property's rate policy (payment schedule). Lodgify then
   *         moves the booking to Tentative and the quote stays NotSent, so
   *         payment links fail until the guest is sent the quote in the UI.
   * false = quote without a policy (status NotScheduled). The booking keeps its
   *         status and payment links work.
   */
  is_policy_active?: boolean
  /** Promotion code. Lodgify silently ignores unknown codes. */
  promotion_code?: string | null
  add_ons?: Array<{ add_on_id: number; units?: number | null }>
  room_types?: Array<{ room_type_id: number; custom_fee_amount?: number }>
}

/**
 * Create Booking Quote Response
 * Lodgify answers 201 with a bare int32, the new quote id.
 */
export type CreateBookingQuoteResponse = number

/**
 * Quote as returned by GET /v1/reservation/booking/{bookingId}/quote
 */
export interface BookingQuoteV1Response {
  id: number
  status: string
  arrival?: string
  departure?: string
  property_id?: number
  currency?: { code?: string }
  amount_gross: number
  amount_net?: number
  is_policy_active?: boolean
  rate_policy_name?: string | null
  room_type_items?: Array<{
    room_type_id: number
    subtotal: number
    prices?: Array<{ type: string; amount: number; description?: string }>
  }>
  [key: string]: unknown
}

/**
 * Result of attaching a quote and reading it back from Lodgify
 */
export interface AttachedQuoteResult {
  quoteId: number
  status: string
  policy: string | null
  isPolicyActive: boolean
  totalAmount: number
  currency?: string
  lines: Array<{ type: string; amount: number; description?: string }>
  bookingStatus?: string
}
