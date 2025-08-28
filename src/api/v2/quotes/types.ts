/**
 * Quotes API Types
 * Type definitions for quote-related operations
 */

// Quote request parameters
export interface QuoteParams {
  // Date parameters
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD

  // Guest breakdown (using bracket notation in actual requests)
  'guest_breakdown[adults]'?: number
  'guest_breakdown[children]'?: number
  'guest_breakdown[infants]'?: number

  // Room types (using bracket notation in actual requests)
  'roomTypes[0].Id'?: string | number
  'roomTypes[0].quantity'?: number

  // Additional parameters
  currency?: string
  includeExtras?: boolean
  includeBreakdown?: boolean

  // Support for additional room types
  [key: string]: unknown
}

// Simplified interface for easier use
export interface QuoteRequest {
  from: string
  to: string
  guestBreakdown: {
    adults: number
    children?: number
    infants?: number
  }
  roomTypes: Array<{
    Id: string | number
    quantity?: number
  }>
  currency?: string
  includeExtras?: boolean
  includeBreakdown?: boolean
}

// Quote response structure (can vary based on Lodgify API response)
export interface QuoteResponse {
  total?: number
  subtotal?: number
  currency?: string
  breakdown?: {
    accommodation?: number
    taxes?: number
    fees?: number
    extras?: number
  }
  nights?: number
  roomTypes?: Array<{
    id: string | number
    name?: string
    quantity: number
    pricePerNight?: number
    totalPrice?: number
  }>
  // Additional fields based on actual API response
  [key: string]: unknown
}
