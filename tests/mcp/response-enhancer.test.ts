/**
 * Tests for Response Enhancer Utility
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Logger } from 'pino'

// Create a mock for safeLogger
const mockWarn = mock(() => {})
const mockSafeLogger = {
  error: mock(() => {}),
  warn: mockWarn,
  info: mock(() => {}),
  debug: mock(() => {}),
  debugHttp: mock(() => {}),
}

// Mock the logger module before importing anything that uses it
mock.module('../../src/logger', () => ({
  safeLogger: mockSafeLogger,
  logger: {} as Logger,
  SafeLogger: class {},
  createChildLogger: () => mockSafeLogger,
}))

import {
  calculateNights,
  type EnhanceOptions,
  type EntityType,
  enhanceResponse,
  extractEntityDetails,
  formatCurrency,
  formatDate,
  formatMcpResponse,
  isApiResponseData,
  toApiResponseData,
} from '../../src/mcp/utils/response/index'

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

    it('should format expanded currency list correctly', () => {
      // Test both Intl-supported and fallback currencies
      // Note: Intl.NumberFormat support varies by environment

      // Major currencies with well-known symbols
      expect(formatCurrency(1000, 'INR')).toBe('₹1,000.00')
      expect(formatCurrency(1000, 'KRW')).toMatch(/₩1,000/) // KRW doesn't use decimals
      expect(formatCurrency(1000, 'JPY')).toMatch(/¥1,000/) // JPY doesn't use decimals

      // Asian currencies - Intl may return code or symbol depending on environment
      // Note: Intl.NumberFormat may use non-breaking spaces (\u00A0) instead of regular spaces
      expect(formatCurrency(1000, 'THB')).toMatch(/THB[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'SGD')).toMatch(/SGD[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'HKD')).toBe('HK$1,000.00')
      expect(formatCurrency(1000, 'TWD')).toBe('NT$1,000.00')
      expect(formatCurrency(1000, 'PHP')).toBe('₱1,000.00')
      expect(formatCurrency(1000, 'IDR')).toMatch(/IDR[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'MYR')).toMatch(/MYR[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'VND')).toMatch(/₫1,000|VND/)

      // Commonwealth currencies - AUD and CAD work with Intl
      expect(formatCurrency(1000, 'AUD')).toMatch(/A?\$1,000.00/)
      expect(formatCurrency(1000, 'CAD')).toMatch(/C?\$1,000.00/)
      expect(formatCurrency(1000, 'NZD')).toBe('NZ$1,000.00')

      // European currencies - Most work with Intl
      expect(formatCurrency(1000, 'CHF')).toMatch(/1,000/) // CHF formatting varies
      expect(formatCurrency(1000, 'SEK')).toMatch(/1,000/) // SEK formatting varies
      expect(formatCurrency(1000, 'NOK')).toMatch(/1,000/) // NOK formatting varies
      expect(formatCurrency(1000, 'DKK')).toMatch(/1,000/) // DKK formatting varies
      expect(formatCurrency(1000, 'PLN')).toMatch(/1,000/) // PLN formatting varies
      expect(formatCurrency(1000, 'CZK')).toMatch(/1,000/) // CZK formatting varies
      expect(formatCurrency(1000, 'HUF')).toMatch(/1,000/) // HUF formatting varies

      // Middle East & Africa - Most are recognized but return code instead of symbol
      // Note: May have non-breaking spaces from Intl.NumberFormat
      expect(formatCurrency(1000, 'AED')).toMatch(/AED[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'SAR')).toMatch(/SAR[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'ILS')).toMatch(/1,000/) // ILS may be supported by Intl
      expect(formatCurrency(1000, 'ZAR')).toMatch(/ZAR[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'EGP')).toMatch(/EGP[\s\u00A0]1,000\.00/)

      // Americas - Most are recognized by Intl but formatting varies
      expect(formatCurrency(1000, 'BRL')).toMatch(/1,000/) // BRL formatting varies
      expect(formatCurrency(1000, 'MXN')).toMatch(/1,000/) // MXN formatting varies
      expect(formatCurrency(1000, 'ARS')).toMatch(/ARS[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'COP')).toMatch(/COP[\s\u00A0]1,000\.00/)
      expect(formatCurrency(1000, 'CLP')).toMatch(/CLP[\s\u00A0]1,000/)
      expect(formatCurrency(1000, 'PEN')).toMatch(/PEN[\s\u00A0]1,000/)

      // Other currencies - Most are recognized by Intl
      expect(formatCurrency(1000, 'RUB')).toMatch(/1,000/) // RUB formatting varies
      expect(formatCurrency(1000, 'TRY')).toMatch(/1,000/) // TRY formatting varies
      expect(formatCurrency(1000, 'UAH')).toMatch(/UAH[\s\u00A0]1,000\.00/)
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

    it('should handle timezone edge cases correctly', () => {
      // Test with ISO 8601 dates that include time components
      expect(calculateNights('2024-03-15T23:59:59Z', '2024-03-20T00:00:01Z')).toBe(5)
      expect(calculateNights('2024-03-15T00:00:01Z', '2024-03-16T23:59:59Z')).toBe(1)

      // Test with dates across timezone boundaries
      // Note: This date range actually represents March 16 01:00 UTC to March 19 23:00 UTC = 3 nights
      expect(calculateNights('2024-03-15T20:00:00-05:00', '2024-03-19T23:00:00+00:00')).toBe(3)

      // Test that it returns 0 for same day regardless of time
      expect(calculateNights('2024-03-15T00:00:00Z', '2024-03-15T23:59:59Z')).toBe(0)
    })

    it('should ensure non-negative results', () => {
      // Test that reversed dates return 0, not negative
      expect(calculateNights('2024-03-20', '2024-03-15')).toBe(0)
      expect(calculateNights('2024-03-16', '2024-03-15')).toBe(0)
    })

    it('should handle cross-month and cross-year calculations', () => {
      // Cross-month
      expect(calculateNights('2024-02-28', '2024-03-01')).toBe(2) // Leap year
      expect(calculateNights('2023-02-28', '2023-03-01')).toBe(1) // Non-leap year

      // Cross-year
      expect(calculateNights('2023-12-30', '2024-01-02')).toBe(3)
      expect(calculateNights('2023-12-31', '2024-01-01')).toBe(1)
    })
  })

  describe('extractEntityDetails', () => {
    it('should extract booking details correctly', () => {
      const apiData = {
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

      const details = extractEntityDetails('booking', apiData)

      expect(details.bookingId).toBe('123')
      expect(details.guest).toBe('John Doe')
      expect(details.checkIn).toBe('March 15, 2024')
      expect(details.checkOut).toBe('March 20, 2024')
      expect(details.nights).toBe(5)
      expect(details.totalGuests).toBe(3)
    })

    it('should extract payment link details correctly', () => {
      const apiData = {
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

      const details = extractEntityDetails('payment_link', apiData, inputParams)

      expect(details.bookingId).toBe('booking-789')
      expect(details.amount).toBe('€500.00')
      expect(details.paymentUrl).toBe('https://pay.lodgify.com/xyz')
      expect(details.description).toBe('Deposit payment')
    })

    it('should extract quote details with special bookingId handling', () => {
      const apiData = {
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

      const details = extractEntityDetails('quote', apiData, inputParams)

      // Should prefer bookingId from inputParams over apiData.id
      expect(details.bookingId).toBe('BK789')
      expect(details.quoteId).toBe('quote_123')
      expect(details.totalPrice).toBe('$2,000.00')
      expect(details.validUntil).toContain('April 15, 2024')
    })

    it('should extract rate details correctly', () => {
      const apiData = {}

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

      const details = extractEntityDetails('rate', apiData, inputParams)

      expect(details.property).toBe('Property 123')
      expect(details.ratesUpdated).toBe(1)
      expect(details.dateRange).toContain('June 1, 2024')
      expect(details.pricePerDay).toBe('$150.00')
      expect(details.minimumStay).toBe('3 nights')
    })

    it('should extract webhook details correctly', () => {
      const apiData = {
        id: 'webhook_123',
        status: 'active',
        createdAt: '2024-03-15T10:00:00Z',
      }

      const inputParams = {
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhooks',
      }

      const details = extractEntityDetails('webhook', apiData, inputParams)

      expect(details.webhookId).toBe('webhook_123')
      expect(details.event).toBe('booking_new_status_booked')
      expect(details.targetUrl).toBe('https://example.com/webhooks')
      expect(details.status).toBe('active')
    })

    it('should extract thread details correctly', () => {
      const apiData = {
        threadId: 'thread_456',
      }

      const inputParams = {
        threadGuid: 'thread_123',
        action: 'marked_read',
      }

      const details = extractEntityDetails('thread', apiData, inputParams)

      // Should prefer inputParams.threadGuid over apiData.threadId
      expect(details.threadId).toBe('thread_123')
      expect(details.action).toBe('marked_read')
    })

    it('should extract key_codes details correctly', () => {
      const apiData = {
        bookingId: 'booking_456',
      }

      const inputParams = {
        id: 'booking_123',
        payload: {
          keyCodes: ['1234', '5678', 'ABCD'],
        },
      }

      const details = extractEntityDetails('key_codes', apiData, inputParams)

      // Should prefer inputParams.id over apiData.bookingId
      expect(details.bookingId).toBe('booking_123')
      expect(details.codesUpdated).toBe(3)
      expect(details.codes).toEqual(['1234', '5678', 'ABCD'])
    })

    it('should handle generic entity type with default extraction', () => {
      const apiData = {
        id: 999,
        name: 'Generic Entity',
        status: 'active',
        someOtherField: 'ignored',
      }

      // Use type assertion to test default case without 'any'
      const details = extractEntityDetails('unknown_type' as EntityType, apiData)

      expect(details.id).toBe('999')
      expect(details.name).toBe('Generic Entity')
      expect(details.status).toBe('active')
      expect(details.someOtherField).toBeUndefined()
    })

    it('should handle numeric IDs correctly', () => {
      const apiData = {
        id: 12345,
        bookingId: 67890,
        property_id: 111,
      }

      const details = extractEntityDetails('booking', apiData)

      // Should convert numeric IDs to strings
      expect(details.bookingId).toBe('12345')
      expect(details.propertyId).toBe('111')
    })

    it('should handle missing data gracefully', () => {
      const apiData = {}
      const inputParams = {}

      // Test each entity type with empty data
      const bookingDetails = extractEntityDetails('booking', apiData, inputParams)
      expect(bookingDetails).toBeDefined()
      // nights may be undefined when dates are missing
      expect(bookingDetails.nights).toBeUndefined()

      const rateDetails = extractEntityDetails('rate', apiData, inputParams)
      expect(rateDetails).toBeDefined()
      // ratesUpdated will be undefined when rates array is missing
      expect(rateDetails.ratesUpdated).toBeUndefined()

      const threadDetails = extractEntityDetails('thread', apiData, inputParams)
      expect(threadDetails).toBeDefined()
      expect(threadDetails.action).toBe('updated')

      const keyCodeDetails = extractEntityDetails('key_codes', apiData, inputParams)
      expect(keyCodeDetails).toBeDefined()
      expect(keyCodeDetails.codesUpdated).toBe(0)
      expect(keyCodeDetails.codes).toEqual([])
    })

    it('should extract vacant inventory details correctly', () => {
      const apiData = {
        from: '2025-03-01',
        to: '2025-03-07',
        counts: {
          propertiesRequested: 10,
          propertiesFound: 8,
          propertiesChecked: 7,
          availableProperties: 5,
        },
        properties: [
          { id: '101', name: 'Beach House', available: true, rooms: [] },
          {
            id: '102',
            name: 'Mountain Cabin',
            available: true,
            rooms: [
              { id: 'r1', available: true },
              { id: 'r2', available: false },
            ],
          },
          { id: '103', name: 'City Apt', available: false, rooms: [] },
        ],
        diagnostics: {
          apiCalls: [
            { endpoint: '/properties', itemsFound: 10 },
            { endpoint: '/availability', itemsFound: 7 },
          ],
          possibleIssues: ['API rate limit warning'],
        },
      }

      const inputParams = {
        from: '2025-03-01',
        to: '2025-03-07',
        propertyIds: ['101', '102', '103'],
        includeRooms: true,
      }

      const details = extractEntityDetails('vacant_inventory', apiData, inputParams)

      // Date range
      expect(details.dateRange).toBe('March 1, 2025 to March 7, 2025')
      expect(details.from).toBe('March 1, 2025')
      expect(details.to).toBe('March 7, 2025')

      // Counts
      expect(details.propertiesRequested).toBe(10)
      expect(details.propertiesFound).toBe(8)
      expect(details.propertiesChecked).toBe(7)
      expect(details.availableProperties).toBe(5)
      expect(details.vacantCount).toBe(5)
      expect(details.propertiesReturned).toBe(3)

      // Room details
      expect(details.includesRoomDetails).toBe(true)
      expect(details.totalRooms).toBe(2)
      expect(details.availableRooms).toBe(1)

      // Diagnostics
      expect(details.hasDiagnostics).toBe(true)
      expect(details.apiCallsCount).toBe(2)
      expect(details.issuesIdentified).toBe(1)

      // Search filters
      expect(details.filteredByPropertyIds).toBe(3)
      expect(details.roomDetailsRequested).toBe(true)
    })

    it('should handle vacant inventory with no available properties', () => {
      const apiData = {
        from: '2025-04-01',
        to: '2025-04-05',
        counts: {
          propertiesChecked: 5,
          availableProperties: 0,
        },
        properties: [],
      }

      const inputParams = {
        from: '2025-04-01',
        to: '2025-04-05',
      }

      const details = extractEntityDetails('vacant_inventory', apiData, inputParams)

      expect(details.propertiesChecked).toBe(5)
      expect(details.availableProperties).toBe(0)
      expect(details.vacantCount).toBe(0)
      expect(details.propertiesReturned).toBe(0)
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

    it('should enhance vacant inventory response with available properties', () => {
      const data = {
        from: '2025-05-01',
        to: '2025-05-07',
        counts: {
          propertiesChecked: 10,
          availableProperties: 7,
          unavailableProperties: 3,
        },
        properties: [
          { id: '201', name: 'Villa 1', available: true },
          { id: '202', name: 'Villa 2', available: true },
          { id: '203', name: 'Villa 3', available: false },
        ],
      }

      const inputParams = {
        from: '2025-05-01',
        to: '2025-05-07',
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'vacant_inventory',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.operation.type).toBe('read')
      expect(enhanced.operation.entity).toBe('vacant_inventory')
      expect(enhanced.operation.status).toBe('success')
      expect(enhanced.summary).toContain('Found 7 vacant properties')
      expect(enhanced.details.propertiesChecked).toBe(10)
      expect(enhanced.details.vacantCount).toBe(7)
      expect(enhanced.suggestions?.length).toBeGreaterThan(0)
      expect(enhanced.data).toEqual(data)
    })

    it('should enhance vacant inventory response with no available properties', () => {
      const data = {
        counts: {
          propertiesChecked: 5,
          availableProperties: 0,
        },
        properties: [],
      }

      const inputParams = {
        from: '2025-06-01',
        to: '2025-06-10',
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'vacant_inventory',
        inputParams,
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.summary).toContain('No vacant properties found')
      expect(enhanced.details.vacantCount).toBe(0)
      expect(enhanced.suggestions?.length).toBeGreaterThan(0)
      expect(enhanced.suggestions?.[0]).toContain('No properties are vacant')
    })

    it('should handle vacant inventory with diagnostics and issues', () => {
      const data = {
        counts: {
          propertiesChecked: 0,
          availableProperties: 0,
        },
        properties: [],
        diagnostics: {
          apiCalls: [{ endpoint: '/properties', error: 'Connection timeout' }],
          possibleIssues: ['API connection failed', 'Check API credentials'],
        },
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'vacant_inventory',
        status: 'failed',
        inputParams: {},
      }

      const enhanced = enhanceResponse(data, options)

      expect(enhanced.operation.status).toBe('failed')
      expect(enhanced.summary).toContain('Failed to retrieve vacant inventory')
      expect(enhanced.details.hasDiagnostics).toBe(true)
      expect(enhanced.details.issuesIdentified).toBe(2)
      expect(enhanced.suggestions?.length).toBeGreaterThan(0)
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

  describe('isApiResponseData', () => {
    it('should return true for valid objects', () => {
      expect(isApiResponseData({})).toBe(true)
      expect(isApiResponseData({ id: 123 })).toBe(true)
      expect(isApiResponseData({ nested: { key: 'value' } })).toBe(true)
      expect(isApiResponseData({ multiple: 'keys', with: 123, values: true })).toBe(true)
    })

    it('should return false for null', () => {
      expect(isApiResponseData(null)).toBe(false)
    })

    it('should return false for arrays', () => {
      expect(isApiResponseData([])).toBe(false)
      expect(isApiResponseData([1, 2, 3])).toBe(false)
      expect(isApiResponseData(['a', 'b', 'c'])).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isApiResponseData(undefined)).toBe(false)
      expect(isApiResponseData(123)).toBe(false)
      expect(isApiResponseData('string')).toBe(false)
      expect(isApiResponseData(true)).toBe(false)
      expect(isApiResponseData(false)).toBe(false)
      expect(isApiResponseData(Symbol('test'))).toBe(false)
    })
  })

  describe('toApiResponseData', () => {
    beforeEach(() => {
      // Clear all mock calls before each test
      mockWarn.mockClear()
    })

    it('should return valid objects unchanged', () => {
      const obj = { id: 123, name: 'test' }
      expect(toApiResponseData(obj)).toBe(obj)
      expect(mockWarn).not.toHaveBeenCalled()
    })

    it('should convert null to empty object and log warning', () => {
      const result = toApiResponseData(null)
      expect(result).toEqual({})
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'unknown',
        expected: 'object',
        actualType: 'object', // null is typeof 'object'
        fallbackUsed: true,
      })
    })

    it('should convert undefined to empty object and log warning', () => {
      const result = toApiResponseData(undefined)
      expect(result).toEqual({})
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'unknown',
        expected: 'object',
        actualType: 'undefined',
        fallbackUsed: true,
      })
    })

    it('should convert arrays to empty object and log warning', () => {
      const result = toApiResponseData([1, 2, 3])
      expect(result).toEqual({})
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'unknown',
        expected: 'object',
        actualType: 'array',
        fallbackUsed: true,
      })
    })

    it('should convert primitives to empty object and log warning', () => {
      const result = toApiResponseData(123)
      expect(result).toEqual({})
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'unknown',
        expected: 'object',
        actualType: 'number',
        fallbackUsed: true,
      })
    })

    it('should include context in warning message when provided', () => {
      toApiResponseData('invalid', 'create booking')
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'create booking',
        expected: 'object',
        actualType: 'string',
        fallbackUsed: true,
      })
    })
  })

  describe('enhanceResponse with invalid data', () => {
    beforeEach(() => {
      // Clear all mock calls before each test
      mockWarn.mockClear()
    })

    it('should handle null data gracefully', () => {
      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'booking',
      }

      const enhanced = enhanceResponse(null, options)

      expect(enhanced).toBeDefined()
      expect(enhanced.data).toEqual({})
      expect(enhanced.operation.status).toBe('success')
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'create booking',
        expected: 'object',
        actualType: 'object', // null is typeof 'object'
        fallbackUsed: true,
      })
    })

    it('should handle array data gracefully', () => {
      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'booking',
      }

      const enhanced = enhanceResponse([1, 2, 3], options)

      expect(enhanced).toBeDefined()
      expect(enhanced.data).toEqual({})
      expect(enhanced.operation.status).toBe('success')
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'read booking',
        expected: 'object',
        actualType: 'array',
        fallbackUsed: true,
      })
    })

    it('should handle primitive data gracefully', () => {
      const options: EnhanceOptions = {
        operationType: 'update',
        entityType: 'rate',
      }

      const enhanced = enhanceResponse('string value', options)

      expect(enhanced).toBeDefined()
      expect(enhanced.data).toEqual({})
      expect(enhanced.operation.status).toBe('success')
      expect(mockWarn).toHaveBeenCalledTimes(1)
      expect(mockWarn).toHaveBeenCalledWith('Invalid data type for ApiResponseData', {
        context: 'update rate',
        expected: 'object',
        actualType: 'string',
        fallbackUsed: true,
      })
    })
  })
})
