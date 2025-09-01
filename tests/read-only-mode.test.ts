/**
 * Read-Only Mode Comprehensive Tests
 * Tests all aspects of read-only mode functionality
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { ReadOnlyModeError } from '../src/core/errors/read-only-error.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { createMockFetch, createMockResponse } from './utils.js'

describe('Read-Only Mode Comprehensive Tests', () => {
  let readOnlyClient: LodgifyOrchestrator
  let writeClient: LodgifyOrchestrator
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    // Create clients - one in read-only mode, one in write mode
    readOnlyClient = new LodgifyOrchestrator({
      apiKey: 'test-api-key',
      readOnly: true,
    })

    writeClient = new LodgifyOrchestrator({
      apiKey: 'test-api-key',
      readOnly: false,
    })

    // Mock successful responses for write operations (need enough for all tests)
    mockFetch = createMockFetch([
      // For rate operations
      createMockResponse(200, {
        rate_id: 'rate-123',
        property_id: 123,
        from: '2025-11-20',
        to: '2025-11-25',
        rate: 150.0,
        currency: 'USD',
        success: true,
      }),
      // For booking create/update operations
      createMockResponse(200, {
        id: 'booking-456',
        propertyId: 123,
        status: 'confirmed',
        checkIn: '2025-11-20',
        checkOut: '2025-11-25',
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        guestBreakdown: {
          adults: 2,
        },
      }),
      // For delete operations
      createMockResponse(200, { success: true }),
      // For webhook operations
      createMockResponse(200, { success: true, webhookId: 'webhook-123' }),
      // For key codes operations
      createMockResponse(200, { success: true }),
      // For payment link operations
      createMockResponse(200, {
        paymentLink: 'https://pay.example.com/booking-123',
        expiresAt: '2025-12-01T00:00:00Z',
      }),
      // Additional responses for other operations
      createMockResponse(200, {
        id: 'booking-456',
        propertyId: 123,
        status: 'confirmed',
        checkIn: '2025-11-20',
        checkOut: '2025-11-25',
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        guestBreakdown: {
          adults: 2,
        },
      }),
      createMockResponse(200, { success: true }),
      createMockResponse(200, { success: true, webhookId: 'webhook-123' }),
      createMockResponse(200, { success: true }),
      createMockResponse(200, {
        paymentLink: 'https://pay.example.com/booking-123',
        expiresAt: '2025-12-01T00:00:00Z',
      }),
    ])
    global.fetch = mockFetch
  })

  describe('Base Client Level Read-Only Checks', () => {
    test('should block POST requests in read-only mode', async () => {
      await expect(
        readOnlyClient.rates.createRate({
          propertyId: '123',
          roomTypeId: '456',
          from: '2025-11-20',
          to: '2025-11-25',
          rate: 150.0,
          currency: 'USD',
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block PUT requests in read-only mode', async () => {
      await expect(
        readOnlyClient.rates.updateRate('rate-123', {
          rate: 160.0,
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block DELETE requests in read-only mode', async () => {
      await expect(readOnlyClient.deleteBooking('booking-123')).rejects.toThrow(ReadOnlyModeError)
    })

    test('should allow GET requests in read-only mode', async () => {
      // Mock a successful GET response
      mockFetch = createMockFetch([
        createMockResponse(200, {
          property_id: 123,
          currency: 'USD',
          rates: [{ date: '2025-11-20', rate: 200 }],
        }),
      ])
      global.fetch = mockFetch

      await expect(
        readOnlyClient.getDailyRates({
          propertyId: '123',
          from: '2025-11-20',
          to: '2025-11-25',
        }),
      ).resolves.toBeDefined()
    })
  })

  describe('Orchestrator Level Read-Only Checks', () => {
    test('should block createBooking in read-only mode', async () => {
      await expect(
        readOnlyClient.createBooking({
          propertyId: '123',
          checkIn: '2025-11-20',
          checkOut: '2025-11-25',
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block updateBooking in read-only mode', async () => {
      await expect(
        readOnlyClient.updateBooking('booking-123', {
          guestBreakdown: { adults: 3 },
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block webhook subscription in read-only mode', async () => {
      await expect(
        readOnlyClient.subscribeWebhook({
          event: 'booking_new_any_status',
          target_url: 'https://example.com/webhook',
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block key codes update in read-only mode', async () => {
      await expect(
        readOnlyClient.updateKeyCodes('booking-123', {
          keyCodes: ['1234', '5678'],
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })

    test('should block payment link creation in read-only mode', async () => {
      await expect(
        readOnlyClient.createBookingPaymentLink('booking-123', {
          amount: 250.0,
          currency: 'USD',
        }),
      ).rejects.toThrow(ReadOnlyModeError)
    })
  })

  describe('Write Mode Operations', () => {
    test('should allow createBooking in write mode', async () => {
      await expect(
        writeClient.createBooking({
          propertyId: '123',
          checkIn: '2025-11-20',
          checkOut: '2025-11-25',
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          guestBreakdown: { adults: 2 },
        }),
      ).resolves.toBeDefined()
    })

    test('should allow rate creation in write mode', async () => {
      await expect(
        writeClient.rates.createRate({
          propertyId: '123',
          roomTypeId: '456',
          from: '2025-11-20',
          to: '2025-11-25',
          rate: 150.0,
          currency: 'USD',
        }),
      ).resolves.toBeDefined()
    })

    test('should allow rate updates in write mode', async () => {
      await expect(
        writeClient.rates.updateRate('rate-123', {
          rate: 160.0,
        }),
      ).resolves.toBeDefined()
    })
  })

  describe('ReadOnlyModeError Properties', () => {
    test('should create proper error for API operations', async () => {
      try {
        await readOnlyClient.createBooking({
          propertyId: '123',
          checkIn: '2025-11-20',
          checkOut: '2025-11-25',
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          guestBreakdown: { adults: 2 },
        })
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ReadOnlyModeError)
        expect((error as ReadOnlyModeError).status).toBe(403)
        expect((error as ReadOnlyModeError).message).toContain('read-only mode')
        expect((error as ReadOnlyModeError).path).toContain('/v2/bookings')
        expect((error as ReadOnlyModeError).detail).toHaveProperty('operation')
        expect((error as ReadOnlyModeError).detail).toHaveProperty('readOnlyMode', true)
      }
    })

    test('should provide helpful guidance in error message', async () => {
      try {
        await readOnlyClient.deleteBooking('booking-123')
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect((error as ReadOnlyModeError).message).toContain('LODGIFY_READ_ONLY=0')
        expect((error as ReadOnlyModeError).detail).toHaveProperty('suggestion')
      }
    })
  })

  describe('Read-Only Status Check', () => {
    test('should report read-only status correctly', () => {
      expect(readOnlyClient.isReadOnly()).toBe(true)
      expect(writeClient.isReadOnly()).toBe(false)
    })
  })

  describe('Environment Configuration', () => {
    test('should respect read-only configuration from constructor', () => {
      const customReadOnlyClient = new LodgifyOrchestrator({
        apiKey: 'test-key',
        readOnly: true,
      })

      const customWriteClient = new LodgifyOrchestrator({
        apiKey: 'test-key',
        readOnly: false,
      })

      expect(customReadOnlyClient.isReadOnly()).toBe(true)
      expect(customWriteClient.isReadOnly()).toBe(false)
    })

    test('should default to write mode when readOnly not specified', () => {
      const defaultClient = new LodgifyOrchestrator({
        apiKey: 'test-key',
      })

      expect(defaultClient.isReadOnly()).toBe(false)
    })
  })

  describe('All Write Operations Coverage', () => {
    const writeOperations = [
      {
        name: 'createBooking',
        args: [
          {
            propertyId: '123',
            checkIn: '2025-11-20',
            checkOut: '2025-11-25',
            guest: {
              name: 'John Doe',
              email: 'john@example.com',
            },
            guestBreakdown: { adults: 2 },
          },
        ],
      },
      { name: 'updateBooking', args: ['booking-123', { guestBreakdown: { adults: 3 } }] },
      { name: 'deleteBooking', args: ['booking-123'] },
      {
        name: 'subscribeWebhook',
        args: [{ event: 'booking_new_any_status', target_url: 'https://example.com/webhook' }],
      },
      { name: 'updateKeyCodes', args: ['booking-123', { keyCodes: ['1234'] }] },
      { name: 'createBookingPaymentLink', args: ['booking-123', { amount: 100, currency: 'USD' }] },
      { name: 'checkinBooking', args: ['booking-123'] },
      { name: 'checkoutBooking', args: ['booking-123'] },
      { name: 'deleteWebhook', args: ['webhook-123'] },
      { name: 'updateBookingV1', args: ['booking-123', { guest_name: 'Jane Doe' }] },
      { name: 'deleteBookingV1', args: ['booking-123'] },
    ]

    test.each(writeOperations)('should block $name in read-only mode', async ({ name, args }) => {
      const method = (
        readOnlyClient as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
      )[name]
      await expect(method.apply(readOnlyClient, args)).rejects.toThrow(ReadOnlyModeError)
    })

    test.each(writeOperations)('should allow $name in write mode', async ({ name, args }) => {
      const method = (
        writeClient as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>
      )[name]
      await expect(method.apply(writeClient, args)).resolves.toBeDefined()
    })
  })
})
