import { describe, expect, it } from 'bun:test'
import { generateSummary } from '../../../src/mcp/utils/summary-generator.js'

describe('SummaryGenerator', () => {
  describe('Booking operations', () => {
    it('should generate success summary for booking creation', () => {
      const summary = generateSummary('create', 'booking', { bookingId: 'BK001' }, 'success')
      expect(summary).toBe('Successfully created booking BK001 for guest')
    })

    it('should generate success summary for booking update', () => {
      const summary = generateSummary('update', 'booking', { bookingId: 'BK002' }, 'success')
      expect(summary).toBe('Successfully updated booking BK002')
    })

    it('should generate success summary for booking deletion', () => {
      const summary = generateSummary('delete', 'booking', { bookingId: 'BK003' }, 'success')
      expect(summary).toBe('Successfully deleted booking BK003')
    })

    it('should generate success summary for booking read', () => {
      const summary = generateSummary('read', 'booking', { bookingId: 'BK004' }, 'success')
      expect(summary).toBe('Successfully retrieved booking')
    })

    it('should handle booking without ID', () => {
      const summary = generateSummary('create', 'booking', {}, 'success')
      expect(summary).toBe('Successfully created booking new for guest')
    })

    it('should generate failed summary for booking', () => {
      const summary = generateSummary('create', 'booking', { bookingId: 'BK005' }, 'failed')
      expect(summary).toBe('Failed to create booking BK005 for guest')
    })
  })

  describe('Property operations', () => {
    it('should generate summary for property list', () => {
      const summary = generateSummary('list', 'property', { count: 10 }, 'success')
      expect(summary).toBe('Successfully processed property')
    })

    it('should generate summary for single property', () => {
      const summary = generateSummary('list', 'property', { count: 1 }, 'success')
      expect(summary).toBe('Successfully processed property')
    })

    it('should handle property list without count', () => {
      const summary = generateSummary('list', 'property', {}, 'success')
      expect(summary).toBe('Successfully processed property')
    })

    it('should generate summary for property read with name', () => {
      const summary = generateSummary('read', 'property', { name: 'Beach House' }, 'success')
      expect(summary).toBe('Successfully retrieved property')
    })
  })

  describe('Payment link operations', () => {
    it('should generate summary for payment link creation', () => {
      const summary = generateSummary(
        'create',
        'payment_link',
        { bookingId: 'BK006', amount: '$500.00' },
        'success',
      )
      expect(summary).toBe('Successfully created payment link for $500.00')
    })

    it('should handle payment link without amount', () => {
      const summary = generateSummary('create', 'payment_link', { bookingId: 'BK007' }, 'success')
      expect(summary).toBe('Successfully created payment link for payment')
    })
  })

  describe('Quote operations', () => {
    it('should generate summary for quote creation with amount', () => {
      const summary = generateSummary(
        'create',
        'quote',
        { bookingId: 'BK008', totalPrice: '$1,000.00' },
        'success',
      )
      expect(summary).toBe('Successfully created quote for booking BK008')
    })

    it('should handle quote without amount', () => {
      const summary = generateSummary('create', 'quote', { bookingId: 'BK009' }, 'success')
      expect(summary).toBe('Successfully created quote for booking BK009')
    })
  })

  describe('Rate operations', () => {
    it('should generate summary for rate update with property', () => {
      const summary = generateSummary('update', 'rate', { property: 'Property 123' }, 'success')
      expect(summary).toBe('Successfully updated rates for Property 123')
    })

    it('should handle rate update without property', () => {
      const summary = generateSummary('update', 'rate', {}, 'success')
      expect(summary).toBe('Successfully updated rates for property')
    })
  })

  describe('Webhook operations', () => {
    it('should generate summary for webhook subscription', () => {
      const summary = generateSummary(
        'create',
        'webhook',
        { event: 'booking_new_status_booked' },
        'success',
      )
      expect(summary).toBe('Successfully subscribed to booking_new_status_booked webhook')
    })

    it('should generate summary for webhook unsubscribe', () => {
      const summary = generateSummary('delete', 'webhook', { webhookId: 'WH001' }, 'success')
      expect(summary).toBe('Successfully unsubscribed from webhook WH001')
    })

    it('should handle webhook without event', () => {
      const summary = generateSummary('create', 'webhook', {}, 'success')
      expect(summary).toBe('Successfully subscribed to event webhook')
    })
  })

  describe('Message operations', () => {
    it('should generate summary for message sent', () => {
      const summary = generateSummary('create', 'message', { threadId: 'TH001' }, 'success')
      expect(summary).toBe('Successfully sent message to recipient')
    })

    it('should handle message without thread', () => {
      const summary = generateSummary('create', 'message', {}, 'success')
      expect(summary).toBe('Successfully sent message to recipient')
    })
  })

  describe('Key codes operations', () => {
    it('should generate summary for key codes update with booking', () => {
      const summary = generateSummary(
        'update',
        'key_codes',
        { bookingId: 'BK010', codesUpdated: 2 },
        'success',
      )
      expect(summary).toBe('Successfully updated access codes for booking BK010')
    })

    it('should handle single code update', () => {
      const summary = generateSummary(
        'update',
        'key_codes',
        { bookingId: 'BK011', codesUpdated: 1 },
        'success',
      )
      expect(summary).toBe('Successfully updated access codes for booking BK011')
    })

    it('should handle key codes without count', () => {
      const summary = generateSummary('update', 'key_codes', { bookingId: 'BK012' }, 'success')
      expect(summary).toBe('Successfully updated access codes for booking BK012')
    })
  })

  describe('Vacant inventory operations', () => {
    it('should generate summary for multiple vacant properties', () => {
      const summary = generateSummary(
        'list',
        'vacant_inventory',
        {
          counts: { availableProperties: 5 },
          dateRange: 'March 15, 2024 to March 22, 2024',
        },
        'success',
      )
      expect(summary).toBe('Successfully processed vacant_inventory')
    })

    it('should generate summary for single vacant property', () => {
      const summary = generateSummary(
        'list',
        'vacant_inventory',
        {
          counts: { availableProperties: 1 },
          dateRange: 'March 15, 2024 to March 22, 2024',
        },
        'success',
      )
      expect(summary).toBe('Successfully processed vacant_inventory')
    })

    it('should generate summary for no vacant properties', () => {
      const summary = generateSummary(
        'list',
        'vacant_inventory',
        {
          counts: { availableProperties: 0 },
          dateRange: 'March 15, 2024 to March 22, 2024',
        },
        'success',
      )
      expect(summary).toBe('Successfully processed vacant_inventory')
    })

    it('should handle vacant inventory without counts', () => {
      const summary = generateSummary(
        'list',
        'vacant_inventory',
        { dateRange: 'March 15, 2024 to March 22, 2024' },
        'success',
      )
      expect(summary).toBe('Successfully processed vacant_inventory')
    })

    it('should handle vacant inventory without any details', () => {
      const summary = generateSummary('list', 'vacant_inventory', {}, 'success')
      expect(summary).toBe('Successfully processed vacant_inventory')
    })
  })

  describe('Thread operations', () => {
    it('should generate summary for thread archive', () => {
      const summary = generateSummary(
        'action',
        'thread',
        { threadId: 'TH002', action: 'archived' },
        'success',
      )
      expect(summary).toBe('Successfully performed archived thread')
    })

    it('should generate summary for thread read', () => {
      const summary = generateSummary(
        'action',
        'thread',
        { threadId: 'TH003', action: 'read' },
        'success',
      )
      expect(summary).toBe('Successfully performed read thread')
    })

    it('should handle thread without action', () => {
      const summary = generateSummary('action', 'thread', { threadId: 'TH004' }, 'success')
      expect(summary).toBe('Successfully performed action on thread')
    })
  })

  describe('Generic operations', () => {
    it('should generate generic summary for unknown entity', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing unknown entity type handling
      const summary = generateSummary('read', 'unknown' as any, {}, 'success')
      expect(summary).toBe('Successfully retrieved unknown')
    })

    it('should handle partial status', () => {
      const summary = generateSummary('create', 'booking', { bookingId: 'BK013' }, 'partial')
      expect(summary).toBe('Partially created booking BK013 for guest')
    })

    it('should handle unknown operation type', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing unknown operation type handling
      const summary = generateSummary('process' as any, 'booking', {}, 'success')
      expect(summary).toBe('Successfully processed booking')
    })

    it('should handle data as object type', () => {
      const data = { counts: { availableProperties: 3 } }
      const summary = generateSummary('list', 'vacant_inventory', data, 'success')
      expect(summary).toBe('Successfully processed vacant_inventory')
    })

    it('should throw error for undefined status', () => {
      expect(() => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing undefined status handling
        generateSummary('create', 'booking', { bookingId: 'BK014' }, undefined as any)
      }).toThrow('Operation status cannot be undefined for create booking')
    })
  })

  describe('Edge cases', () => {
    it('should handle null data', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing null data handling
      const summary = generateSummary('read', 'booking', null as any, 'success')
      expect(summary).toBe('Successfully retrieved booking')
    })

    it('should handle undefined data', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing undefined data handling
      const summary = generateSummary('create', 'property', undefined as any, 'success')
      expect(summary).toBe('Successfully created property')
    })

    it('should handle numeric values', () => {
      const summary = generateSummary('update', 'rate', { property: 123 }, 'success')
      expect(summary).toBe('Successfully updated rates for 123')
    })

    it('should handle special characters in IDs', () => {
      const summary = generateSummary('read', 'booking', { bookingId: 'BK-001/2024' }, 'success')
      expect(summary).toBe('Successfully retrieved booking')
    })

    it('should handle very long property names', () => {
      const longName = 'A'.repeat(100)
      const summary = generateSummary('read', 'property', { name: longName }, 'success')
      expect(summary).toBe('Successfully retrieved property')
    })
  })
})
