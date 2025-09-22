/**
 * Type definitions for Response Enhancer system
 */

/**
 * Generic type for API response data
 */
export type ApiResponseData = Record<string, unknown>

/**
 * Branded type for ISO 8601 formatted timestamp strings
 * Ensures type safety for timestamp fields that must be in ISO 8601 format
 */
export type ISO8601String = string & { readonly __brand: 'ISO8601' }

/**
 * Operation types for API interactions
 */
export type OperationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'action'
  | 'read'
  | 'list'
  | 'get'
  | 'check'
  | 'subscribe'
  | 'unsubscribe'
  | 'list_deleted'
  | 'calculate'

/**
 * Entity types in the Lodgify system
 */
export type EntityType =
  | 'booking'
  | 'payment_link'
  | 'quote'
  | 'rate'
  | 'daily_rates'
  | 'rate_settings'
  | 'webhook'
  | 'message'
  | 'thread'
  | 'key_codes'
  | 'vacant_inventory'
  | 'property'
  | 'room'
  | 'availability'
  | 'booking_checkin'
  | 'booking_checkout'
  | 'external_booking'

/**
 * Status of the operation
 */
export type OperationStatus = 'success' | 'partial' | 'failed'

/**
 * Enhanced response structure
 */
export interface EnhancedResponse {
  operation: {
    type: OperationType
    entity: EntityType
    status: OperationStatus
    /**
     * Timestamp when the operation was performed, must be an ISO 8601 formatted timestamp
     * (e.g., YYYY-MM-DDTHH:mm:ss.sssZ, UTC) for consistency across the system
     */
    timestamp: ISO8601String
  }
  summary: string
  details: ApiResponseData
  suggestions?: string[]
  warnings?: string[]
  data: ApiResponseData // Original API response
}

/**
 * Options for enhancing a response
 */
export interface EnhanceOptions {
  operationType: OperationType
  entityType: EntityType
  status?: OperationStatus
  inputParams?: ApiResponseData
  customSuggestions?: string[]
  customWarnings?: string[]
  customSummary?: string
}

/**
 * Flexible builder options for enhanced response creation
 */
export interface FlexibleBuilderOptions {
  entityType: EntityType
  operation?: OperationType
  status?: OperationStatus
  inputParams?: ApiResponseData
  extractedInfo?: ApiResponseData
  metadata?: {
    summary?: string
    suggestions?: string[]
    warnings?: string[]
  }
}
