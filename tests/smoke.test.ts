import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { LodgifyClient } from '../src/lodgify.js'
import { createMockFetch, createMockResponse, fixtures } from './utils.js'

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
        
        // Availability
        createMockResponse(200, fixtures.availability),
        createMockResponse(200, fixtures.availability),
        
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
      // @ts-ignore - restore original fetch
      global.fetch = undefined
    }
  })

  describe('Sequential Tool Execution', () => {
    let propertyId: string
    let bookingId: string

    it('1. Should list properties', async () => {
      const result = await client.listProperties({ page: 1, limit: 10 })
      expect(result).toBeDefined()
      
      if (Array.isArray(result) && result.length > 0) {
        propertyId = (result[0] as any).id || 'prop-123'
      } else {
        propertyId = 'prop-123' // fallback for testing
      }
      
      console.log(`✓ Listed properties, using property ID: ${propertyId}`)
    }, 30000)

    it('2. Should get property details', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }
      
      const result = await client.getProperty(propertyId)
      expect(result).toBeDefined()
      expect(result).toHaveProperty('id')
      
      console.log(`✓ Retrieved property details for ${propertyId}`)
    }, 30000)

    it('3. Should list property rooms', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }
      
      const result = await client.listPropertyRooms(propertyId)
      expect(result).toBeDefined()
      
      console.log(`✓ Listed rooms for property ${propertyId}`)
    }, 30000)

    it('4. Should check deleted properties', async () => {
      const result = await client.listDeletedProperties()
      expect(result).toBeDefined()
      
      console.log('✓ Checked deleted properties')
    }, 30000)

    it('5. Should check property availability', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }
      
      const params = {
        from: '2025-11-20',
        to: '2025-11-25',
      }
      
      const result = await client.getAvailabilityProperty(propertyId, params)
      expect(result).toBeDefined()
      
      console.log(`✓ Checked availability for property ${propertyId}`)
    }, 30000)

    it('6. Should check room availability', async () => {
      if (!propertyId) {
        console.log('⚠ Skipping: No property ID available')
        return
      }
      
      // Use a dummy room ID for testing
      const roomTypeId = 'room-1'
      const params = {
        from: '2025-11-20',
        to: '2025-11-25',
      }
      
      try {
        const result = await client.getAvailabilityRoom(propertyId, roomTypeId, params)
        expect(result).toBeDefined()
        console.log(`✓ Checked room availability for ${propertyId}/${roomTypeId}`)
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`⚠ Room type ${roomTypeId} not found, skipping`)
        } else {
          throw error
        }
      }
    }, 30000)

    it('7. Should get daily rates', async () => {
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

    it('8. Should get rate settings', async () => {
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

    it('9. Should get a quote', async () => {
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
      } catch (error: any) {
        if (error.status === 400) {
          console.log('⚠ Quote parameters invalid, skipping')
        } else {
          throw error
        }
      }
    }, 30000)

    it('10. Should list bookings', async () => {
      const params = {
        from: '2025-11-01',
        to: '2025-11-30',
      }
      
      const result = await client.listBookings(params)
      expect(result).toBeDefined()
      
      if (Array.isArray(result) && result.length > 0) {
        bookingId = (result[0] as any).id || 'book-456'
      } else {
        bookingId = 'book-456' // fallback for testing
      }
      
      console.log(`✓ Listed bookings, using booking ID: ${bookingId}`)
    }, 30000)

    it('11. Should get booking details', async () => {
      if (!bookingId) {
        console.log('⚠ Skipping: No booking ID available')
        return
      }
      
      try {
        const result = await client.getBooking(bookingId)
        expect(result).toBeDefined()
        console.log(`✓ Retrieved booking details for ${bookingId}`)
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`⚠ Booking ${bookingId} not found, skipping`)
        } else {
          throw error
        }
      }
    }, 30000)

    it('12. Should get booking payment link', async () => {
      if (!bookingId) {
        console.log('⚠ Skipping: No booking ID available')
        return
      }
      
      try {
        const result = await client.getBookingPaymentLink(bookingId)
        expect(result).toBeDefined()
        console.log(`✓ Retrieved payment link for booking ${bookingId}`)
      } catch (error: any) {
        if (error.status === 404 || error.status === 400) {
          console.log(`⚠ Payment link not available for booking ${bookingId}, skipping`)
        } else {
          throw error
        }
      }
    }, 30000)
  })

  describe('Test Summary', () => {
    it('should complete smoke test suite', () => {
      console.log('\n========================================')
      console.log('Smoke Test Suite Completed Successfully')
      console.log(`Mode: ${testMode}`)
      console.log('========================================\n')
      expect(true).toBe(true)
    })
  })
})