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
  const statusText =
    status === 'success' ? 'Successfully' : status === 'partial' ? 'Partially' : 'Failed to'

  switch (operationType) {
    case 'create':
      switch (entityType) {
        case 'booking':
          return `${statusText} created booking ${details.bookingId || 'new'} for ${details.guest || 'guest'}`
        case 'payment_link':
          return `${statusText} created payment link for ${details.amount || 'payment'}`
        case 'quote': {
          // For quotes, prefer the bookingId from details (which comes from inputParams)
          const bookingId = details.bookingId
          if (bookingId) {
            return `${statusText} created quote for booking ${bookingId}`
          }
          return `${statusText} created quote ${details.quoteId || ''}`.trim()
        }
        case 'webhook':
          return `${statusText} subscribed to ${details.event || 'event'} webhook`
        case 'message':
          return `${statusText} sent message to ${details.recipient || 'recipient'}`
        default:
          return `${statusText} created ${entityType}`
      }

    case 'update':
      switch (entityType) {
        case 'booking':
          return `${statusText} updated booking ${details.bookingId || ''}`.trim()
        case 'rate':
          return `${statusText} updated rates for ${details.property || 'property'}`
        case 'key_codes':
          return `${statusText} updated access codes for booking ${details.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} marked thread as ${details.action || 'updated'}`
        default:
          return `${statusText} updated ${entityType}`
      }

    case 'delete':
      switch (entityType) {
        case 'booking':
          return `${statusText} deleted booking ${details.bookingId || ''}`.trim()
        case 'webhook':
          return `${statusText} unsubscribed from webhook ${details.webhookId || ''}`.trim()
        default:
          return `${statusText} deleted ${entityType}`
      }

    case 'action':
      switch (entityType) {
        case 'booking':
          return `${statusText} ${details.action || 'performed action on'} booking ${details.bookingId || ''}`.trim()
        case 'thread':
          return `${statusText} ${details.action || 'performed action on'} thread`
        default:
          return `${statusText} performed action on ${entityType}`
      }

    default:
      return `${statusText} processed ${entityType}`
  }
}
