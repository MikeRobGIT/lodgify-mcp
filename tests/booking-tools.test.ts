/**
 * Tests for booking-tools.ts - Critical User-Facing Payment Link Creation
 *
 * Tests the lodgify_create_booking_payment_link MCP tool which property managers
 * use to generate secure payment links for collecting guest payments online.
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { getBookingTools } from '../src/mcp/tools/booking-tools.js'

describe('Booking Tools - Critical Payment Link Creation Feature', () => {
  describe('lodgify_create_booking_payment_link - Payment Collection for Property Managers', () => {
    // Mock the orchestrator
    const mockCreateBookingPaymentLink = mock()
    const mockGetClient = () =>
      ({
        createBookingPaymentLink: mockCreateBookingPaymentLink,
      }) as unknown as LodgifyOrchestrator

    // Get the tool handler
    const tools = getBookingTools(mockGetClient)
    const paymentLinkTool = tools.find((t) => t.name === 'lodgify_create_booking_payment_link')
    const handler = paymentLinkTool?.handler

    beforeEach(() => {
      mockCreateBookingPaymentLink.mockClear()
    })

    describe('Successful Payment Link Creation', () => {
      it('should create a payment link with basic amount and currency', async () => {
        // Arrange - Property manager needs to collect final payment
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK12345/abc123',
          amount: 500.0,
          currency: 'USD',
          status: 'created',
          expiresAt: '2024-04-15T23:59:59Z',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - Create payment link for booking
        const result = await handler?.({
          id: 'BK12345',
          payload: {
            amount: 500.0,
            currency: 'USD',
          },
        })

        // Assert - Payment link created successfully
        expect(mockCreateBookingPaymentLink).toHaveBeenCalledWith('BK12345', {
          amount: 500.0,
          currency: 'USD',
        })

        const response = JSON.parse(result.content[0].text)
        expect(response.operation).toMatchObject({
          type: 'create',
          entity: 'payment_link',
          status: 'success',
        })
        // The actual response data includes extracted details
        expect(response.data.paymentLink).toBe(mockResponse.paymentLink)
        expect(response.data.amount).toBe(mockResponse.amount)
        expect(response.data.currency).toBe(mockResponse.currency)
        expect(response.details).toBeDefined()
        expect(response.suggestions).toBeDefined()
        expect(Array.isArray(response.suggestions)).toBe(true)
        expect(response.suggestions.length).toBeGreaterThan(0)
        // Check if any suggestion matches the expected pattern
        const hasPaymentLinkSuggestion = response.suggestions.some((s: string) =>
          /send.*payment.*link|share.*guest/i.test(s),
        )
        expect(hasPaymentLinkSuggestion).toBe(true)
      })

      it('should create a payment link with custom description for guest clarity', async () => {
        // Arrange - Property manager wants to specify what the payment is for
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK67890/xyz456',
          amount: 1500.0,
          currency: 'EUR',
          description: 'Final payment for Villa Sunset - July stay',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - Create payment link with description
        const result = await handler?.({
          id: 'BK67890',
          payload: {
            amount: 1500.0,
            currency: 'EUR',
            description: 'Final payment for Villa Sunset - July stay',
          },
        })

        // Assert - Description included in request
        expect(mockCreateBookingPaymentLink).toHaveBeenCalledWith('BK67890', {
          amount: 1500.0,
          currency: 'EUR',
          description: 'Final payment for Villa Sunset - July stay',
        })

        const response = JSON.parse(result.content[0].text)
        expect(response.data.description).toBe('Final payment for Villa Sunset - July stay')
      })

      it('should handle payment link creation with deposit amount', async () => {
        // Arrange - Collecting partial payment/deposit
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK99999/deposit',
          amount: 300.0,
          currency: 'GBP',
          description: 'Security deposit',
          totalAmount: 1200.0,
          status: 'created',
          paymentType: 'partial',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - Create payment link for deposit
        const result = await handler?.({
          id: 'BK99999',
          payload: {
            amount: 300.0,
            currency: 'GBP',
            description: 'Security deposit',
          },
        })

        // Assert - Partial payment link created
        const response = JSON.parse(result.content[0].text)
        expect(response.data.paymentType).toBe('partial')
        expect(response.data.amount).toBe(300.0)
        expect(response.suggestions).toBeDefined()
      })

      it('should extract payment URL from response for easy sharing', async () => {
        // Arrange - Response includes payment URL
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK11111/share',
          paymentUrl: 'https://pay.lodgify.com/secure/BK11111/share',
          amount: 750.0,
          currency: 'USD',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK11111',
          payload: {
            amount: 750.0,
            currency: 'USD',
          },
        })

        // Assert - Payment URL is available in suggestions context
        const response = JSON.parse(result.content[0].text)
        expect(response.data.paymentUrl).toBe('https://pay.lodgify.com/secure/BK11111/share')
        expect(response.suggestions).toBeDefined()
        expect(response.suggestions.length).toBeGreaterThan(0)
      })

      it('should handle multi-currency payment links for international properties', async () => {
        // Arrange - Property accepts multiple currencies
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK22222/intl',
          amount: 50000.0,
          currency: 'JPY',
          status: 'created',
          conversionRate: 0.0091, // JPY to USD rate
          baseAmount: 455.0, // Amount in base currency (USD)
          baseCurrency: 'USD',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - Create payment link in JPY
        const result = await handler?.({
          id: 'BK22222',
          payload: {
            amount: 50000.0,
            currency: 'JPY',
          },
        })

        // Assert - Currency conversion handled
        const response = JSON.parse(result.content[0].text)
        expect(response.data.currency).toBe('JPY')
        expect(response.data.amount).toBe(50000.0)
        expect(response.data.baseAmount).toBe(455.0)
      })
    })

    describe('Input Sanitization and Handling', () => {
      it('should handle empty booking ID gracefully', async () => {
        // Arrange - Empty ID gets sanitized but might still fail at API level
        mockCreateBookingPaymentLink.mockRejectedValue(new Error('Invalid booking ID'))

        // Act & Assert
        await expect(handler?.({ id: '', payload: { amount: 100 } })).rejects.toThrow(
          'Invalid booking ID',
        )
      })

      it('should create payment link without optional amount', async () => {
        // Arrange - Amount is optional, defaults to booking balance
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK12345/default',
          amount: 1200.0, // Default booking balance
          currency: 'USD',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - No amount specified
        const result = await handler?.({
          id: 'BK12345',
          payload: {},
        })

        // Assert - Uses default amount
        const response = JSON.parse(result.content[0].text)
        expect(response.data.amount).toBe(1200.0)
      })

      it('should handle optional currency parameter', async () => {
        // Arrange - Currency is optional
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK12345/nocurrency',
          amount: 500.0,
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - No currency specified
        const result = await handler?.({
          id: 'BK12345',
          payload: {
            amount: 500.0,
          },
        })

        // Assert - Works without currency
        const response = JSON.parse(result.content[0].text)
        expect(response.operation.status).toBe('success')
      })

      it('should handle description field properly', async () => {
        // Arrange
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK12345/desc',
          amount: 250.0,
          currency: 'EUR',
          description: 'Test description',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - With description
        const result = await handler?.({
          id: 'BK12345',
          payload: {
            amount: 250.0,
            currency: 'EUR',
            description: 'Test description',
          },
        })

        // Assert
        const response = JSON.parse(result.content[0].text)
        expect(response.data.description).toBe('Test description')
      })

      it('should sanitize booking ID with special characters', async () => {
        // Arrange
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/sanitized/link',
          amount: 100.0,
          currency: 'USD',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act - Booking ID with special chars
        const result = await handler?.({
          id: 'BK-123/45#test',
          payload: {
            amount: 100.0,
            currency: 'USD',
          },
        })

        // Assert - ID is sanitized but request succeeds
        expect(mockCreateBookingPaymentLink).toHaveBeenCalled()
        const response = JSON.parse(result.content[0].text)
        expect(response.operation.status).toBe('success')
      })
    })

    describe('Error Handling', () => {
      it('should handle API errors when booking not found', async () => {
        // Arrange - Booking doesn't exist
        mockCreateBookingPaymentLink.mockRejectedValue(new Error('Booking not found'))

        // Act & Assert
        await expect(
          handler?.({
            id: 'INVALID_BOOKING',
            payload: {
              amount: 500.0,
              currency: 'USD',
            },
          }),
        ).rejects.toThrow('Booking not found')
      })

      it('should handle payment link creation failures', async () => {
        // Arrange - Payment system error
        mockCreateBookingPaymentLink.mockRejectedValue(new Error('Payment gateway unavailable'))

        // Act & Assert
        await expect(
          handler?.({
            id: 'BK12345',
            payload: {
              amount: 1000.0,
              currency: 'USD',
            },
          }),
        ).rejects.toThrow('Payment gateway unavailable')
      })

      it('should handle network timeout errors', async () => {
        // Arrange - Network timeout
        mockCreateBookingPaymentLink.mockRejectedValue(new Error('Request timeout'))

        // Act & Assert
        await expect(
          handler?.({
            id: 'BK12345',
            payload: {
              amount: 250.0,
              currency: 'EUR',
            },
          }),
        ).rejects.toThrow('Request timeout')
      })

      it('should handle rate limiting errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded') as Error & { statusCode: number }
        rateLimitError.statusCode = 429
        mockCreateBookingPaymentLink.mockRejectedValue(rateLimitError)

        // Act & Assert
        await expect(
          handler?.({
            id: 'BK12345',
            payload: {
              amount: 100.0,
              currency: 'USD',
            },
          }),
        ).rejects.toThrow('Rate limit exceeded')
      })

      it('should handle permission denied errors', async () => {
        const permissionError = new Error(
          'Permission denied: payment link creation disabled',
        ) as Error & { statusCode: number }
        permissionError.statusCode = 403
        mockCreateBookingPaymentLink.mockRejectedValue(permissionError)

        // Act & Assert
        await expect(
          handler?.({
            id: 'BK12345',
            payload: {
              amount: 500.0,
              currency: 'USD',
            },
          }),
        ).rejects.toThrow('Permission denied')
      })
    })

    describe('Edge Cases', () => {
      it('should handle payment link with very large amounts', async () => {
        // Arrange - Large payment amount
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK33333/large',
          amount: 999999.99,
          currency: 'USD',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK33333',
          payload: {
            amount: 999999.99,
            currency: 'USD',
          },
        })

        // Assert - Large amount handled correctly
        const response = JSON.parse(result.content[0].text)
        expect(response.data.amount).toBe(999999.99)
      })

      it('should handle payment link creation with minimal response', async () => {
        // Arrange - API returns minimal data
        const mockResponse = {
          success: true,
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK44444',
          payload: {
            amount: 200.0,
            currency: 'EUR',
          },
        })

        // Assert - Handles minimal response gracefully
        const response = JSON.parse(result.content[0].text)
        expect(response.operation.status).toBe('success')
        expect(response.data).toMatchObject(mockResponse)
      })

      it('should handle decimal precision in payment amounts', async () => {
        // Arrange - Precise decimal amount
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK55555/precise',
          amount: 123.45,
          currency: 'USD',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK55555',
          payload: {
            amount: 123.45,
            currency: 'USD',
          },
        })

        // Assert - Decimal precision preserved
        const response = JSON.parse(result.content[0].text)
        expect(response.data.amount).toBe(123.45)
      })

      it('should provide suggestions even when payment URL is not in response', async () => {
        // Arrange - No payment URL in response
        const mockResponse = {
          status: 'created',
          amount: 300.0,
          currency: 'GBP',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK66666',
          payload: {
            amount: 300.0,
            currency: 'GBP',
          },
        })

        // Assert - Still provides helpful suggestions
        const response = JSON.parse(result.content[0].text)
        expect(response.suggestions).toBeDefined()
        expect(response.suggestions.length).toBeGreaterThan(0)
      })

      it('should handle concurrent payment link creation requests', async () => {
        // Arrange - Multiple concurrent requests
        const mockResponse1 = {
          paymentLink: 'https://pay.lodgify.com/secure/BK77777/link1',
          amount: 100.0,
          currency: 'USD',
        }
        const mockResponse2 = {
          paymentLink: 'https://pay.lodgify.com/secure/BK88888/link2',
          amount: 200.0,
          currency: 'EUR',
        }

        mockCreateBookingPaymentLink
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2)

        // Act - Create two payment links concurrently
        const [result1, result2] = await Promise.all([
          handler?.({
            id: 'BK77777',
            payload: { amount: 100.0, currency: 'USD' },
          }),
          handler?.({
            id: 'BK88888',
            payload: { amount: 200.0, currency: 'EUR' },
          }),
        ])

        // Assert - Both requests handled correctly
        const response1 = JSON.parse(result1.content[0].text)
        const response2 = JSON.parse(result2.content[0].text)
        expect(response1.data.amount).toBe(100.0)
        expect(response2.data.amount).toBe(200.0)
        expect(response1.data.currency).toBe('USD')
        expect(response2.data.currency).toBe('EUR')
      })
    })

    describe('Response Enhancement', () => {
      it('should include extracted payment details in response', async () => {
        // Arrange
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK99999/details',
          amount: 850.0,
          currency: 'CAD',
          status: 'created',
          expiresAt: '2024-05-01T23:59:59Z',
          bookingReference: 'BK99999',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK99999',
          payload: {
            amount: 850.0,
            currency: 'CAD',
          },
        })

        // Assert - Payment details extracted
        const response = JSON.parse(result.content[0].text)
        expect(response.details).toBeDefined()
        expect(response.details).toMatchObject({
          amount: expect.stringContaining('850'),
          currency: 'CAD',
        })
      })

      it('should generate contextual suggestions based on payment amount', async () => {
        // Arrange - High value payment
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK10101/highvalue',
          amount: 5000.0,
          currency: 'USD',
          status: 'created',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK10101',
          payload: {
            amount: 5000.0,
            currency: 'USD',
          },
        })

        // Assert - Suggestions appropriate for amount
        const response = JSON.parse(result.content[0].text)
        expect(response.suggestions).toBeDefined()
        expect(
          response.suggestions.some(
            (s: string) =>
              s.toLowerCase().includes('payment') ||
              s.toLowerCase().includes('link') ||
              s.toLowerCase().includes('send'),
          ),
        ).toBe(true)
      })

      it('should include operation metadata in enhanced response', async () => {
        // Arrange
        const mockResponse = {
          paymentLink: 'https://pay.lodgify.com/secure/BK20202/meta',
          amount: 425.0,
          currency: 'AUD',
        }
        mockCreateBookingPaymentLink.mockResolvedValue(mockResponse)

        // Act
        const result = await handler?.({
          id: 'BK20202',
          payload: {
            amount: 425.0,
            currency: 'AUD',
            description: 'Weekend stay deposit',
          },
        })

        // Assert - Operation metadata included
        const response = JSON.parse(result.content[0].text)
        expect(response.operation).toMatchObject({
          type: 'create',
          entity: 'payment_link',
          status: 'success',
        })
        expect(response.operation.timestamp).toBeDefined()
      })
    })
  })
})
