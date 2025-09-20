import { describe, expect, it } from 'bun:test'
import { generateSuggestions } from '../../../src/mcp/utils/suggestion-generator.js'

describe('SuggestionGenerator', () => {
  describe('Booking entity suggestions', () => {
    it('should generate suggestions for booking creation', () => {
      const suggestions = generateSuggestions('create', 'booking', {
        guestEmail: 'test@example.com',
      })

      expect(suggestions).toContain('Send confirmation email to test@example.com')
      expect(suggestions).toContain('Create payment link for deposit or full payment')
      expect(suggestions).toContain('Update property access codes for check-in')
      expect(suggestions).toContain('Review and confirm room availability')
      expect(suggestions).toContain('Add any special guest requirements or notes')
      expect(suggestions.length).toBe(5)
    })

    it('should use guest fallback when email not provided', () => {
      const suggestions = generateSuggestions('create', 'booking', {})

      expect(suggestions[0]).toBe('Send confirmation email to guest')
    })

    it('should generate suggestions for booking update', () => {
      const suggestions = generateSuggestions('update', 'booking', {
        bookingId: 'BK001',
      })

      expect(suggestions).toContain('Notify guest of booking changes')
      expect(suggestions).toContain('Update payment amount if dates changed')
      expect(suggestions).toContain('Verify room availability for new dates')
      expect(suggestions).toContain('Review cancellation policy')
      expect(suggestions.length).toBe(4)
    })

    it('should generate suggestions for booking deletion', () => {
      const suggestions = generateSuggestions('delete', 'booking', {
        bookingId: 'BK001',
      })

      expect(suggestions).toContain('Send cancellation confirmation to guest')
      expect(suggestions).toContain('Process any refunds if applicable')
      expect(suggestions).toContain('Update property availability calendar')
      expect(suggestions).toContain('Review cancellation reason for improvements')
      expect(suggestions.length).toBe(4)
    })

    it('should return empty array for unhandled booking operations', () => {
      const suggestions = generateSuggestions('read', 'booking', {})
      expect(suggestions.length).toBe(0)
    })
  })

  describe('Payment link entity suggestions', () => {
    it('should generate payment link suggestions', () => {
      const suggestions = generateSuggestions('create', 'payment_link', {})

      expect(suggestions).toContain('Send payment link to guest via email')
      expect(suggestions).toContain('Set reminder for payment follow-up')
      expect(suggestions).toContain('Monitor payment status')
      expect(suggestions).toContain('Prepare receipt for completed payment')
      expect(suggestions.length).toBe(4)
    })

    it('should generate same suggestions for any payment link operation', () => {
      const createSuggestions = generateSuggestions('create', 'payment_link', {})
      const readSuggestions = generateSuggestions('read', 'payment_link', {})

      expect(createSuggestions).toEqual(readSuggestions)
    })
  })

  describe('Quote entity suggestions', () => {
    it('should generate quote suggestions', () => {
      const suggestions = generateSuggestions('create', 'quote', {})

      expect(suggestions).toContain('Review quote with guest')
      expect(suggestions).toContain('Set expiration reminder')
      expect(suggestions).toContain('Follow up if quote not accepted')
      expect(suggestions).toContain('Prepare contract once accepted')
      expect(suggestions.length).toBe(4)
    })
  })

  describe('Rate entity suggestions', () => {
    it('should generate rate suggestions', () => {
      const suggestions = generateSuggestions('update', 'rate', {})

      expect(suggestions).toContain('Update property listings with new rates')
      expect(suggestions).toContain('Notify existing bookings if affected')
      expect(suggestions).toContain('Review competitor pricing')
      expect(suggestions).toContain('Update seasonal rate strategies')
      expect(suggestions.length).toBe(4)
    })
  })

  describe('Webhook entity suggestions', () => {
    it('should generate webhook creation suggestions', () => {
      const suggestions = generateSuggestions('create', 'webhook', {})

      expect(suggestions).toContain('Test webhook endpoint connectivity')
      expect(suggestions).toContain('Configure webhook event handling')
      expect(suggestions).toContain('Set up monitoring for webhook failures')
      expect(suggestions).toContain('Document webhook integration')
      expect(suggestions.length).toBe(4)
    })

    it('should return empty array for non-create webhook operations', () => {
      const suggestions = generateSuggestions('update', 'webhook', {})
      expect(suggestions.length).toBe(0)
    })
  })

  describe('Message entity suggestions', () => {
    it('should generate message suggestions', () => {
      const suggestions = generateSuggestions('create', 'message', {})

      expect(suggestions).toContain('Monitor for guest reply')
      expect(suggestions).toContain('Set follow-up reminder if needed')
      expect(suggestions).toContain('Update booking notes with communication')
      expect(suggestions).toContain('Escalate if urgent response required')
      expect(suggestions.length).toBe(4)
    })
  })

  describe('Key codes entity suggestions', () => {
    it('should generate key codes suggestions', () => {
      const suggestions = generateSuggestions('update', 'key_codes', {})

      expect(suggestions).toContain('Send access codes to guest before check-in')
      expect(suggestions).toContain('Test access codes if possible')
      expect(suggestions).toContain('Set reminder to reset codes after checkout')
      expect(suggestions).toContain('Document backup entry method')
      expect(suggestions.length).toBe(4)
    })
  })

  describe('Vacant inventory entity suggestions', () => {
    it('should generate suggestions for vacant properties', () => {
      const suggestions = generateSuggestions('list', 'vacant_inventory', {
        vacantCount: 5,
        from: '2024-03-15',
        to: '2024-03-22',
      })

      expect(suggestions).toContain('5 vacant properties are available for booking')
      expect(suggestions).toContain('Review individual property details for specific availability')
      expect(suggestions).toContain('Consider pricing strategies for vacant properties')
      expect(suggestions).toContain('Create special offers for last-minute bookings')
      expect(suggestions.length).toBe(4)
    })

    it('should generate alternative suggestions when no properties available', () => {
      const suggestions = generateSuggestions('list', 'vacant_inventory', {
        vacantCount: 0,
      })

      expect(suggestions).toContain('Unable to retrieve property availability')
      expect(suggestions).toContain('Verify API credentials and permissions')
      expect(suggestions).toContain('Check if properties exist in the account')
      expect(suggestions).toContain('Contact support if the issue persists')
      expect(suggestions.length).toBe(4)
    })
  })

  describe('Thread entity suggestions', () => {
    it('should return empty array for thread actions', () => {
      const suggestions = generateSuggestions('action', 'thread', {
        action: 'archived',
      })

      expect(suggestions.length).toBe(0)
    })

    it('should return empty array for thread read action', () => {
      const suggestions = generateSuggestions('action', 'thread', {
        action: 'read',
      })

      expect(suggestions.length).toBe(0)
    })

    it('should return empty for unknown thread actions', () => {
      const suggestions = generateSuggestions('action', 'thread', {
        action: 'unknown',
      })
      expect(suggestions.length).toBe(0)
    })
  })

  describe('Property entity suggestions', () => {
    it('should return empty array for property list with more results', () => {
      const suggestions = generateSuggestions('list', 'property', {
        hasMore: true,
      })

      expect(suggestions.length).toBe(0)
    })

    it('should return empty array for property list without more results', () => {
      const suggestions = generateSuggestions('list', 'property', {
        hasMore: false,
      })

      expect(suggestions.length).toBe(0)
    })
  })

  describe('Unknown entities', () => {
    it('should return empty array for unknown entities', () => {
      const suggestions = generateSuggestions('create', 'unknown', {})
      expect(suggestions.length).toBe(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle null or undefined details gracefully', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing null data handling
      const suggestions1 = generateSuggestions('create', 'booking', null as any)
      expect(suggestions1[0]).toBe('Send confirmation email to guest')

      // biome-ignore lint/suspicious/noExplicitAny: Testing undefined data handling
      const suggestions2 = generateSuggestions('create', 'booking', undefined as any)
      expect(suggestions2[0]).toBe('Send confirmation email to guest')
    })

    it('should handle special characters in details', () => {
      const suggestions = generateSuggestions('create', 'booking', {
        guestEmail: "o'brien@example.com",
      })

      expect(suggestions[0]).toBe("Send confirmation email to o'brien@example.com")
    })

    it('should handle very long email addresses', () => {
      const longEmail = `${'a'.repeat(100)}@example.com`
      const suggestions = generateSuggestions('create', 'booking', {
        guestEmail: longEmail,
      })

      expect(suggestions[0]).toContain(longEmail)
    })
  })
})
