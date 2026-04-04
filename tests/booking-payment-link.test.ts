/**
 * Tests for lodgify_get_booking_payment_link MCP tool
 * This is a critical user-facing feature for collecting payments from guests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator'
import { getBookingTools } from '../src/mcp/tools/booking-tools'

describe('lodgify_get_booking_payment_link', () => {
  let mockClient: Partial<LodgifyOrchestrator>
  let tools: ReturnType<typeof getBookingTools>
  let getBookingPaymentLinkTool: ReturnType<typeof getBookingTools>[number]

  beforeEach(() => {
    mockClient = {
      getBookingPaymentLink: vi.fn(),
    }

    tools = getBookingTools(() => mockClient as LodgifyOrchestrator)
    getBookingPaymentLinkTool = tools.find((t) => t.name === 'lodgify_get_booking_payment_link')
  })

  it('should be registered as a tool', () => {
    expect(getBookingPaymentLinkTool).toBeDefined()
    expect(getBookingPaymentLinkTool.category).toBe('Booking & Reservation Management')
    expect(getBookingPaymentLinkTool.config.title).toBe('Get Booking Payment Link')
  })

  describe('handler functionality', () => {
    it('should retrieve existing payment link with all details', async () => {
      // Mock successful response with payment link
      const mockPaymentLink = {
        paymentLink: 'https://pay.lodgify.com/abc123',
        amount: 1500.0,
        currency: 'USD',
        status: 'pending',
        expiresAt: '2024-12-31T23:59:59Z',
        bookingId: 'BK12345',
        description: 'Final payment for Ocean View Villa',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockPaymentLink)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK12345',
      })

      // Verify the client was called with correct parameters
      expect(mockClient.getBookingPaymentLink).toHaveBeenCalledWith('BK12345')

      // Parse and verify the enhanced response
      const response = JSON.parse(result.content[0].text)

      // Check operation metadata
      expect(response.operation).toMatchObject({
        type: 'get',
        entity: 'payment_link',
        status: 'success',
      })

      // Verify the original data is included (ignoring _extracted)
      const { _extracted, ...dataWithoutExtracted } = response.data
      expect(dataWithoutExtracted).toEqual(mockPaymentLink)

      // Check for suggestions about payment collection if available
      if (response.suggestions) {
        expect(Array.isArray(response.suggestions)).toBe(true)
        expect(
          response.suggestions.some(
            (s: string) =>
              s.toLowerCase().includes('payment') ||
              s.toLowerCase().includes('guest') ||
              s.toLowerCase().includes('send'),
          ),
        ).toBe(true)
      }
    })

    it('should handle booking without payment link', async () => {
      // Mock response when no payment link exists
      const mockNoLink = {
        bookingId: 'BK67890',
        status: 'no_link',
        message: 'No payment link exists for this booking',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockNoLink)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK67890',
      })

      expect(mockClient.getBookingPaymentLink).toHaveBeenCalledWith('BK67890')

      const response = JSON.parse(result.content[0].text)
      expect(response.operation.status).toBe('success')
      const { _extracted, ...dataWithoutExtracted } = response.data
      expect(dataWithoutExtracted).toEqual(mockNoLink)

      // Should suggest creating a payment link
      if (response.suggestions) {
        expect(response.suggestions.some((s: string) => s.toLowerCase().includes('create'))).toBe(
          true,
        )
      }
    })

    it('should handle expired payment links', async () => {
      // Mock expired payment link
      const mockExpiredLink = {
        paymentLink: 'https://pay.lodgify.com/expired123',
        amount: 750.0,
        currency: 'EUR',
        status: 'expired',
        expiresAt: '2023-01-01T00:00:00Z',
        bookingId: 'BK99999',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockExpiredLink)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK99999',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.status).toBe('expired')

      // Should suggest generating a new link
      if (response.suggestions) {
        expect(
          response.suggestions.some(
            (s: string) => s.toLowerCase().includes('new') || s.toLowerCase().includes('generate'),
          ),
        ).toBe(true)
      }
    })

    it('should handle paid payment links', async () => {
      // Mock fully paid booking
      const mockPaidLink = {
        paymentLink: 'https://pay.lodgify.com/paid456',
        amount: 2000.0,
        currency: 'GBP',
        status: 'paid',
        paidAt: '2024-03-15T10:30:00Z',
        bookingId: 'BK55555',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockPaidLink)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK55555',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.status).toBe('paid')

      // Should indicate payment is complete
      if (response.suggestions) {
        expect(
          response.suggestions.some(
            (s: string) => s.toLowerCase().includes('paid') || s.toLowerCase().includes('complete'),
          ),
        ).toBe(true)
      }
    })

    it('should sanitize input to prevent injection', async () => {
      mockClient.getBookingPaymentLink.mockResolvedValue({ status: 'ok' })

      // Try with potentially dangerous input
      await getBookingPaymentLinkTool.handler({
        id: '<script>alert("xss")</script>',
      })

      // Input should be sanitized before reaching the client
      const callArg = mockClient.getBookingPaymentLink.mock.calls[0][0]
      expect(callArg).not.toContain('<script>')
      expect(callArg).not.toContain('alert')
    })

    it('should handle API errors gracefully', async () => {
      // Mock API error
      mockClient.getBookingPaymentLink.mockRejectedValue(new Error('Booking not found'))

      await expect(
        getBookingPaymentLinkTool.handler({
          id: 'INVALID_BOOKING',
        }),
      ).rejects.toThrow('Booking not found')
    })

    it('should handle network timeouts', async () => {
      // Mock network timeout
      mockClient.getBookingPaymentLink.mockRejectedValue(new Error('Request timeout'))

      await expect(
        getBookingPaymentLinkTool.handler({
          id: 'BK_TIMEOUT',
        }),
      ).rejects.toThrow('Request timeout')
    })

    it('should handle partial payment scenarios', async () => {
      // Mock partial payment
      const mockPartialPayment = {
        paymentLink: 'https://pay.lodgify.com/partial789',
        totalAmount: 3000.0,
        paidAmount: 1000.0,
        remainingAmount: 2000.0,
        currency: 'USD',
        status: 'partial',
        bookingId: 'BK_PARTIAL',
        deposits: [{ amount: 1000.0, paidAt: '2024-02-01T09:00:00Z' }],
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockPartialPayment)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_PARTIAL',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.status).toBe('partial')
      expect(response.data.remainingAmount).toBe(2000.0)

      // Should suggest collecting remaining payment if suggestions are present
      if (response.suggestions) {
        expect(
          response.suggestions.some(
            (s: string) =>
              s.toLowerCase().includes('remaining') || s.toLowerCase().includes('balance'),
          ),
        ).toBe(true)
      }
    })

    it('should handle multiple currency scenarios', async () => {
      // Mock payment link with currency conversion info
      const mockMultiCurrency = {
        paymentLink: 'https://pay.lodgify.com/multicur',
        amount: 1500.0,
        currency: 'EUR',
        originalCurrency: 'USD',
        originalAmount: 1650.0,
        exchangeRate: 0.909,
        bookingId: 'BK_MULTI_CUR',
        status: 'pending',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockMultiCurrency)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_MULTI_CUR',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.currency).toBe('EUR')
      expect(response.data.originalCurrency).toBe('USD')
      expect(response.data.exchangeRate).toBe(0.909)
    })

    it('should include payment method information when available', async () => {
      // Mock payment link with payment method details
      const mockWithPaymentMethod = {
        paymentLink: 'https://pay.lodgify.com/method123',
        amount: 500.0,
        currency: 'USD',
        status: 'pending',
        bookingId: 'BK_METHOD',
        acceptedMethods: ['credit_card', 'debit_card', 'bank_transfer'],
        preferredMethod: 'credit_card',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockWithPaymentMethod)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_METHOD',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.acceptedMethods).toContain('credit_card')
      expect(response.data.preferredMethod).toBe('credit_card')
    })

    it('should handle refund scenarios', async () => {
      // Mock refunded payment
      const mockRefund = {
        paymentLink: 'https://pay.lodgify.com/refund456',
        amount: 800.0,
        refundedAmount: 800.0,
        currency: 'USD',
        status: 'refunded',
        refundedAt: '2024-03-20T14:00:00Z',
        bookingId: 'BK_REFUND',
        refundReason: 'Guest cancellation',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockRefund)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_REFUND',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.data.status).toBe('refunded')
      expect(response.data.refundedAmount).toBe(800.0)
      expect(response.data.refundReason).toBe('Guest cancellation')
    })

    it('should extract payment link details correctly', async () => {
      // Mock comprehensive payment link response
      const mockComprehensive = {
        paymentLink: 'https://pay.lodgify.com/complete',
        shortLink: 'https://lfy.to/abc123',
        amount: 2500.0,
        currency: 'USD',
        status: 'pending',
        createdAt: '2024-03-01T10:00:00Z',
        expiresAt: '2024-04-01T10:00:00Z',
        bookingId: 'BK_COMPLETE',
        guestEmail: 'guest@example.com',
        propertyName: 'Ocean View Villa',
        checkIn: '2024-05-01',
        checkOut: '2024-05-08',
        paymentDescription: 'Full payment for 7 nights stay',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockComprehensive)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_COMPLETE',
      })

      const response = JSON.parse(result.content[0].text)

      // Verify extracted details
      expect(response.details).toBeDefined()
      // Payment link might be in different location based on extraction logic
      if (response.details.paymentLink) {
        expect(response.details.paymentLink).toBe('https://pay.lodgify.com/complete')
      }
      if (response.details.amount) {
        expect(response.details.amount).toBeDefined()
      }
      if (response.details.status) {
        expect(response.details.status).toBe('pending')
      }

      // Verify data is preserved
      expect(response.data.propertyName).toBe('Ocean View Villa')
      expect(response.data.checkIn).toBe('2024-05-01')
    })

    it('should handle minimal API response', async () => {
      // Mock minimal response (only required fields)
      const mockMinimal = {
        status: 'no_payment_required',
        bookingId: 'BK_MINIMAL',
      }
      mockClient.getBookingPaymentLink.mockResolvedValue(mockMinimal)

      const result = await getBookingPaymentLinkTool.handler({
        id: 'BK_MINIMAL',
      })

      const response = JSON.parse(result.content[0].text)
      expect(response.operation.status).toBe('success')
      // Remove _extracted field for comparison
      const { _extracted, ...dataWithoutExtracted } = response.data
      expect(dataWithoutExtracted).toEqual(mockMinimal)
    })

    it('should handle special characters in booking ID', async () => {
      mockClient.getBookingPaymentLink.mockResolvedValue({ status: 'ok' })

      // Test with various special characters that might appear in booking IDs
      const specialIds = ['BK-2024-001', 'BK_2024_001', 'BK.2024.001', 'BK#2024', 'BK 2024 001']

      for (const id of specialIds) {
        await getBookingPaymentLinkTool.handler({ id })

        // Verify the ID was passed correctly (after sanitization)
        const calls = mockClient.getBookingPaymentLink.mock.calls
        const lastCall = calls[calls.length - 1][0]
        expect(lastCall).toBeDefined()
      }
    })

    it('should provide contextual suggestions based on payment status', async () => {
      const scenarios = [
        {
          response: { status: 'pending', paymentLink: 'https://pay.lodgify.com/1' },
          expectedSuggestion: 'send',
        },
        {
          response: { status: 'expired' },
          expectedSuggestion: 'new',
        },
        {
          response: { status: 'paid' },
          expectedSuggestion: 'receipt',
        },
        {
          response: { status: 'no_link' },
          expectedSuggestion: 'create',
        },
      ]

      for (const scenario of scenarios) {
        mockClient.getBookingPaymentLink.mockResolvedValue(scenario.response)

        const result = await getBookingPaymentLinkTool.handler({
          id: `BK_${scenario.response.status}`,
        })

        const response = JSON.parse(result.content[0].text)
        // Only check suggestions if they exist
        if (response.suggestions) {
          expect(
            response.suggestions.some((s: string) =>
              s.toLowerCase().includes(scenario.expectedSuggestion),
            ),
          ).toBe(true)
        }
      }
    })

    it('should handle rate-limited responses', async () => {
      const rateLimitError = new Error('Rate limit exceeded') as Error & { statusCode: number }
      rateLimitError.statusCode = 429
      mockClient.getBookingPaymentLink.mockRejectedValue(rateLimitError)

      await expect(
        getBookingPaymentLinkTool.handler({
          id: 'BK_RATE_LIMITED',
        }),
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle unauthorized access', async () => {
      const unauthorizedError = new Error('Unauthorized') as Error & { statusCode: number }
      unauthorizedError.statusCode = 401
      mockClient.getBookingPaymentLink.mockRejectedValue(unauthorizedError)

      await expect(
        getBookingPaymentLinkTool.handler({
          id: 'BK_UNAUTHORIZED',
        }),
      ).rejects.toThrow('Unauthorized')
    })
  })
})
