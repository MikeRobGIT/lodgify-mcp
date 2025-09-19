/**
 * Suggestion generation logic for Response Enhancer
 */

import type { ApiResponseData, EntityType, OperationType } from './response/types.js'

/**
 * Generate contextual suggestions based on entity and operation
 */
export function generateSuggestions(
  operationType: OperationType,
  entityType: EntityType,
  details: ApiResponseData,
): string[] {
  const suggestions: string[] = []

  switch (entityType) {
    case 'booking':
      if (operationType === 'create') {
        suggestions.push(
          `Send confirmation email to ${details.guestEmail || 'guest'}`,
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
      }
      break

    case 'payment_link':
      suggestions.push(
        'Send payment link to guest via email',
        'Set reminder for payment follow-up',
        'Monitor payment status',
        'Prepare receipt for completed payment',
      )
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

    case 'vacant_inventory': {
      // Check if any properties are available
      const availableCount = Number(details.availableProperties || details.vacantCount || 0)
      const checkedCount = Number(details.propertiesChecked || 0)
      const hasDiagnostics = details.hasDiagnostics === true

      if (availableCount > 0) {
        suggestions.push(
          `${availableCount} vacant ${availableCount === 1 ? 'property is' : 'properties are'} available for booking`,
          'Review individual property details for specific availability',
          'Consider pricing strategies for vacant properties',
          'Create special offers for last-minute bookings',
        )
        if (details.includesRoomDetails && details.availableRooms) {
          suggestions.push(
            `${details.availableRooms} individual rooms available across properties`,
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
        const issuesIdentified = Number(details.issuesIdentified || 0)
        if (issuesIdentified > 0) {
          suggestions.push(
            `Review ${issuesIdentified} identified issues in diagnostics`,
            'Check API response format compatibility',
            'Verify property data structure matches expectations',
          )
        }
        if (details.apiCallsCount) {
          suggestions.push(
            `${details.apiCallsCount} API calls were made to gather availability data`,
          )
        }
      }

      // Add filter-specific suggestions
      if (details.filteredByPropertyIds) {
        suggestions.push(
          `Search was limited to ${details.filteredByPropertyIds} specific properties`,
        )
      }
      break
    }
  }

  return suggestions
}
