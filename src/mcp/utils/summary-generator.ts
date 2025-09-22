/**
 * Summary generation logic for Response Enhancer
 */

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import type {
  ApiResponseData,
  EntityType,
  OperationStatus,
  OperationType,
} from './response/types.js'

/**
 * Generate operation summary based on type and entity
 * Can be called with either:
 * 1. (data, contextType) for simple context-based summaries
 * 2. (operationType, entityType, details, status) for detailed operation summaries
 */
export function generateSummary(data: ApiResponseData, contextType: string): string
export function generateSummary(
  operationType: OperationType,
  entityType: EntityType,
  details?: ApiResponseData,
  status?: OperationStatus,
): string
export function generateSummary(
  dataOrOperationType: ApiResponseData | OperationType | string,
  contextTypeOrEntityType?: string | EntityType,
  details?: ApiResponseData,
  status?: OperationStatus,
): string {
  // Handle the two-argument form (data, contextType)
  if (typeof contextTypeOrEntityType === 'string' && !details && !status) {
    const data = dataOrOperationType as ApiResponseData
    const contextType = contextTypeOrEntityType

    // Generate context-specific summaries
    switch (contextType) {
      case 'property_list': {
        const dataObj = data as Record<string, unknown>
        // Check for data array (from PropertiesListResponse structure)
        if (dataObj.data && Array.isArray(dataObj.data)) {
          return `Retrieved ${dataObj.data.length} properties`
        }
        // Fallback for direct array
        if (Array.isArray(data)) {
          return `Retrieved ${data.length} properties`
        }
        // Fallback to check properties field (legacy)
        if (dataObj.properties && Array.isArray(dataObj.properties)) {
          return `Retrieved ${dataObj.properties.length} properties`
        }
        return `Retrieved 0 properties`
      }
      case 'room_list':
        return `Retrieved room types for property`
      case 'deleted_properties':
        return `Retrieved deleted properties`
      case 'availability':
        return `Availability check completed`
      case 'vacant_inventory': {
        const dataObj = data as Record<string, unknown>
        // Try to get the count from counts.availableProperties first
        if (dataObj.counts && typeof dataObj.counts === 'object') {
          const counts = dataObj.counts as Record<string, unknown>
          if (counts.availableProperties !== undefined) {
            return `Found ${counts.availableProperties} vacant ${counts.availableProperties === 1 ? 'property' : 'properties'}`
          }
        }
        // Fallback to counting available properties in the array
        if (dataObj.properties && Array.isArray(dataObj.properties)) {
          const availableCount = dataObj.properties.filter((p: unknown) => {
            const prop = p as Record<string, unknown>
            return prop.available === true
          }).length
          return `Found ${availableCount} vacant ${availableCount === 1 ? 'property' : 'properties'}`
        }
        return `Found 0 vacant properties`
      }
      case 'daily_rates':
        return `Retrieved daily rates`
      case 'rate_settings':
        return `Retrieved rate configuration`
      case 'quote':
        return `Quote calculated successfully`
      case 'rate_update':
        return `Rates updated successfully`
      case 'booking_quote':
        return `Booking quote created`
      case 'booking_list':
        return `Retrieved ${(data.bookings as unknown[] | undefined)?.length || (data.data as unknown[] | undefined)?.length || 0} bookings`
      case 'webhook_list':
        return `Retrieved ${(data.webhooks as unknown[] | undefined)?.length || 0} webhooks`
      case 'webhook_subscribe':
        return `Webhook subscription created`
      case 'webhook_unsubscribe':
        return `Webhook unsubscribed successfully`
      case 'thread':
        return `Retrieved messaging thread`
      default:
        return `Operation completed for ${contextType}`
    }
  }

  // Handle the four-argument form (original implementation)
  const operationType = dataOrOperationType as OperationType
  const entityType = contextTypeOrEntityType as EntityType
  const detailsData = details || {}

  // Explicitly handle undefined status - don't default to success
  if (status === undefined) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Operation status cannot be undefined for ${operationType} ${entityType}`,
      { operationType, entityType },
    )
  }
  const operationStatus = status

  const isFailed = operationStatus === 'failed'
  const statusText =
    operationStatus === 'success'
      ? 'Successfully'
      : operationStatus === 'partial'
        ? 'Partially'
        : 'Failed to'

  switch (operationType) {
    case 'create':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'create' : 'created'} booking ${detailsData.bookingId || 'new'} for ${detailsData.guest || 'guest'}`
        case 'payment_link':
          return `${statusText} ${isFailed ? 'create' : 'created'} payment link for ${detailsData.amount || 'payment'}`
        case 'quote': {
          // For quotes, prefer the bookingId from details (which comes from inputParams)
          const bookingId = detailsData.bookingId
          if (bookingId) {
            return `${statusText} ${isFailed ? 'create' : 'created'} quote for booking ${bookingId}`
          }
          return `${statusText} ${isFailed ? 'create' : 'created'} quote ${detailsData.quoteId || ''}`.trim()
        }
        case 'webhook':
          return `${statusText} ${isFailed ? 'subscribe to' : 'subscribed to'} ${detailsData.event || 'event'} webhook`
        case 'message':
          return `${statusText} ${isFailed ? 'send' : 'sent'} message to ${detailsData.recipient || 'recipient'}`
        default:
          return `${statusText} ${isFailed ? 'create' : 'created'} ${entityType}`
      }

    case 'update':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'update' : 'updated'} booking ${detailsData.bookingId || ''}`.trim()
        case 'rate':
          return `${statusText} ${isFailed ? 'update' : 'updated'} rates for ${detailsData.property || 'property'}`
        case 'key_codes':
          return `${statusText} ${isFailed ? 'update' : 'updated'} access codes for booking ${detailsData.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} ${isFailed ? 'mark' : 'marked'} thread as ${detailsData.action || 'updated'}`
        default:
          return `${statusText} ${isFailed ? 'update' : 'updated'} ${entityType}`
      }

    case 'delete':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'delete' : 'deleted'} booking ${detailsData.bookingId || ''}`.trim()
        case 'webhook':
          return `${statusText} ${isFailed ? 'unsubscribe from' : 'unsubscribed from'} webhook ${detailsData.webhookId || ''}`.trim()
        default:
          return `${statusText} ${isFailed ? 'delete' : 'deleted'} ${entityType}`
      }

    case 'action':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'perform' : 'performed'} ${detailsData.action || 'action on'} booking ${detailsData.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} ${isFailed ? 'perform' : 'performed'} ${detailsData.action || 'action on'} thread`
        default:
          return `${statusText} ${isFailed ? 'perform' : 'performed'} action on ${entityType}`
      }

    case 'read':
      switch (entityType) {
        case 'vacant_inventory': {
          const availableCount = detailsData.availableProperties || detailsData.vacantCount || 0
          const checkedCount = detailsData.propertiesChecked || 0
          const dateRange =
            detailsData.dateRange || `${detailsData.from || 'start'} to ${detailsData.to || 'end'}`

          if (isFailed) {
            return `Failed to retrieve vacant inventory for ${dateRange}`
          }
          if (checkedCount === 0) {
            return `No properties found to check for ${dateRange}`
          }
          if (availableCount === 0) {
            return `No vacant properties found for ${dateRange} (checked ${checkedCount} ${checkedCount === 1 ? 'property' : 'properties'})`
          }
          return `Found ${availableCount} vacant ${availableCount === 1 ? 'property' : 'properties'} for ${dateRange} (out of ${checkedCount} checked)`
        }
        default:
          return `${statusText} ${isFailed ? 'retrieve' : 'retrieved'} ${entityType}`
      }

    default:
      return `${statusText} ${isFailed ? 'process' : 'processed'} ${entityType}`
  }
}
