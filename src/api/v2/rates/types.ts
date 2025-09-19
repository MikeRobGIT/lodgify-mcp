/**
 * Rates API Types
 * Type definitions for rate-related operations
 */

// Rate Management Types (v1 API)
export interface RateUpdateRequest {
  property_id: number
  rates: Array<{
    room_type_id: number
    date_from: string
    date_to: string
    price: number
    min_stay?: number
    currency?: string
  }>
}

// Daily rates query parameters
export interface DailyRatesParams {
  RoomTypeId: string
  HouseId: string
  StartDate: string
  EndDate: string
  currency?: string
}

// Rate settings query parameters
export interface RateSettingsParams {
  houseId?: string
  currency?: string
}

// Rate creation request (for v2 API)
export interface CreateRateRequest {
  propertyId: string
  roomTypeId: string
  from: string
  to: string
  rate: number
  currency?: string
}

// Rate update request (for v2 API)
export interface UpdateRateRequest {
  from?: string
  to?: string
  rate?: number
  currency?: string
}

/**
 * Actual API response structure from Lodgify v2 Daily Rates endpoint
 * Based on API documentation: returns { calendar_items: array | null, rate_settings: object }
 */
export interface DailyRatesApiResponse {
  calendar_items: Array<{
    date: string
    rate: number
    min_stay?: number
    max_stay?: number
    available: boolean
  }> | null
  rate_settings: {
    currency?: string
    base_rate?: number
    seasonal_adjustments?: unknown[]
    modifiers?: unknown[]
  }
}
