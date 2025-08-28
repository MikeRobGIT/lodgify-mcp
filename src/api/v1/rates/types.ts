/**
 * V1 Rates API Types
 * Types specific to the v1 rate endpoints
 */

/**
 * V1 Rate Update Request
 * POST /v1/rates/savewithoutavailability
 */
export interface RateUpdateV1Request {
  property_id: number
  rates: Array<{
    room_type_id: number
    start_date: string // YYYY-MM-DD format
    end_date: string // YYYY-MM-DD format
    price_per_day: number
    min_stay?: number
    currency?: string
  }>
}

/**
 * V1 Rate Update Response
 */
export interface RateUpdateV1Response {
  success: boolean
  message?: string
  updated_rates?: number
  property_id?: number
}

/**
 * V1 Rate Entry
 */
export interface RateV1Entry {
  room_type_id: number
  start_date: string
  end_date: string
  price_per_day: number
  min_stay?: number
  currency?: string
}
