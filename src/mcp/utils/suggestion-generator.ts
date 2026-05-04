/**
 * Suggestion generation logic for Response Enhancer
 */

import type { ApiResponseData, EntityType, OperationType } from './response/types.js'

/**
 * Generate contextual suggestions based on entity and operation
 * Accepts either OperationType or any string for flexibility
 */
export function generateSuggestions(
  operationType: OperationType | string,
  entityType: EntityType | string,
  details: ApiResponseData,
): string[] {
  const suggestions: string[] = []

  // Handle null or undefined details
  const safeDetails = details || {}

  switch (entityType) {
    case 'booking':
      if (operationType === 'create') {
        suggestions.push(
          `Send confirmation email to ${safeDetails.guestEmail || 'guest'}`,
          'Create payment link for deposit or full payment',
          'Update property access codes for check-in',
          'Review and confirm room availability',
          'Add any special guest requirements or notes',
        )
      } else if (operationType === 'update') {
        suggestions.push(
          'Notify guest of booking changes',
          'Update payment amount if dates changed',
          'Verify room availability for new dates',
          'Review cancellation policy',
        )
      } else if (operationType === 'delete') {
        suggestions.push(
          'Send cancellation confirmation to guest',
          'Process any refunds if applicable',
          'Update property availability calendar',
          'Review cancellation reason for improvements',
        )
      } else if (operationType === 'list') {
        suggestions.push(
          'Review upcoming arrivals and departures',
          'Check payment status for pending bookings',
          'Use lodgify_get_booking to view full details for a specific booking',
          'Filter by date range or status for targeted results',
        )
      } else if (operationType === 'read') {
        const bookingStatus = String(safeDetails.status || '').toLowerCase()
        if (bookingStatus === 'cancelled' || bookingStatus === 'declined') {
          suggestions.push(
            'Process any refund if applicable',
            'Send cancellation confirmation to guest',
            'Update property availability calendar',
            'Review cancellation reason for improvements',
          )
        } else {
          suggestions.push(
            'View property details for this booking',
            'Check availability for date changes',
            'Create payment link if payment is pending',
            'Review guest communication thread',
          )
        }
      } else if (operationType === 'action') {
        suggestions.push(
          'Verify guest identity before check-in',
          'Provide property access codes to the guest',
          'Schedule cleaning after checkout',
          'Review property condition and report any issues',
        )
      }
      break

    case 'payment_link':
      if (operationType === 'create') {
        suggestions.push(
          'Send payment link to guest via email',
          'Set reminder for payment follow-up',
          'Monitor payment status',
          'Prepare receipt for completed payment',
        )
      } else {
        // read/get payment link - provide status-aware suggestions
        const linkStatus = String(safeDetails.status || '').toLowerCase()
        if (linkStatus === 'expired') {
          suggestions.push(
            'Generate a new payment link to replace the expired one',
            'Contact guest about the expired payment link',
            'Review booking payment history',
          )
        } else if (linkStatus === 'partial') {
          suggestions.push(
            'Send reminder for remaining balance payment',
            'Review payment history and deposits received',
            'Create new payment link for outstanding amount',
          )
        } else if (linkStatus === 'paid') {
          suggestions.push(
            'Payment is complete - prepare and send receipt to guest',
            'Verify payment has been processed correctly',
            'Update booking payment status if needed',
          )
        } else if (linkStatus === 'no_link' || !safeDetails.hasLink) {
          suggestions.push(
            'Create a new payment link for this booking',
            'Contact guest about payment arrangements',
            'Review booking balance before generating link',
          )
        } else {
          suggestions.push(
            'Send payment link to guest via email',
            'Set reminder for payment follow-up',
            'Monitor payment status',
            'Prepare receipt for completed payment',
          )
        }
      }
      break

    case 'quote':
      suggestions.push(
        'Review quote with guest',
        'Set expiration reminder',
        'Follow up if quote not accepted',
        'Prepare contract once accepted',
      )
      break

    case 'rate':
      suggestions.push(
        'Update property listings with new rates',
        'Notify existing bookings if affected',
        'Review competitor pricing',
        'Update seasonal rate strategies',
      )
      break

    case 'webhook':
      if (operationType === 'create') {
        suggestions.push(
          'Test webhook endpoint connectivity',
          'Configure webhook event handling',
          'Set up monitoring for webhook failures',
          'Document webhook integration',
        )
      }
      break

    case 'message':
      suggestions.push(
        'Monitor for guest reply',
        'Set follow-up reminder if needed',
        'Update booking notes with communication',
        'Escalate if urgent response required',
      )
      break

    case 'key_codes':
      suggestions.push(
        'Send access codes to guest before check-in',
        'Test access codes if possible',
        'Set reminder to reset codes after checkout',
        'Document backup entry method',
      )
      break

    case 'thread':
      suggestions.push(
        'Review conversation history for context',
        'Reply to guest message via Lodgify interface',
        'Update booking notes with communication details',
        'Follow up if guest response is pending',
      )
      break

    case 'property':
      suggestions.push(
        'Use lodgify_get_property to view full details for a specific property',
        'Use lodgify_get_property_availability to check detailed availability',
        'Check current rates with lodgify_daily_rates',
        'View bookings for this property with lodgify_list_bookings',
      )
      break

    case 'vacant_inventory': {
      // Check if any properties are available
      const availableCount = Number(safeDetails.availableProperties || safeDetails.vacantCount || 0)
      const checkedCount = Number(safeDetails.propertiesChecked || 0)
      const hasDiagnostics = safeDetails.hasDiagnostics === true

      if (availableCount > 0) {
        suggestions.push(
          `${availableCount} vacant ${availableCount === 1 ? 'property is' : 'properties are'} available for booking`,
          'Review individual property details for specific availability',
          'Consider pricing strategies for vacant properties',
          'Create special offers for last-minute bookings',
        )
        if (safeDetails.includesRoomDetails && safeDetails.availableRooms) {
          suggestions.push(
            `${safeDetails.availableRooms} individual rooms available across properties`,
            'Check room-specific amenities and capacities',
          )
        }
      } else if (checkedCount > 0) {
        suggestions.push(
          'No properties are vacant for the selected dates',
          'Try adjusting the date range for different availability',
          'Consider checking additional properties not in the current search',
          'Review booking patterns to optimize occupancy',
        )
      } else {
        suggestions.push(
          'Unable to retrieve property availability',
          'Verify API credentials and permissions',
          'Check if properties exist in the account',
          'Contact support if the issue persists',
        )
      }

      // Add diagnostic-specific suggestions
      if (hasDiagnostics) {
        const issuesIdentified = Number(safeDetails.issuesIdentified || 0)
        if (issuesIdentified > 0) {
          suggestions.push(
            `Review ${issuesIdentified} identified issues in diagnostics`,
            'Check API response format compatibility',
            'Verify property data structure matches expectations',
          )
        }
        if (safeDetails.apiCallsCount) {
          suggestions.push(
            `${safeDetails.apiCallsCount} API calls were made to gather availability data`,
          )
        }
      }

      // Add filter-specific suggestions
      if (safeDetails.filteredByPropertyIds) {
        suggestions.push(
          `Search was limited to ${safeDetails.filteredByPropertyIds} specific properties`,
        )
      }
      break
    }

    default:
      // Generic suggestions for unknown entity/operation combinations
      if (operationType === 'list' || operationType === 'read') {
        suggestions.push(
          'Review the returned data for relevant details',
          'Use related tools to perform follow-up actions',
        )
      }
      break
  }

  return suggestions
}
