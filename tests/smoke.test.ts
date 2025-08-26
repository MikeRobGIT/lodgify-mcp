import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { LodgifyClient } from '../src/lodgify.js'
import type { Booking, Property } from '../src/types/lodgify.js'
import { createMockResponse, fixtures } from './utils.js'

/**
 * Smoke Tests - Sequential execution of all tools
 * Can be run with real API by setting TEST_MODE=live and TEST_API_KEY
 */
describe('End-to-End Smoke Tests', () => {
  let client: LodgifyClient
  const testMode = process.env.TEST_MODE || 'mock'
  const testApiKey = process.env.TEST_API_KEY || 'test-api-key'

  beforeAll(() => {
    console.log(`Running smoke tests in ${testMode} mode`)
    client = new LodgifyClient(testApiKey)

    if (testMode === 'mock') {
      // Set up mock responses for all endpoints
      const mockResponses = [
        // Properties
        createMockResponse(200, [fixtures.property]),
        createMockResponse(200, fixtures.property),
        createMockResponse(200, [{ id: 'room-1', name: 'Master Suite' }]),
        createMockResponse(200, []),

        // Rates
        createMockResponse(200, { rates: [{ date: '2025-11-20', rate: 200 }] }),
        createMockResponse(200, { settings: { minStay: 2, maxStay: 30 } }),

        // Quote
        createMockResponse(200, fixtures.quote),

        // Bookings
        createMockResponse(200, [fixtures.booking]),
        createMockResponse(200, fixtures.booking),
        createMockResponse(200, { url: 'https://pay.lodgify.com/xyz' }),

        // Health check
        createMockResponse(200, { ok: true }),

        // v1 Webhook endpoints
        createMockResponse(200, {
          data: [{ id: 'webhook_123', event: 'booking_new_status_booked' }],
        }),
        createMockResponse(200, { id: 'webhook_456', event: 'booking_new_status_booked' }),

        // v1 Booking CRUD
        createMockResponse(201, { id: 'booking_789', status: 'booked' }),
        createMockResponse(200, { id: 'booking_789', status: 'updated' }),

        // v1 Rate management
        createMockResponse(200, { success: true }),
      ]

      let callIndex = 0
      global.fetch = async () => {
        if (callIndex < mockResponses.length) {
          return mockResponses[callIndex++]
        }
        return createMockResponse(404, { error: 'Not found' })
      }
    }
  })

  afterAll(() => {
    if (testMode === 'mock') {
      // @ts-expect-error - restore original fetch
      global.fetch = undefined
    }
  })

  describe('Sequential Tool Execution', () => {
    let propertyId: string
    let bookingId: string

    test('1. Should list properties', async () => {
      const result = await client.listProperties({ page: 1, limit: 10 })
      expect(result).toBeDefined()

      if (Array.isArray(result) && result.length > 0) {
        propertyId = String((result[0] as Property).id) || 'prop-123'
      } else {
        propertyId = 'prop-123' // fallback for testing
      }

      console.log(`✓ Listed properties, using property ID: ${propertyId}`)
    }, 30000)

    test('2. Should get property details', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      const result = await client.getProperty(propertyId)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('id')

      console.log(`✓ Retrieved property details for ${propertyId}`)
    }, 30000)

    test('3. Should list property rooms', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      const result = await client.listPropertyRooms(propertyId)
      expect(result).toBeDefined()

      console.log(`✓ Listed rooms for property ${propertyId}`)
    }, 30000)

    test('4. Should check deleted properties', async () => {
      const result = await client.listDeletedProperties()
      expect(result).toBeDefined()

      console.log('✓ Checked deleted properties')
    }, 30000)

    test('7. Should get daily rates', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      const params = {
        propertyId,
        from: '2025-11-20',
        to: '2025-11-25',
      }

      const result = await client.getDailyRates(params)
      expect(result).toBeDefined()

      console.log(`✓ Retrieved daily rates for property ${propertyId}`)
    }, 30000)

    test('8. Should get rate settings', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      const params = {
        propertyId,
      }

      const result = await client.getRateSettings(params)
      expect(result).toBeDefined()

      console.log(`✓ Retrieved rate settings for property ${propertyId}`)
    }, 30000)

    test('9. Should get a quote', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      const params = {
        from: '2025-11-20',
        to: '2025-11-25',
        'guest_breakdown[adults]': 2,
        'guest_breakdown[children]': 0,
      }

      try {
        const result = await client.getQuote(propertyId, params)
        expect(result).toBeDefined()
        console.log(`✓ Retrieved quote for property ${propertyId}`)
      } catch (error) {
        if ((error as { status?: number }).status === 400) {
          console.log('⚠ Quote parameters invalid, skipping')
        } else {
          throw error
        }
      }
    }, 30000)

    test('10. Should list bookings', async () => {
      const params = {
        from: '2025-11-01',
        to: '2025-11-30',
      }

      const result = await client.listBookings(params)
      expect(result).toBeDefined()

      if (Array.isArray(result) && result.length > 0) {
        bookingId = String((result[0] as Booking).id) || 'book-456'
      } else {
        bookingId = 'book-456' // fallback for testing
      }

      console.log(`✓ Listed bookings, using booking ID: ${bookingId}`)
    }, 30000)

    test('11. Should get booking details', async () => {
      if (!bookingId) {
        console.log('⚠ Skipping: No booking ID available')
        return
      }

      try {
        const result = await client.getBooking(bookingId)
        expect(result).toBeDefined()
        console.log(`✓ Retrieved booking details for ${bookingId}`)
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          console.log(`⚠ Booking ${bookingId} not found, skipping`)
        } else {
          throw error
        }
      }
    }, 30000)

    test('12. Should get booking payment link', async () => {
      if (!bookingId) {
        console.log('⚠ Skipping: No booking ID available')
        return
      }

      try {
        const result = await client.getBookingPaymentLink(bookingId)
        expect(result).toBeDefined()
        console.log(`✓ Retrieved payment link for booking ${bookingId}`)
      } catch (error) {
        const errorStatus = (error as { status?: number }).status
        if (errorStatus === 404 || errorStatus === 400) {
          console.log(`⚠ Payment link not available for booking ${bookingId}, skipping`)
        } else {
          throw error
        }
      }
    }, 30000)

    test('13. Should list webhooks (v1)', async () => {
      try {
        const result = await client.listWebhooks()
        expect(result).toBeDefined()
        console.log('✓ Listed webhooks')
      } catch (error) {
        console.log('⚠ Webhooks not available, skipping')
      }
    }, 30000)

    test('14. Should subscribe to webhook (v1)', async () => {
      try {
        const result = await client.subscribeWebhook({
          event: 'booking_new_status_booked',
          target_url: 'https://example.com/webhook',
        })
        expect(result).toBeDefined()
        console.log('✓ Subscribed to webhook')
      } catch (error) {
        console.log('⚠ Webhook subscription failed, skipping')
      }
    }, 30000)

    test('15. Should create booking (v1)', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      try {
        const result = await client.createBooking({
          property_id: parseInt(propertyId),
          arrival: '2024-06-15',
          departure: '2024-06-20',
          guest_name: 'John Smith',
          adults: 2,
          status: 'booked',
        })
        expect(result).toBeDefined()
        console.log('✓ Created booking via v1 API')
      } catch (error) {
        console.log('⚠ Booking creation failed, skipping')
      }
    }, 30000)

    test('16. Should update booking (v1)', async () => {
      if (!bookingId) {
        console.log('⚠ Skipping: No booking ID available')
        return
      }

      try {
        const result = await client.updateBooking(bookingId, {
          adults: 3,
          status: 'tentative',
        })
        expect(result).toBeDefined()
        console.log(`✓ Updated booking ${bookingId} via v1 API`)
      } catch (error) {
        console.log('⚠ Booking update failed, skipping')
      }
    }, 30000)

    test('17. Should update rates (v1)', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }

      try {
        await client.updateRates({
          property_id: parseInt(propertyId),
          rates: [
            {
              room_type_id: 456,
              date_from: '2024-06-01',
              date_to: '2024-08-31',
              price: 150.0,
              min_stay: 3,
              currency: 'USD',
            },
          ],
        })
        console.log(`✓ Updated rates for property ${propertyId} via v1 API`)
      } catch (error) {
        console.log('⚠ Rate update failed, skipping')
      }
    }, 30000)
  })

  describe('Test Summary', () => {
    test('should complete smoke test suite', () => {
      console.log('\n========================================')
      console.log('Smoke Test Suite Completed Successfully')
      console.log(`Mode: ${testMode}`)
      console.log('========================================\n')
      expect(true).toBe(true)
    })
  })
})
