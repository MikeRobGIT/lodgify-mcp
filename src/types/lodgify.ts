/**
 * TypeScript type definitions for Lodgify API v2 responses
 * Based on official Lodgify API documentation
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ContactInfo {
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
}

export interface GuestBreakdown {
  adults: number
  children?: number
  infants?: number
  pets?: number
}

export interface AmountInfo {
  amount: number
  currency?: string
}

export interface DateRange {
  start: string
  end: string
}

// ============================================================================
// PROPERTY TYPES
// ============================================================================

export interface PropertyRoom {
  id: number
  name: string | null
}

export interface PropertyContact {
  name?: string | null
  email?: string | null
  phone?: string | null
}

export interface Property {
  id: number
  name: string | null
  internal_name?: string | null
  description?: string | null
  latitude: number
  longitude: number
  address?: string | null
  hide_address?: boolean
  zip?: string | null
  city?: string | null
  state?: string | null
  country_code?: string | null
  country?: string | null
  image_url?: string | null
  has_addons?: boolean
  has_agreement?: boolean
  agreement_text?: string | null
  agreement_url?: string | null
  contact?: PropertyContact
  rating?: number
  price_unit_in_days?: number
  min_price?: number
  original_min_price?: number
  max_price?: number
  original_max_price?: number
  rooms?: PropertyRoom[] | null
  currency_code?: string | null
  created_at?: string
  updated_at?: string
  is_active?: boolean
  subscription_plans?: string[] | null
  // Additional fields for in_out
  in_out_max_date?: string
  in_out?: Record<string, unknown>
}

export interface PropertiesListResponse {
  count?: number | null
  items?: Property[] | null
}

// ============================================================================
// BOOKING TYPES
// ============================================================================

export type BookingStatus = 'Open' | 'Tentative' | 'Booked' | 'Declined'

export type BookingSource =
  | 'Manual'
  | 'OH'
  | 'NineFlats'
  | 'Airbnb'
  | 'AirbnbIntegration'
  | 'HomeAway'
  | 'BookingCom'
  | 'Expedia'
  | 'ICal'
  | 'Email'
  | 'FacebookMessenger'
  | 'PublicApi'
  | 'Other'

export type TransactionType = 'Payment' | 'Refund' | 'Show' | 'Authorization' | 'Void' | 'Capture'

export type TransactionStatus =
  | 'Requested'
  | 'Processing'
  | 'Done'
  | 'Failed'
  | 'Canceled'
  | 'Abandoned'
  | 'Unknown'

export type PaymentType =
  | 'None'
  | 'PaypalWallet'
  | 'BankAccount'
  | 'StripeSpreedly'
  | 'Payyo'
  | 'AuthorizeNetSpreedly'
  | 'BraintreeSpreedly'
  | 'PayPalProSpreedly'
  | 'PciProxy'
  | 'SpreedlyTestSpreedly'
  | 'StripeSca'
  | 'LodgifyPaymentsStripe'

export interface BookingRoom {
  room_type_id: number
  guest_breakdown?: GuestBreakdown
}

export interface BookingGuest {
  name?: string | null
  email?: string | null
  phone?: string | null
  language?: string | null
}

export interface BookingSubtotals {
  accommodation?: AmountInfo
  addons?: AmountInfo
  taxes?: AmountInfo
  fees?: AmountInfo
  damage_protection?: AmountInfo
  discounts?: AmountInfo
}

export interface BookingTransaction {
  id: number
  type: TransactionType
  status: TransactionStatus
  payment_type: PaymentType
  description?: string | null
  amount?: AmountInfo
  processed_at?: string | null
}

export interface BookingCheckIn {
  checked_in_at?: string | null
  checked_in_by?: string | null
}

export interface BookingCheckOut {
  checked_out_at?: string | null
  checked_out_by?: string | null
}

export interface Booking {
  id: number
  user_id: number
  arrival: string
  departure: string
  property_id: number
  rooms?: BookingRoom[] | null
  guest_breakdown: GuestBreakdown
  people?: number // Deprecated
  key_code?: string | null
  guest?: BookingGuest
  language?: string | null
  status: BookingStatus
  is_unavailable?: boolean
  is_overbooked?: boolean
  tentative_expires_at?: string | null
  source?: BookingSource
  source_text?: string | null
  created_from_ip?: string | null
  created_at?: string
  updated_at?: string
  canceled_at?: string | null
  is_new?: boolean
  is_deleted?: boolean
  currency_code?: string | null
  total_amount?: AmountInfo
  subtotals?: BookingSubtotals
  amount_paid?: AmountInfo
  amount_due?: AmountInfo
  quote?: Record<string, unknown>
  transactions?: BookingTransaction[] | null
  damage_protection?: BookingTransaction[] | null
  notes?: string | null
  thread_uid?: string
  external_booking?: string | null
  check_in?: BookingCheckIn
  check_out?: BookingCheckOut
}

export interface BookingsListResponse {
  count?: number | null
  items?: Booking[] | null
}

// ============================================================================
// AVAILABILITY TYPES
// ============================================================================

export interface AvailabilityPeriod {
  start: string
  end: string
  available: number
  closed_period?: Record<string, unknown>
}

export interface AvailabilityBooking {
  id: number
  status?: string | null
}

export interface AvailabilityCalendar {
  id: number
}

export interface AvailabilityItem {
  user_id: number
  property_id: number
  room_type_id: number
  periods?: AvailabilityPeriod[] | null
  bookings?: AvailabilityBooking[] | null
  channel_calendars?: AvailabilityCalendar[] | null
}

// ============================================================================
// RATE TYPES
// ============================================================================

export interface RateItem {
  date: string
  rate: number
  currency?: string
}

export interface RateSettings {
  minStay?: number
  maxStay?: number
  checkInDays?: string[]
  checkOutDays?: string[]
}

export interface DailyRatesResponse {
  rates?: RateItem[] | null
}

// ============================================================================
// QUOTE TYPES
// ============================================================================

export interface QuoteItem {
  description: string
  amount: number
  quantity?: number
  type?: string
}

export interface QuoteResponse {
  property_id: number
  from: string
  to: string
  currency_code: string
  total_amount: AmountInfo
  items?: QuoteItem[] | null
  subtotals?: BookingSubtotals
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface Webhook {
  id: string
  event: string
  target_url: string
  created_at?: string
  updated_at?: string
}

export interface WebhookListResponse {
  items?: Webhook[] | null
}

// ============================================================================
// PAYMENT LINK TYPES
// ============================================================================

export interface PaymentLink {
  url: string
  amount?: number
  currency?: string
  expires_at?: string | null
  status?: string
}

// ============================================================================
// THREAD/MESSAGING TYPES
// ============================================================================

export interface ThreadMessage {
  id: string
  sender: string
  content: string
  sent_at: string
}

export interface Thread {
  guid: string
  property_id?: number
  booking_id?: number
  messages?: ThreadMessage[] | null
  created_at?: string
  updated_at?: string
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface LodgifyError {
  status?: number
  message?: string
  error?: string
  detail?: unknown
  path?: string
}
