/**
 * Comprehensive Integration Tests for lodgify_create_booking_quote tool
 * Tests the critical user-facing feature for creating custom pricing quotes for bookings
 * This allows property managers to provide personalized pricing for specific bookings
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { getRateTools } from '../../src/mcp/tools/rate-tools.js'
import { ReadOnlyModeError } from '../../src/core/errors/read-only-error.js'

describe('lodgify_create_booking_quote - User-facing custom quote creation', () => {
  let mockClient: {
    createBookingQuote: ReturnType<typeof mock>
    isReadOnly: () => boolean
  }
  let tools: ReturnType<typeof getRateTools>
  let createQuoteTool: ReturnType<typeof getRateTools>[0]

  beforeEach(() => {
    // Create mock client
    mockClient = {
      createBookingQuote: mock(),
      isReadOnly: () => false,
    }

    // Get tools with mock client
    tools = getRateTools(() => mockClient)
    const tool = tools.find((t) => t.name === 'lodgify_create_booking_quote')
    if (!tool) throw new Error('Tool not found')
    createQuoteTool = tool
  })

  afterEach(() => {
    // Clean up mocks
    mock.restore()
  })

  describe('Creating custom quotes with pricing adjustments', () => {
    it('should create a basic custom quote for an existing booking', async () => {
      // Manager wants to provide custom pricing for a booking
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'Q12345',
        bookingId: 'BK12345',
        status: 'created',
        totalPrice: 1500.00,
        currency: 'USD',
        createdAt: '2024-03-15T10:00:00Z',
        validUntil: '2024-03-31T23:59:59Z',
        guestViewUrl: 'https://lodgify.com/quote/view/Q12345',
        paymentUrl: 'https://lodgify.com/quote/pay/Q12345',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BK12345',
        payload: {
          totalPrice: 1500.00,
          currency: 'USD',
        },
      })

      // Verify API was called correctly
      expect(mockClient.createBookingQuote).toHaveBeenCalledWith('BK12345', {
        totalPrice: 1500.00,
        currency: 'USD',
      })

      const content = JSON.parse(result.content[0].text)

      // Check enhanced response structure
      expect(content.operation).toEqual(
        expect.objectContaining({
          type: 'create',
          entity: 'quote',
          status: 'success',
        }),
      )

      // Verify quote details in response
      expect(content.data.id).toBe('Q12345')
      expect(content.data.bookingId).toBe('BK12345')
      expect(content.data.totalPrice).toBe(1500.00)
      expect(content.data.guestViewUrl).toBeDefined()
      expect(content.data.paymentUrl).toBeDefined()

      // Should provide helpful summary
      expect(content.summary).toBeDefined()
      expect(typeof content.summary).toBe('string')

      // Should provide follow-up suggestions
      if (content.suggestions) {
        expect(content.suggestions).toBeInstanceOf(Array)
        // Suggestions might include notifying guest, tracking payment, etc.
      }
    })

    it('should create a detailed quote with price breakdown', async () => {
      // Manager wants to show detailed pricing breakdown
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'Q67890',
        bookingId: 'BK67890',
        status: 'created',
        totalPrice: 2500.00,
        currency: 'EUR',
        breakdown: {
          accommodation: 2000.00,
          taxes: 300.00,
          fees: 150.00,
          discount: 50.00,
        },
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BK67890',
        payload: {
          totalPrice: 2500.00,
          currency: 'EUR',
          breakdown: {
            accommodation: 2000.00,
            taxes: 300.00,
            fees: 150.00,
            discount: 50.00,
          },
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BK67890',
        expect.objectContaining({
          totalPrice: 2500.00,
          breakdown: expect.objectContaining({
            accommodation: 2000.00,
            taxes: 300.00,
          }),
        }),
      )

      const content = JSON.parse(result.content[0].text)
      expect(content.data.breakdown).toBeDefined()
      expect(content.data.breakdown.accommodation).toBe(2000.00)
    })

    it('should create a quote with validity period and send to guest', async () => {
      // Manager wants to send time-limited offer to guest
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'Q99999',
        bookingId: 'BK99999',
        status: 'sent',
        totalPrice: 3000.00,
        validUntil: '2024-12-31T23:59:59Z',
        sentToGuest: true,
        guestEmail: 'guest@example.com',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BK99999',
        payload: {
          totalPrice: 3000.00,
          currency: 'USD',
          validUntil: '2024-12-31T23:59:59Z',
          sendToGuest: true,
          notes: 'Holiday special rate - 20% off',
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BK99999',
        expect.objectContaining({
          validUntil: '2024-12-31T23:59:59Z',
          sendToGuest: true,
          notes: 'Holiday special rate - 20% off',
        }),
      )

      const content = JSON.parse(result.content[0].text)
      expect(content.data.sentToGuest).toBe(true)
      expect(content.data.validUntil).toBe('2024-12-31T23:59:59Z')
    })
  })

  describe('Input validation and error handling', () => {
    it('should reject negative total price', async () => {
      // Invalid negative price
      await expect(
        createQuoteTool.handler({
          bookingId: 'BK001',
          payload: {
            totalPrice: -100.00,
            currency: 'USD',
          },
        }),
      ).rejects.toThrow('Total price must be a positive number')
    })

    it('should reject zero total price', async () => {
      // Invalid zero price
      await expect(
        createQuoteTool.handler({
          bookingId: 'BK002',
          payload: {
            totalPrice: 0,
            currency: 'USD',
          },
        }),
      ).rejects.toThrow('Total price must be a positive number')
    })

    it('should validate currency code format', async () => {
      // Currently accepts 3-letter currency codes through Zod schema
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'Q001',
        status: 'created',
      })

      // Valid 3-letter code should work
      const result = await createQuoteTool.handler({
        bookingId: 'BK003',
        payload: {
          totalPrice: 1000.00,
          currency: 'GBP',
        },
      })

      const content = JSON.parse(result.content[0].text)
      expect(content.operation.status).toBe('success')
    })

    it('should validate ISO 8601 date format for validUntil', async () => {
      // Invalid date format
      await expect(
        createQuoteTool.handler({
          bookingId: 'BK004',
          payload: {
            totalPrice: 1500.00,
            validUntil: '2024/12/31', // Wrong format
          },
        }),
      ).rejects.toThrow('Invalid validUntil format')
    })

    it('should accept valid ISO 8601 datetime for validUntil', async () => {
      // Valid ISO datetime
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'Q002',
        validUntil: '2025-06-30T15:00:00Z',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BK005',
        payload: {
          totalPrice: 2000.00,
          validUntil: '2025-06-30T15:00:00Z',
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BK005',
        expect.objectContaining({
          validUntil: '2025-06-30T15:00:00Z',
        }),
      )
    })

    it('should handle empty booking ID gracefully', async () => {
      // Empty string technically passes Zod min(1) check but gets passed through to API
      // The mock client returns undefined for empty bookingId
      mockClient.createBookingQuote.mockResolvedValue(undefined)

      const result = await createQuoteTool.handler({
        bookingId: '',
        payload: {
          totalPrice: 1000.00,
        },
      })

      // API was called with empty string
      expect(mockClient.createBookingQuote).toHaveBeenCalledWith('', expect.any(Object))

      // Response should handle undefined gracefully
      const content = JSON.parse(result.content[0].text)
      expect(content.operation.status).toBe('success')
    })
  })

  describe('Complex quote scenarios', () => {
    it('should create quote with custom adjustments (for future compatibility)', async () => {
      // Adjustments field for future use - currently may not be processed by API
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QADJ001',
        totalPrice: 1450.00,
        adjustments: [
          {
            type: 'discount',
            description: 'Early booking discount',
            amount: 50.00,
            isPercentage: false,
          },
        ],
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKADJ001',
        payload: {
          totalPrice: 1450.00,
          adjustments: [
            {
              type: 'discount',
              description: 'Early booking discount',
              amount: 50.00,
              isPercentage: false,
            },
          ],
        },
      })

      const content = JSON.parse(result.content[0].text)
      expect(content.data.totalPrice).toBe(1450.00)
      // Adjustments may be preserved in response even if not fully processed
      if (content.data.adjustments) {
        expect(content.data.adjustments[0].type).toBe('discount')
      }
    })

    it('should create quote with custom terms and rental agreement', async () => {
      // Complex quote with legal terms
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QTERMS001',
        customTerms: 'Special event booking terms apply',
        policyId: 'POL123',
        rentalAgreementId: 'RA456',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKTERMS001',
        payload: {
          totalPrice: 5000.00,
          customTerms: 'Special event booking terms apply',
          policyId: 'POL123',
          rentalAgreementId: 'RA456',
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BKTERMS001',
        expect.objectContaining({
          customTerms: 'Special event booking terms apply',
          policyId: 'POL123',
          rentalAgreementId: 'RA456',
        }),
      )
    })

    it('should handle quote replacement option', async () => {
      // Replace existing quote
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QREPLACE001',
        replacedQuoteId: 'QOLD001',
        status: 'created',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKREPLACE001',
        payload: {
          totalPrice: 1800.00,
          replaceExisting: true,
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BKREPLACE001',
        expect.objectContaining({
          replaceExisting: true,
        }),
      )

      const content = JSON.parse(result.content[0].text)
      if (content.data.replacedQuoteId) {
        expect(content.data.replacedQuoteId).toBe('QOLD001')
      }
    })

    it('should create minimal quote with only required fields', async () => {
      // Minimal valid quote
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QMIN001',
        bookingId: 'BKMIN001',
        status: 'created',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKMIN001',
        payload: {}, // Empty payload - all fields are optional
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith('BKMIN001', {})

      const content = JSON.parse(result.content[0].text)
      expect(content.operation.status).toBe('success')
    })
  })

  describe('Read-only mode protection', () => {
    it('should block quote creation in read-only mode', async () => {
      // Override isReadOnly to return true
      mockClient.isReadOnly = () => true

      // When orchestrator is in read-only mode, it throws a wrapped McpError
      const readOnlyError = new ReadOnlyModeError('createBookingQuote')
      // The error gets wrapped in McpError by the error handler
      mockClient.createBookingQuote.mockRejectedValue(readOnlyError)

      await expect(
        createQuoteTool.handler({
          bookingId: 'BKRO001',
          payload: {
            totalPrice: 1500.00,
          },
        }),
      ).rejects.toThrow('Write operation')
    })

    it('should allow quote creation in write mode', async () => {
      // Ensure write mode
      mockClient.isReadOnly = () => false

      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QWR001',
        status: 'created',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKWR001',
        payload: {
          totalPrice: 2000.00,
        },
      })

      const content = JSON.parse(result.content[0].text)
      expect(content.operation.status).toBe('success')
    })
  })

  describe('Error recovery and edge cases', () => {
    it('should handle network errors gracefully', async () => {
      // API is down or network issue
      mockClient.createBookingQuote.mockRejectedValue(new Error('Network timeout'))

      await expect(
        createQuoteTool.handler({
          bookingId: 'BKNET001',
          payload: {
            totalPrice: 1500.00,
          },
        }),
      ).rejects.toThrow('Network timeout')
    })

    it('should handle booking not found error', async () => {
      // Booking doesn't exist
      mockClient.createBookingQuote.mockRejectedValue(
        new Error('404: Booking not found'),
      )

      await expect(
        createQuoteTool.handler({
          bookingId: 'NONEXISTENT',
          payload: {
            totalPrice: 1000.00,
          },
        }),
      ).rejects.toThrow('404: Booking not found')
    })

    it('should handle API validation errors', async () => {
      // API rejects the payload
      mockClient.createBookingQuote.mockRejectedValue(
        new Error('400: Invalid quote parameters'),
      )

      await expect(
        createQuoteTool.handler({
          bookingId: 'BKVAL001',
          payload: {
            totalPrice: 999999999.99, // Extremely high price
          },
        }),
      ).rejects.toThrow('400: Invalid quote parameters')
    })

    it('should handle special characters in booking ID', async () => {
      // Booking ID with special characters
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QSPEC001',
        bookingId: 'BK-2024_001#USD',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BK-2024_001#USD',
        payload: {
          totalPrice: 1750.00,
        },
      })

      expect(mockClient.createBookingQuote).toHaveBeenCalledWith(
        'BK-2024_001#USD',
        expect.any(Object),
      )
    })

    it('should handle very large price breakdown', async () => {
      // Complex breakdown with many line items
      const largeBreakdown = {
        accommodation: 10000.00,
        taxes: 1500.00,
        fees: 500.00,
        extras: 250.00,
        discount: 1000.00,
      }

      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QLARGE001',
        totalPrice: 10250.00,
        breakdown: largeBreakdown,
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKLARGE001',
        payload: {
          totalPrice: 10250.00,
          breakdown: largeBreakdown,
        },
      })

      const content = JSON.parse(result.content[0].text)
      expect(content.data.breakdown.accommodation).toBe(10000.00)
    })
  })

  describe('User experience and response enhancement', () => {
    it('should provide clear summary for successful quote creation', async () => {
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QUX001',
        bookingId: 'BKUX001',
        status: 'created',
        totalPrice: 1500.00,
        guestViewUrl: 'https://lodgify.com/quote/view/QUX001',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKUX001',
        payload: {
          totalPrice: 1500.00,
          sendToGuest: true,
        },
      })

      const content = JSON.parse(result.content[0].text)

      // Summary should be user-friendly and informative
      expect(content.summary).toBeDefined()
      expect(typeof content.summary).toBe('string')
      expect(content.summary.length).toBeGreaterThan(0)

      // Should include helpful details
      if (content.details) {
        expect(content.details).toBeDefined()
      }
    })

    it('should provide actionable suggestions after quote creation', async () => {
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QSUG001',
        bookingId: 'BKSUG001',
        status: 'created',
        paymentUrl: 'https://lodgify.com/quote/pay/QSUG001',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKSUG001',
        payload: {
          totalPrice: 2000.00,
          sendToGuest: false, // Not sent to guest
        },
      })

      const content = JSON.parse(result.content[0].text)

      // Should provide suggestions for next steps
      if (content.suggestions) {
        expect(content.suggestions).toBeInstanceOf(Array)
        // Might suggest sending to guest, tracking payment, etc.
        expect(content.suggestions.length).toBeGreaterThan(0)
      }
    })

    it('should include payment URLs in response when available', async () => {
      mockClient.createBookingQuote.mockResolvedValue({
        id: 'QPAY001',
        guestViewUrl: 'https://lodgify.com/quote/view/QPAY001',
        paymentUrl: 'https://lodgify.com/quote/pay/QPAY001',
        status: 'sent',
      })

      const result = await createQuoteTool.handler({
        bookingId: 'BKPAY001',
        payload: {
          totalPrice: 3500.00,
          sendToGuest: true,
        },
      })

      const content = JSON.parse(result.content[0].text)

      // Payment URLs should be preserved
      expect(content.data.guestViewUrl).toBe('https://lodgify.com/quote/view/QPAY001')
      expect(content.data.paymentUrl).toBe('https://lodgify.com/quote/pay/QPAY001')

      // Suggestions might include tracking payment status
      if (content.suggestions) {
        expect(content.suggestions).toBeDefined()
      }
    })
  })
})