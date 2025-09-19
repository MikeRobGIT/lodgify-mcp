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
export type OperationType = 'create' | 'update' | 'delete' | 'action' | 'read'

/**
 * Entity types in the Lodgify system
 */
export type EntityType =
  | 'booking'
  | 'payment_link'
  | 'quote'
  | 'rate'
  | 'webhook'
  | 'message'
  | 'thread'
  | 'key_codes'

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
}
