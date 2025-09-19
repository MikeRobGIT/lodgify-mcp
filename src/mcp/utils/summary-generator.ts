/**
 * Summary generation logic for Response Enhancer
 */

import type {
  ApiResponseData,
  EntityType,
  OperationStatus,
  OperationType,
} from './response/types.js'

/**
 * Generate operation summary based on type and entity
+ * @param operationType - The type of operation performed
+ * @param entityType - The type of entity being operated on
+ * @param details - Additional data about the operation
+ * @param status - The status of the operation (defaults to 'success')
+ * @returns A human-readable summary of the operation
 */
export function generateSummary(
  operationType: OperationType,
  entityType: EntityType,
  details: ApiResponseData,
  status: OperationStatus = 'success',
): string {
  const isFailed = status === 'failed'
  const statusText =
    status === 'success' ? 'Successfully' : status === 'partial' ? 'Partially' : 'Failed to'

  switch (operationType) {
    case 'create':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'create' : 'created'} booking ${details.bookingId || 'new'} for ${details.guest || 'guest'}`
        case 'payment_link':
          return `${statusText} ${isFailed ? 'create' : 'created'} payment link for ${details.amount || 'payment'}`
        case 'quote': {
          // For quotes, prefer the bookingId from details (which comes from inputParams)
          const bookingId = details.bookingId
          if (bookingId) {
            return `${statusText} ${isFailed ? 'create' : 'created'} quote for booking ${bookingId}`
          }
          return `${statusText} ${isFailed ? 'create' : 'created'} quote ${details.quoteId || ''}`.trim()
        }
        case 'webhook':
          return `${statusText} ${isFailed ? 'subscribe to' : 'subscribed to'} ${details.event || 'event'} webhook`
        case 'message':
          return `${statusText} ${isFailed ? 'send' : 'sent'} message to ${details.recipient || 'recipient'}`
        default:
          return `${statusText} ${isFailed ? 'create' : 'created'} ${entityType}`
      }

    case 'update':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'update' : 'updated'} booking ${details.bookingId || ''}`.trim()
        case 'rate':
          return `${statusText} ${isFailed ? 'update' : 'updated'} rates for ${details.property || 'property'}`
        case 'key_codes':
          return `${statusText} ${isFailed ? 'update' : 'updated'} access codes for booking ${details.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} ${isFailed ? 'mark' : 'marked'} thread as ${details.action || 'updated'}`
        default:
          return `${statusText} ${isFailed ? 'update' : 'updated'} ${entityType}`
      }

    case 'delete':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'delete' : 'deleted'} booking ${details.bookingId || ''}`.trim()
        case 'webhook':
          return `${statusText} ${isFailed ? 'unsubscribe from' : 'unsubscribed from'} webhook ${details.webhookId || ''}`.trim()
        default:
          return `${statusText} ${isFailed ? 'delete' : 'deleted'} ${entityType}`
      }

    case 'action':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${isFailed ? 'perform' : 'performed'} ${details.action || 'action on'} booking ${details.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} ${isFailed ? 'perform' : 'performed'} ${details.action || 'action on'} thread`
        default:
          return `${statusText} ${isFailed ? 'perform' : 'performed'} action on ${entityType}`
      }

    default:
      return `${statusText} ${isFailed ? 'process' : 'processed'} ${entityType}`
  }
}
