/**
 * Bookings API Types
 * Type definitions for Lodgify Bookings/Reservations endpoints
 */

/**
 * Booking status
 */
export type BookingStatus = 'booked' | 'tentative' | 'open' | 'declined' | 'cancelled' | 'confirmed'

/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded'

/**
 * Guest information
 */
export interface Guest {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  countryCode?: string
  documentType?: string
  documentNumber?: string
}

/**
 * Guest breakdown
 */
export interface GuestBreakdown {
  adults: number
  children?: number
  infants?: number
  pets?: number
}

/**
 * Price breakdown
 */
export interface PriceBreakdown {
  basePrice: number
  cleaningFee?: number
  serviceFee?: number
  taxes?: number
  discount?: number
  total: number
  currency: string
}

/**
 * Booking details
 */
export interface Booking {
  id: string | number
  propertyId: string | number
  propertyName?: string
  roomTypeId?: string | number
  roomTypeName?: string
  status: BookingStatus
  checkIn: string // ISO date
  checkOut: string // ISO date
  nights?: number
  guest: Guest
  guestBreakdown: GuestBreakdown
  totalGuests?: number
  price?: number
  currency?: string
  priceBreakdown?: PriceBreakdown
  paymentStatus?: PaymentStatus
  paymentMethod?: string
  notes?: string
  source?: string
  channelReference?: string
  specialRequests?: string
  arrivalTime?: string
  departureTime?: string
  createdAt?: string
  updatedAt?: string
  cancelledAt?: string
  cancellationReason?: string
  metadata?: Record<string, unknown>
}

/**
 * Bookings list response
 * The actual API returns { count, items } structure
 * We maintain 'data' for backward compatibility and transform in the client
 */
export interface BookingsListResponse {
  data: Booking[]
  count?: number
  pagination?: {
    limit: number
    offset: number
    total: number
  }
}

/**
 * Actual API response structure from Lodgify v2 Bookings endpoint
 * Based on API documentation: returns { count: int32 | null, items: array | null }
 */
export interface BookingsApiResponse {
  count: number | null
  items: Booking[] | null
}

/**
 * Booking search parameters
 */
export interface BookingSearchParams {
  limit?: number
  offset?: number
  propertyId?: string | number
  status?: BookingStatus | BookingStatus[]
  checkInFrom?: string
  checkInTo?: string
  checkOutFrom?: string
  checkOutTo?: string
  guestName?: string
  guestEmail?: string
  paymentStatus?: PaymentStatus
  source?: string
  sort?: 'checkIn' | 'checkOut' | 'created' | 'updated' | 'guest'
  order?: 'asc' | 'desc'
  // Additional Lodgify v2 API parameters
  includeCount?: boolean
  stayFilter?: 'Upcoming' | 'Current' | 'Historic' | 'All' | 'ArrivalDate' | 'DepartureDate'
  stayFilterDate?: string
  updatedSince?: string
  includeTransactions?: boolean
  includeExternal?: boolean
  includeQuoteDetails?: boolean
  trash?: 'False' | 'True' | 'All'
}

/**
 * Create booking request
 */
export interface CreateBookingRequest {
  propertyId: string | number
  roomTypeId?: string | number
  checkIn: string
  checkOut: string
  guest: Guest
  guestBreakdown: GuestBreakdown
  status?: BookingStatus
  price?: number
  currency?: string
  notes?: string
  source?: string
  specialRequests?: string
  arrivalTime?: string
}

/**
 * Update booking request
 */
export interface UpdateBookingRequest {
  checkIn?: string
  checkOut?: string
  guest?: Partial<Guest>
  guestBreakdown?: Partial<GuestBreakdown>
  status?: BookingStatus
  notes?: string
  specialRequests?: string
  arrivalTime?: string
  departureTime?: string
}

/**
 * Payment link request
 */
export interface PaymentLinkRequest {
  amount: number
  currency: string
  description?: string
  expiresAt?: string
}

/**
 * Payment link response
 */
export interface PaymentLink {
  id: string
  url: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  expiresAt?: string
  createdAt: string
}

/**
 * Key codes update request
 */
export interface KeyCodesRequest {
  keyCodes: string[]
  instructions?: string
}

/**
 * Quote request for booking
 */
export interface QuoteRequest {
  propertyId: string | number
  roomTypes?: Array<{
    id: string | number
    quantity?: number
  }>
  checkIn: string
  checkOut: string
  guestBreakdown: GuestBreakdown
  promoCode?: string
}

/**
 * Quote response
 */
export interface QuoteResponse {
  propertyId: string | number
  checkIn: string
  checkOut: string
  nights: number
  priceBreakdown: PriceBreakdown
  availability: boolean
  minStay?: number
  maxStay?: number
}
