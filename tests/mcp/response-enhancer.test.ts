/**
 * Tests for Response Enhancer Utility
 */

import { describe, expect, it } from 'bun:test'
import {
  calculateNights,
  type EnhanceOptions,
  enhanceResponse,
  formatCurrency,
  formatDate,
  formatMcpResponse,
} from '../../src/mcp/utils/response-enhancer'

describe('Response Enhancer', () => {
  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(1500, 'USD')).toBe('$1,500.00')
      expect(formatCurrency(99.99, 'USD')).toBe('$99.99')
      expect(formatCurrency(0, 'USD')).toBe('$0.00')
    })

    it('should format EUR currency correctly', () => {
      expect(formatCurrency(1500, 'EUR')).toBe('€1,500.00')
    })

    it('should handle unknown currencies', () => {
      expect(formatCurrency(1500, 'XXX')).toBe('XXX 1,500.00')
    })

    it('should handle undefined amounts', () => {
      expect(formatCurrency(undefined, 'USD')).toBe('N/A')
    })

    it('should default to USD when currency not specified', () => {
      expect(formatCurrency(100)).toBe('$100.00')
    })
  })

  describe('formatDate', () => {
    it('should format date without time', () => {
      expect(formatDate('2024-03-15')).toBe('March 15, 2024')
      expect(formatDate('2024-12-25')).toBe('December 25, 2024')
    })

    it('should format date with time', () => {
      const result = formatDate('2024-03-15T15:30:00Z', true)
      // Time formatting may vary based on timezone, so we just check it contains the date
      expect(result).toContain('March 15, 2024')
    })

    it('should handle invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date')
    })

    it('should handle undefined dates', () => {
      expect(formatDate(undefined)).toBe('N/A')
      expect(formatDate(null)).toBe('N/A')
    })
  })

  describe('calculateNights', () => {
    it('should calculate nights between dates correctly', () => {
      expect(calculateNights('2024-03-15', '2024-03-20')).toBe(5)
      expect(calculateNights('2024-03-15', '2024-03-16')).toBe(1)
      expect(calculateNights('2024-03-15', '2024-03-15')).toBe(0)
    })

    it('should handle invalid dates', () => {
      expect(calculateNights('invalid', '2024-03-20')).toBe(0)
      expect(calculateNights('2024-03-15', 'invalid')).toBe(0)
    })
  })

  describe('enhanceResponse', () => {
    it('should enhance booking creation response', () => {
      const data = {
        id: 123,
        guest_name: 'John Doe',
        guest_email: 'john@example.com',
        property_id: 456,
        arrival: '2024-03-15',
        departure: '2024-03-20',
        adults: 2,
        children: 1,
        amount: 1500,
        currency: 'USD',
        status: 'confirmed',
      }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'booking',
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.operation.type).toBe('create')
      expect(enhanced.operation.entity).toBe('booking')
      expect(enhanced.operation.status).toBe('success')
      expect(enhanced.summary).toContain('Successfully created booking')
      expect(enhanced.details.bookingId).toBe('123')
      expect(enhanced.details.guest).toBe('John Doe')
      expect(enhanced.details.checkIn).toBe('March 15, 2024')
      expect(enhanced.details.checkOut).toBe('March 20, 2024')
      expect(enhanced.details.nights).toBe(5)
      expect(enhanced.details.totalGuests).toBe(3)
      expect(enhanced.suggestions?.length).toBeGreaterThan(0)
      expect(enhanced.data).toEqual(data)
    })

    it('should enhance payment link creation response', () => {
      const data = {
        paymentUrl: 'https://pay.lodgify.com/xyz',
        amount: 500,
        currency: 'EUR',
        expiresAt: '2024-04-01T12:00:00Z',
      }

      const inputParams = {
        id: 'booking-789',
        payload: {
          amount: 500,
          currency: 'EUR',
          description: 'Deposit payment',
        },
      }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'payment_link',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.summary).toContain('Successfully created payment link')
      expect(enhanced.details.bookingId).toBe('booking-789')
      expect(enhanced.details.amount).toBe('€500.00')
      expect(enhanced.details.paymentUrl).toBe('https://pay.lodgify.com/xyz')
      expect(enhanced.details.description).toBe('Deposit payment')
    })

    it('should handle webhook subscription response', () => {
      const data = {
        id: 'webhook_123',
        status: 'active',
        createdAt: '2024-03-15T10:00:00Z',
      }

      const inputParams = {
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhooks',
      }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'webhook',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.summary).toContain(
        'Successfully subscribed to booking_new_status_booked webhook',
      )
      expect(enhanced.details.webhookId).toBe('webhook_123')
      expect(enhanced.details.event).toBe('booking_new_status_booked')
      expect(enhanced.details.targetUrl).toBe('https://example.com/webhooks')
      expect(enhanced.details.status).toBe('active')
      expect(enhanced.suggestions?.length).toBeGreaterThan(0)
    })

    it('should handle rate update response', () => {
      const data = {}

      const inputParams = {
        property_id: 123,
        rates: [
          {
            room_type_id: 456,
            start_date: '2024-06-01',
            end_date: '2024-08-31',
            price_per_day: 150,
            min_stay: 3,
            currency: 'USD',
          },
        ],
      }

      const options: EnhanceOptions = {
        operationType: 'update',
        entityType: 'rate',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.summary).toContain('Successfully updated rates')
      expect(enhanced.details.property).toBe('Property 123')
      expect(enhanced.details.ratesUpdated).toBe(1)
      expect(enhanced.details.dateRange).toContain('June 1, 2024')
      expect(enhanced.details.pricePerDay).toBe('$150.00')
      expect(enhanced.details.minimumStay).toBe('3 nights')
    })

    it('should handle custom warnings and suggestions', () => {
      const data = { success: true }

      const options: EnhanceOptions = {
        operationType: 'action',
        entityType: 'booking',
        customSuggestions: ['Custom suggestion 1', 'Custom suggestion 2'],
        customWarnings: ['Warning about something'],
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.suggestions).toEqual(['Custom suggestion 1', 'Custom suggestion 2'])
      expect(enhanced.warnings).toEqual(['Warning about something'])
    })

    it('should handle failed operations', () => {
      const data = { error: 'Something went wrong' }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'booking',
        status: 'failed',
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.operation.status).toBe('failed')
      expect(enhanced.summary).toContain('Failed to')
    })

    it('should handle numeric IDs correctly', () => {
      const data = {
        id: 12345, // Numeric ID
        bookingId: 67890, // Another numeric ID
        property_id: 111,
      }

      const options: EnhanceOptions = {
        operationType: 'update',
        entityType: 'booking',
      }

      const enhanced = enhanceResponse(data, options)

      // Should convert numeric IDs to strings
      expect(enhanced.details.bookingId).toBe('12345')
      expect(enhanced.details.propertyId).toBe('111')
    })

    it('should extract quote details correctly', () => {
      const data = {
        id: 'quote_123',
        totalPrice: 2000,
        currency: 'USD',
        validUntil: '2024-04-15T12:00:00Z',
      }

      const inputParams = {
        bookingId: 'BK789',
        payload: {
          totalPrice: 2000,
          currency: 'USD',
          validUntil: '2024-04-15T12:00:00Z',
        },
      }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'quote',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.summary).toContain('Successfully created quote for booking BK789')
      expect(enhanced.details.bookingId).toBe('BK789')
      expect(enhanced.details.quoteId).toBe('quote_123')
      expect(enhanced.details.totalPrice).toBe('$2,000.00')
      expect(enhanced.details.validUntil).toContain('April 15, 2024')
    })
  })

  describe('formatMcpResponse', () => {
    it('should format enhanced response as JSON string', () => {
      const enhanced = enhanceResponse(
        { id: 123, status: 'success' },
        {
          operationType: 'create',
          entityType: 'booking',
        },
      )

      const formatted = formatMcpResponse(enhanced)
      expect(formatted).toBeTypeOf('string')

      const parsed = JSON.parse(formatted)
      expect(parsed.operation).toBeDefined()
      expect(parsed.summary).toBeDefined()
      expect(parsed.details).toBeDefined()
      expect(parsed.data).toBeDefined()
    })
  })
})
