import { beforeEach, describe, expect, test } from 'bun:test'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { createMockFetch, createMockResponse } from './utils.js'

describe('Query Parameter Flattening', () => {
  let client: LodgifyOrchestrator
  let mockFetch: ReturnType<typeof createMockFetch>

  beforeEach(() => {
    client = new LodgifyOrchestrator({ apiKey: 'test-api-key' })
    mockFetch = createMockFetch([
      createMockResponse(200, {
        property_id: 123,
        currency: 'USD',
        rates: [
          {
            date: '2025-11-20',
            rate: 150.0,
            available: true,
          },
        ],
      }),
    ])
    global.fetch = mockFetch
  })

  describe('Bracket notation handling', () => {
    test('should handle simple bracket notation', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        'roomTypes[0].Id': 999,
        'guest_breakdown[adults]': 2,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('roomTypes%5B0%5D.Id=999')
      expect(calledUrl).toContain('guest_breakdown%5Badults%5D=2')
    })

    test('should handle nested objects', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        guest_breakdown: {
          adults: 2,
          children: 1,
          infants: 0,
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('guest_breakdown%5Badults%5D=2')
      expect(calledUrl).toContain('guest_breakdown%5Bchildren%5D=1')
      expect(calledUrl).toContain('guest_breakdown%5Binfants%5D=0')
    })

    test('should handle arrays with objects', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        roomTypes: [
          { Id: 123, quantity: 1 },
          { Id: 456, quantity: 2 },
        ],
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('roomTypes%5B0%5D%5BId%5D=123')
      expect(calledUrl).toContain('roomTypes%5B0%5D%5Bquantity%5D=1')
      expect(calledUrl).toContain('roomTypes%5B1%5D%5BId%5D=456')
      expect(calledUrl).toContain('roomTypes%5B1%5D%5Bquantity%5D=2')
    })

    test('should handle arrays with primitive values', async () => {
      await client.properties.listProperties({
        propertyIds: [100, 200, 300],
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('propertyIds%5B0%5D=100')
      expect(calledUrl).toContain('propertyIds%5B1%5D=200')
      expect(calledUrl).toContain('propertyIds%5B2%5D=300')
    })

    test('should handle mixed bracket and object notation', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        from: '2025-11-20',
        to: '2025-11-25',
        'roomTypes[0].Id': 999,
        guest_breakdown: {
          adults: 2,
          children: 0,
        },
        addOns: ['BREAKFAST', 'PARKING'],
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('from=2025-11-20')
      expect(calledUrl).toContain('to=2025-11-25')
      expect(calledUrl).toContain('roomTypes%5B0%5D.Id=999')
      expect(calledUrl).toContain('guest_breakdown%5Badults%5D=2')
      expect(calledUrl).toContain('guest_breakdown%5Bchildren%5D=0')
      expect(calledUrl).toContain('addOns%5B0%5D=BREAKFAST')
      expect(calledUrl).toContain('addOns%5B1%5D=PARKING')
    })

    test('should handle deeply nested structures', async () => {
      await client.properties.listProperties({
        filters: {
          location: {
            country: 'US',
            city: 'New York',
            coordinates: {
              lat: 40.7128,
              lng: -74.006,
            },
          },
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('filters%5Blocation%5D%5Bcountry%5D=US')
      // URLSearchParams encodes spaces as + which is valid
      expect(calledUrl).toContain('filters%5Blocation%5D%5Bcity%5D=New+York')
      expect(calledUrl).toContain('filters%5Blocation%5D%5Bcoordinates%5D%5Blat%5D=40.7128')
      expect(calledUrl).toContain('filters%5Blocation%5D%5Bcoordinates%5D%5Blng%5D=-74.006')
    })

    test('should skip null and undefined values', async () => {
      await client.properties.listProperties({
        includeDeleted: true,
        deletedSince: null,
        deletedBefore: undefined,
        page: 1,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('includeDeleted=true')
      expect(calledUrl).toContain('page=1')
      expect(calledUrl).not.toContain('deletedSince')
      expect(calledUrl).not.toContain('deletedBefore')
    })

    test('should handle boolean values', async () => {
      await client.properties.listProperties({
        includeDeleted: true,
        includeArchived: false,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('includeDeleted=true')
      expect(calledUrl).toContain('includeArchived=false')
    })

    test('should handle number values', async () => {
      await client.properties.listProperties({
        page: 1,
        limit: 50,
        minPrice: 100.5,
        maxPrice: 999.99,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('page=1')
      expect(calledUrl).toContain('limit=50')
      expect(calledUrl).toContain('minPrice=100.5')
      expect(calledUrl).toContain('maxPrice=999.99')
    })

    test('should handle special characters in values', async () => {
      await client.properties.listProperties({
        search: 'Beach & Mountain View',
        tags: ['luxury+spa', 'pet-friendly'],
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      // URLSearchParams encodes spaces as + and & as %26
      expect(calledUrl).toContain('search=Beach+%26+Mountain+View')
      expect(calledUrl).toContain('tags%5B0%5D=luxury%2Bspa')
      expect(calledUrl).toContain('tags%5B1%5D=pet-friendly')
    })

    test('should handle empty objects and arrays', async () => {
      await client.properties.listProperties({
        filters: {},
        tags: [],
        page: 1,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('page=1')
      // Empty objects and arrays should not produce any query params
      expect(calledUrl).not.toContain('filters')
      expect(calledUrl).not.toContain('tags')
    })

    test('should handle date strings correctly', async () => {
      await client.rates.getDailyRates({
        propertyId: 'prop-123',
        from: '2025-11-20T00:00:00Z',
        to: '2025-11-25T23:59:59Z',
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('propertyId=prop-123')
      expect(calledUrl).toContain('from=2025-11-20T00%3A00%3A00Z')
      expect(calledUrl).toContain('to=2025-11-25T23%3A59%3A59Z')
    })

    test('should preserve pre-bracketed keys', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        'filters[type]': 'VILLA',
        'filters[amenities][0]': 'POOL',
        'filters[amenities][1]': 'WIFI',
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('filters%5Btype%5D=VILLA')
      expect(calledUrl).toContain('filters%5Bamenities%5D%5B0%5D=POOL')
      expect(calledUrl).toContain('filters%5Bamenities%5D%5B1%5D=WIFI')
    })
  })

  describe('URL construction', () => {
    test('should construct correct URL with no parameters', async () => {
      await client.properties.listProperties()

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toBe('https://api.lodgify.com/v2/properties')
    })

    test('should construct correct URL with parameters', async () => {
      await client.properties.listProperties({ page: 1, limit: 10 })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('https://api.lodgify.com/v2/properties?')
      expect(calledUrl).toContain('page=1')
      expect(calledUrl).toContain('limit=10')
    })

    test('should handle multiple parameter combinations', async () => {
      await client.quotes.getQuoteRaw('prop-123', {
        from: '2025-11-20',
        to: '2025-11-25',
        'roomTypes[0].Id': 999,
        'roomTypes[0].quantity': 1,
        'guest_breakdown[adults]': 2,
        'guest_breakdown[children]': 0,
        currency: 'USD',
        includeExtras: true,
      })

      const calledUrl = mockFetch.mock.calls[0][0] as string

      // Should have all parameters
      expect(calledUrl).toContain('from=2025-11-20')
      expect(calledUrl).toContain('to=2025-11-25')
      expect(calledUrl).toContain('roomTypes%5B0%5D.Id=999')
      expect(calledUrl).toContain('roomTypes%5B0%5D.quantity=1')
      expect(calledUrl).toContain('guest_breakdown%5Badults%5D=2')
      expect(calledUrl).toContain('guest_breakdown%5Bchildren%5D=0')
      expect(calledUrl).toContain('currency=USD')
      expect(calledUrl).toContain('includeExtras=true')

      // Should be properly joined with &
      const params = calledUrl.split('?')[1]
      const paramCount = params.split('&').length
      expect(paramCount).toBe(8)
    })
  })
})
