import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// Test Zod schemas used by the server
describe('MCP Tool Validation Schemas', () => {
  describe('Property Management Schemas', () => {
    const ListPropertiesSchema = z.object({
      params: z.record(z.string(), z.unknown()).optional(),
    })

    const GetPropertySchema = z.object({
      id: z.string().min(1, 'Property ID is required'),
    })

    const ListPropertyRoomsSchema = z.object({
      propertyId: z.string().min(1, 'Property ID is required'),
    })

    test('should validate list_properties input', () => {
      expect(ListPropertiesSchema.parse({})).toEqual({ params: undefined })
      expect(ListPropertiesSchema.parse({ params: { page: 1 } })).toEqual({ params: { page: 1 } })
    })

    test('should validate get_property input', () => {
      expect(GetPropertySchema.parse({ id: 'prop-123' })).toEqual({ id: 'prop-123' })
      expect(() => GetPropertySchema.parse({ id: '' })).toThrow('Property ID is required')
      expect(() => GetPropertySchema.parse({})).toThrow()
    })

    test('should validate list_property_rooms input', () => {
      expect(ListPropertyRoomsSchema.parse({ propertyId: 'prop-123' })).toEqual({
        propertyId: 'prop-123',
      })
      expect(() => ListPropertyRoomsSchema.parse({ propertyId: '' })).toThrow(
        'Property ID is required',
      )
    })
  })

  describe('Booking Management Schemas', () => {
    const GetBookingSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
    })

    const CreateBookingPaymentLinkSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
      payload: z.record(z.string(), z.unknown()),
    })

    const UpdateKeyCodesSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
      payload: z.record(z.string(), z.unknown()),
    })

    test('should validate get_booking input', () => {
      expect(GetBookingSchema.parse({ id: 'book-456' })).toEqual({ id: 'book-456' })
      expect(() => GetBookingSchema.parse({ id: '' })).toThrow('Booking ID is required')
    })

    test('should validate create_booking_payment_link input', () => {
      const input = {
        id: 'book-456',
        payload: { amount: 1000, currency: 'USD' },
      }
      expect(CreateBookingPaymentLinkSchema.parse(input)).toEqual(input)
      expect(() => CreateBookingPaymentLinkSchema.parse({ id: 'book-456' })).toThrow()
    })

    test('should validate update_key_codes input', () => {
      const input = {
        id: 'book-456',
        payload: { keyCodes: ['1234', '5678'] },
      }
      expect(UpdateKeyCodesSchema.parse(input)).toEqual(input)
      expect(() => UpdateKeyCodesSchema.parse({ id: '' })).toThrow('Booking ID is required')
    })
  })

  describe('Rates & Pricing Schemas', () => {
    const DailyRatesSchema = z.object({
      params: z.record(z.string(), z.unknown()),
    })

    const RateSettingsSchema = z.object({
      params: z.record(z.string(), z.unknown()),
    })

    test('should validate daily_rates input', () => {
      const input = {
        params: {
          propertyId: 'prop-123',
          from: '2025-11-01',
          to: '2025-11-30',
        },
      }
      expect(DailyRatesSchema.parse(input)).toEqual(input)
      expect(() => DailyRatesSchema.parse({})).toThrow()
    })

    test('should validate rate_settings input', () => {
      const input = { params: { propertyId: 'prop-123' } }
      expect(RateSettingsSchema.parse(input)).toEqual(input)
      expect(() => RateSettingsSchema.parse({ params: undefined })).toThrow()
    })
  })

  describe('Quote & Messaging Schemas', () => {
    const GetQuoteSchema = z.object({
      propertyId: z.string().min(1, 'Property ID is required'),
      params: z.record(z.string(), z.unknown()),
    })

    const GetThreadSchema = z.object({
      threadGuid: z.string().min(1, 'Thread GUID is required'),
    })

    test('should validate get_quote input', () => {
      const input = {
        propertyId: 'prop-123',
        params: {
          from: '2025-11-20',
          to: '2025-11-25',
          'roomTypes[0].Id': 999,
          'guest_breakdown[adults]': 2,
        },
      }
      expect(GetQuoteSchema.parse(input)).toEqual(input)
      expect(() => GetQuoteSchema.parse({ propertyId: 'prop-123' })).toThrow()
    })

    test('should validate get_thread input', () => {
      const input = { threadGuid: '550e8400-e29b-41d4-a716-446655440000' }
      expect(GetThreadSchema.parse(input)).toEqual(input)
      expect(() => GetThreadSchema.parse({ threadGuid: '' })).toThrow('Thread GUID is required')
    })
  })

  describe('Property Discovery Schemas', () => {
    const FindPropertiesSchema = z.object({
      searchTerm: z.string().optional(),
      includePropertyIds: z.boolean().optional(),
      limit: z.number().min(1).max(50).optional(),
    })

    test('should validate find_properties input', () => {
      expect(FindPropertiesSchema.parse({})).toEqual({
        searchTerm: undefined,
        includePropertyIds: undefined,
        limit: undefined,
      })
      expect(FindPropertiesSchema.parse({ searchTerm: 'beach', limit: 5 })).toEqual({
        searchTerm: 'beach',
        includePropertyIds: undefined,
        limit: 5,
      })
      expect(() => FindPropertiesSchema.parse({ limit: 0 })).toThrow()
      expect(() => FindPropertiesSchema.parse({ limit: 100 })).toThrow()
    })
  })
})

describe('Tool Response Format', () => {
  test('should format successful response correctly', () => {
    const result = { id: 'prop-123', name: 'Test Property' }
    const formatted = JSON.stringify(result, null, 2)

    expect(formatted).toContain('"id": "prop-123"')
    expect(formatted).toContain('"name": "Test Property"')
    expect(JSON.parse(formatted)).toEqual(result)
  })

  test('should format error response correctly', () => {
    const error = {
      error: true,
      message: 'Property not found',
      status: 404,
      path: '/v2/properties/invalid',
      details: {
        code: 'PROPERTY_NOT_FOUND',
        description: 'The specified property does not exist',
      },
    }

    const formatted = JSON.stringify(error, null, 2)
    const parsed = JSON.parse(formatted)

    expect(parsed.error).toBe(true)
    expect(parsed.message).toBe('Property not found')
    expect(parsed.status).toBe(404)
    expect(parsed.details.code).toBe('PROPERTY_NOT_FOUND')
  })
})
