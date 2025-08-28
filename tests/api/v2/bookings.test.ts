import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { BaseApiClient } from '../../../src/api/base-client.js'
import { BookingsClient } from '../../../src/api/v2/bookings/index.js'
import type {
  Booking,
  CreateBookingRequest,
  PaymentLinkRequest,
  QuoteRequest,
  UpdateBookingRequest,
} from '../../../src/api/v2/bookings/types.js'

// Test client implementation
class TestApiClient extends BaseApiClient {
  constructor() {
    super('test-api-key')
  }
}

describe('BookingsClient', () => {
  let client: TestApiClient
  let bookingsClient: BookingsClient
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new TestApiClient()
    bookingsClient = new BookingsClient(client)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('listBookings', () => {
    test('should list bookings with proper response format', async () => {
      const mockBookings: Booking[] = [
        {
          id: '1',
          propertyId: '123',
          propertyName: 'Beach House',
          status: 'confirmed',
          checkIn: '2024-03-01',
          checkOut: '2024-03-05',
          guest: { name: 'John Doe', email: 'john@example.com' },
          guestBreakdown: { adults: 2, children: 0 },
        },
        {
          id: '2',
          propertyId: '124',
          propertyName: 'Mountain Cabin',
          status: 'booked',
          checkIn: '2024-03-10',
          checkOut: '2024-03-15',
          guest: { name: 'Jane Smith', email: 'jane@example.com' },
          guestBreakdown: { adults: 2, children: 2 },
        },
      ]

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockBookings), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.listBookings()

      expect(result).toEqual({
        data: mockBookings,
        count: 2,
      })
    })

    test('should pass search parameters', async () => {
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )
      global.fetch = mockFetch

      await bookingsClient.listBookings({
        propertyId: '123',
        status: 'confirmed',
        checkInFrom: '2024-03-01',
        checkInTo: '2024-03-31',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/reservations/bookings'),
        expect.anything(),
      )
    })
  })

  describe('getBooking', () => {
    test('should get booking by ID', async () => {
      const mockBooking: Booking = {
        id: '123',
        propertyId: '456',
        propertyName: 'Ocean Villa',
        status: 'confirmed',
        checkIn: '2024-03-15',
        checkOut: '2024-03-22',
        nights: 7,
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        guestBreakdown: { adults: 2, children: 1 },
        price: 1750,
        currency: 'USD',
        paymentStatus: 'paid',
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockBooking), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.getBooking('123')

      expect(result).toEqual(mockBooking)
    })

    test('should throw error if ID is missing', async () => {
      await expect(bookingsClient.getBooking('')).rejects.toThrow('Booking ID is required')
    })
  })

  describe('createBooking', () => {
    test('should create a new booking', async () => {
      const createRequest: CreateBookingRequest = {
        propertyId: '123',
        checkIn: '2024-03-15',
        checkOut: '2024-03-22',
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        guestBreakdown: {
          adults: 2,
          children: 0,
        },
        status: 'confirmed',
      }

      const mockResponse: Booking = {
        id: 'BK001',
        ...createRequest,
        propertyName: 'Beach House',
        nights: 7,
        price: 1400,
        currency: 'USD',
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.createBooking(createRequest)

      expect(result).toEqual(mockResponse)
    })

    test('should validate required fields', async () => {
      await expect(
        bookingsClient.createBooking({
          propertyId: '',
          checkIn: '2024-03-15',
          checkOut: '2024-03-22',
          guest: { name: 'John' },
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow('Property ID is required')

      await expect(
        bookingsClient.createBooking({
          propertyId: '123',
          checkIn: '',
          checkOut: '2024-03-22',
          guest: { name: 'John' },
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow('Check-in and check-out dates are required')

      await expect(
        bookingsClient.createBooking({
          propertyId: '123',
          checkIn: '2024-03-15',
          checkOut: '2024-03-22',
          guest: { name: '' },
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow('Guest name is required')

      await expect(
        bookingsClient.createBooking({
          propertyId: '123',
          checkIn: '2024-03-15',
          checkOut: '2024-03-22',
          guest: { name: 'John' },
          guestBreakdown: { adults: 0 },
        }),
      ).rejects.toThrow('At least one adult guest is required')
    })
  })

  describe('updateBooking', () => {
    test('should update an existing booking', async () => {
      const updates: UpdateBookingRequest = {
        checkOut: '2024-03-25',
        guestBreakdown: { adults: 3 },
        notes: 'Late checkout requested',
      }

      const mockResponse: Booking = {
        id: '123',
        propertyId: '456',
        status: 'confirmed',
        checkIn: '2024-03-15',
        checkOut: '2024-03-25',
        guest: { name: 'John Doe' },
        guestBreakdown: { adults: 3 },
        notes: 'Late checkout requested',
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.updateBooking('123', updates)

      expect(result).toEqual(mockResponse)
    })

    test('should throw error if ID is missing', async () => {
      await expect(bookingsClient.updateBooking('', {})).rejects.toThrow('Booking ID is required')
    })
  })

  describe('deleteBooking', () => {
    test('should delete a booking successfully', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(null, {
            status: 204,
            headers: new Headers(),
          }),
        ),
      )

      const result = await bookingsClient.deleteBooking('123')

      expect(result).toEqual({
        success: true,
        message: 'Booking 123 has been cancelled',
      })
    })

    test('should handle deletion error', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')))

      const result = await bookingsClient.deleteBooking('123')

      expect(result).toEqual({
        success: false,
        message: 'Network error',
      })
    })

    test('should throw error if ID is missing', async () => {
      await expect(bookingsClient.deleteBooking('')).rejects.toThrow('Booking ID is required')
    })
  })

  describe('payment link operations', () => {
    test('should get payment link for booking', async () => {
      const mockPaymentLink = {
        id: 'PL001',
        url: 'https://pay.lodgify.com/link/PL001',
        amount: 500,
        currency: 'USD',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockPaymentLink), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.getBookingPaymentLink('123')

      expect(result).toEqual(mockPaymentLink)
    })

    test('should create payment link for booking', async () => {
      const paymentRequest: PaymentLinkRequest = {
        amount: 750,
        currency: 'EUR',
        description: 'Final payment for booking',
      }

      const mockResponse = {
        id: 'PL002',
        url: 'https://pay.lodgify.com/link/PL002',
        amount: 750,
        currency: 'EUR',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.createBookingPaymentLink('123', paymentRequest)

      expect(result).toEqual(mockResponse)
    })

    test('should validate payment link creation', async () => {
      await expect(
        bookingsClient.createBookingPaymentLink('', { amount: 100, currency: 'USD' }),
      ).rejects.toThrow('Booking ID is required')

      await expect(
        bookingsClient.createBookingPaymentLink('123', { amount: 0, currency: 'USD' }),
      ).rejects.toThrow('Valid payment amount is required')

      await expect(
        bookingsClient.createBookingPaymentLink('123', { amount: 100, currency: '' }),
      ).rejects.toThrow('Currency is required')
    })
  })

  describe('updateKeyCodes', () => {
    test('should update key codes for booking', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.updateKeyCodes('123', {
        keyCodes: ['1234', '5678'],
        instructions: 'Use main door keypad',
      })

      expect(result).toEqual({ success: true })
    })

    test('should validate key codes', async () => {
      await expect(bookingsClient.updateKeyCodes('', { keyCodes: ['1234'] })).rejects.toThrow(
        'Booking ID is required',
      )

      await expect(bookingsClient.updateKeyCodes('123', { keyCodes: [] })).rejects.toThrow(
        'At least one key code is required',
      )
    })
  })

  describe('getQuote', () => {
    test('should get quote for booking', async () => {
      const quoteRequest: Omit<QuoteRequest, 'propertyId'> = {
        checkIn: '2024-03-15',
        checkOut: '2024-03-22',
        guestBreakdown: { adults: 2, children: 1 },
        roomTypes: [{ id: '101', quantity: 1 }],
      }

      const mockQuote = {
        propertyId: '123',
        checkIn: '2024-03-15',
        checkOut: '2024-03-22',
        nights: 7,
        priceBreakdown: {
          basePrice: 1400,
          cleaningFee: 100,
          taxes: 150,
          total: 1650,
          currency: 'USD',
        },
        availability: true,
        minStay: 3,
        maxStay: 30,
      }

      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockQuote), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      const result = await bookingsClient.getQuote('123', quoteRequest)

      expect(result).toEqual(mockQuote)
    })

    test('should validate quote request', async () => {
      await expect(
        bookingsClient.getQuote('', {
          checkIn: '2024-03-15',
          checkOut: '2024-03-22',
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow('Property ID is required')

      await expect(
        bookingsClient.getQuote('123', {
          checkIn: '',
          checkOut: '2024-03-22',
          guestBreakdown: { adults: 2 },
        }),
      ).rejects.toThrow('Check-in and check-out dates are required')

      await expect(
        bookingsClient.getQuote('123', {
          checkIn: '2024-03-15',
          checkOut: '2024-03-22',
          guestBreakdown: { adults: 0 },
        }),
      ).rejects.toThrow('At least one adult guest is required')
    })
  })

  describe('helper methods', () => {
    test('searchBookings should search with criteria', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      await bookingsClient.searchBookings({
        guestName: 'John',
        propertyId: '123',
        dateRange: { from: '2024-03-01', to: '2024-03-31' },
        status: 'confirmed',
      })

      expect(global.fetch).toHaveBeenCalled()
    })

    test('getUpcomingBookings should get future bookings', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      await bookingsClient.getUpcomingBookings('123', 5)

      expect(global.fetch).toHaveBeenCalled()
    })

    test('getBookingsForDateRange should get bookings in range', async () => {
      global.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          }),
        ),
      )

      await bookingsClient.getBookingsForDateRange('2024-03-01', '2024-03-31', '123')

      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
