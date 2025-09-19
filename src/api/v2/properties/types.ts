/**
 * Properties API Types
 * Type definitions for Lodgify Properties endpoints
 */

/**
 * Property status
 */
export type PropertyStatus = 'active' | 'inactive' | 'deleted'

/**
 * Property type
 */
export type PropertyType = 'house' | 'apartment' | 'villa' | 'room' | 'other'

/**
 * Room type
 */
export interface RoomType {
  id: number | string
  name: string
  description?: string
  maxOccupancy?: number
  beds?: number
  bathrooms?: number
  size?: number
  sizeUnit?: 'sqft' | 'sqm'
  price?: number
  currency?: string
  amenities?: string[]
  photos?: Array<{
    url: string
    caption?: string
  }>
}

/**
 * Property location
 */
export interface PropertyLocation {
  address?: string
  city?: string
  state?: string
  country?: string
  countryCode?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

/**
 * Property amenity
 */
export interface PropertyAmenity {
  id: string
  name: string
  category?: string
  icon?: string
}

/**
 * Property listing
 */
export interface Property {
  id: number | string
  name: string
  description?: string
  type?: PropertyType
  status?: PropertyStatus
  location?: PropertyLocation
  rooms?: number
  bedrooms?: number
  bathrooms?: number
  maxGuests?: number
  size?: number
  sizeUnit?: 'sqft' | 'sqm'
  currency?: string
  defaultPrice?: number
  checkInTime?: string
  checkOutTime?: string
  amenities?: PropertyAmenity[]
  photos?: Array<{
    url: string
    caption?: string
    isPrimary?: boolean
  }>
  roomTypes?: RoomType[]
  createdAt?: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

/**
 * Properties list response
 * The actual API returns { count, items } structure
 * We maintain 'data' for backward compatibility and transform in the client
 */
export interface PropertiesListResponse {
  data: Property[]
  count?: number
  pagination?: {
    limit: number
    offset: number
    total: number
  }
}

/**
 * Actual API response structure from Lodgify v2 Properties endpoint
 * Based on API documentation: returns { count: int32 | null, items: array | null }
 */
export interface PropertiesApiResponse {
  count: number | null
  items: Property[] | null
}

/**
 * Property search parameters
 */
export interface PropertySearchParams {
  limit?: number
  offset?: number
  status?: PropertyStatus | PropertyStatus[]
  type?: PropertyType | PropertyType[]
  city?: string
  country?: string
  minPrice?: number
  maxPrice?: number
  minGuests?: number
  amenities?: string[]
  sort?: 'name' | 'price' | 'created' | 'updated'
  order?: 'asc' | 'desc'
  // Additional Lodgify v2 API parameters
  wid?: number
  updatedSince?: string
  includeCount?: boolean
  includeInOut?: boolean
}

/**
 * Property availability info
 */
export interface PropertyAvailability {
  propertyId: string | number
  available: boolean
  nextAvailableDate?: string
  blockedDates?: Array<{
    from: string
    to: string
    reason?: string
  }>
}

/**
 * Find properties result
 */
export interface FindPropertiesResult {
  properties: Array<{
    id: string
    name: string
    source: 'properties' | 'bookings' | 'cache'
  }>
  message: string
  suggestions?: string[]
}
