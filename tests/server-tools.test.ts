import { describe, test, expect } from 'bun:test'
import { z } from 'zod'

// Test Zod schemas used by the server
describe('MCP Tool Validation Schemas', () => {
  describe('Property Management Schemas', () => {
    const ListPropertiesSchema = z.object({
      params: z.record(z.unknown()).optional(),
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
      expect(ListPropertyRoomsSchema.parse({ propertyId: 'prop-123' })).toEqual({ propertyId: 'prop-123' })
      expect(() => ListPropertyRoomsSchema.parse({ propertyId: '' })).toThrow('Property ID is required')
    })
  })

  describe('Booking Management Schemas', () => {
    const GetBookingSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
    })

    const CreateBookingPaymentLinkSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
      payload: z.record(z.unknown()),
    })

    const UpdateKeyCodesSchema = z.object({
      id: z.string().min(1, 'Booking ID is required'),
      payload: z.record(z.unknown()),
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

  describe('Availability Schemas', () => {
    const AvailabilityRoomSchema = z.object({
      propertyId: z.string().min(1, 'Property ID is required'),
      roomTypeId: z.string().min(1, 'Room Type ID is required'),
      params: z.record(z.unknown()).optional(),
    })

    const AvailabilityPropertySchema = z.object({
      propertyId: z.string().min(1, 'Property ID is required'),
      params: z.record(z.unknown()).optional(),
    })

    test('should validate availability_room input', () => {
      const input = {
        propertyId: 'prop-123',
        roomTypeId: 'room-456',
        params: { from: '2025-11-20', to: '2025-11-25' },
      }
      expect(AvailabilityRoomSchema.parse(input)).toEqual(input)
      expect(() => AvailabilityRoomSchema.parse({ propertyId: 'prop-123' })).toThrow()
    })

    test('should validate availability_property input', () => {
      const input = {
        propertyId: 'prop-123',
        params: { from: '2025-11-20', to: '2025-11-25' },
      }
      expect(AvailabilityPropertySchema.parse(input)).toEqual(input)
      expect(() => AvailabilityPropertySchema.parse({ propertyId: '' })).toThrow('Property ID is required')
    })
  })

  describe('Quote & Messaging Schemas', () => {
    const GetQuoteSchema = z.object({
      propertyId: z.string().min(1, 'Property ID is required'),
      params: z.record(z.unknown()),
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
      const input = {
        threadGuid: '550e8400-e29b-41d4-a716-446655440000',
      }
      expect(GetThreadSchema.parse(input)).toEqual(input)
      expect(() => GetThreadSchema.parse({ threadGuid: '' })).toThrow('Thread GUID is required')
    })
  })

  describe('Rates Management Schemas', () => {
    const DailyRatesSchema = z.object({
      params: z.record(z.unknown()),
    })

    const RateSettingsSchema = z.object({
      params: z.record(z.unknown()),
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
      const input = {
        params: {
          propertyId: 'prop-123',
          rateId: 'rate-456',
        },
      }
      expect(RateSettingsSchema.parse(input)).toEqual(input)
      expect(() => RateSettingsSchema.parse({ params: undefined })).toThrow()
    })
  })

  describe('New Booking Management Schemas', () => {
    const CreateBookingSchema = z.object({
      payload: z.object({
        propertyId: z.string().min(1),
        from: z.string().min(1),
        to: z.string().min(1),
        guestBreakdown: z.object({
          adults: z.number().min(1),
          children: z.number().min(0).optional(),
          infants: z.number().min(0).optional(),
        }),
        roomTypes: z.array(z.object({
          id: z.string().min(1),
          quantity: z.number().min(1).optional(),
        })),
      }),
    })

    const UpdateBookingSchema = z.object({
      id: z.string().min(1),
      payload: z.object({
        status: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        guestBreakdown: z.object({
          adults: z.number().min(1).optional(),
          children: z.number().min(0).optional(),
          infants: z.number().min(0).optional(),
        }).optional(),
      }),
    })

    const DeleteBookingSchema = z.object({
      id: z.string().min(1),
    })

    test('should validate create_booking input', () => {
      const input = {
        payload: {
          propertyId: 'prop-123',
          from: '2025-12-01',
          to: '2025-12-07',
          guestBreakdown: {
            adults: 2,
            children: 1,
          },
          roomTypes: [{ id: 'room-456', quantity: 1 }],
        },
      }
      expect(CreateBookingSchema.parse(input)).toEqual(input)
      expect(() => CreateBookingSchema.parse({ payload: {} })).toThrow()
    })

    test('should validate update_booking input', () => {
      const input = {
        id: 'book-789',
        payload: {
          status: 'confirmed',
          guestBreakdown: { adults: 3 },
        },
      }
      expect(UpdateBookingSchema.parse(input)).toEqual(input)
      expect(() => UpdateBookingSchema.parse({ id: '' })).toThrow()
    })

    test('should validate delete_booking input', () => {
      const input = { id: 'book-789' }
      expect(DeleteBookingSchema.parse(input)).toEqual(input)
      expect(() => DeleteBookingSchema.parse({ id: '' })).toThrow()
    })
  })

  describe('Property Availability Update Schema', () => {
    const UpdatePropertyAvailabilitySchema = z.object({
      propertyId: z.string().min(1),
      payload: z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        available: z.boolean(),
        minStay: z.number().min(0).optional(),
        maxStay: z.number().min(0).optional(),
      }),
    })

    test('should validate update_property_availability input', () => {
      const input = {
        propertyId: 'prop-123',
        payload: {
          from: '2025-12-20',
          to: '2025-12-31',
          available: false,
          minStay: 3,
        },
      }
      expect(UpdatePropertyAvailabilitySchema.parse(input)).toEqual(input)
      expect(() => UpdatePropertyAvailabilitySchema.parse({ propertyId: '' })).toThrow()
    })
  })

  describe('Webhook Management Schemas', () => {
    const WebhookSubscribeSchema = z.object({
      payload: z.object({
        event: z.string().min(1),
        targetUrl: z.string().url(),
      }),
    })

    const ListWebhooksSchema = z.object({
      params: z.record(z.unknown()).optional(),
    })

    const DeleteWebhookSchema = z.object({
      id: z.string().min(1),
    })

    test('should validate subscribe_webhook input', () => {
      const input = {
        payload: {
          event: 'booking.created',
          targetUrl: 'https://your-app.com/webhooks/lodgify',
        },
      }
      expect(WebhookSubscribeSchema.parse(input)).toEqual(input)
      expect(() => WebhookSubscribeSchema.parse({ payload: { event: '' } })).toThrow()
    })

    test('should validate list_webhooks input', () => {
      expect(ListWebhooksSchema.parse({})).toEqual({ params: undefined })
      expect(ListWebhooksSchema.parse({ params: { page: 1 } })).toEqual({ params: { page: 1 } })
    })

    test('should validate delete_webhook input', () => {
      const input = { id: 'webhook-123' }
      expect(DeleteWebhookSchema.parse(input)).toEqual(input)
      expect(() => DeleteWebhookSchema.parse({ id: '' })).toThrow()
    })
  })

  describe('Rate Management Schemas', () => {
    const CreateRateSchema = z.object({
      payload: z.object({
        propertyId: z.string().min(1),
        roomTypeId: z.string().min(1),
        from: z.string().min(1),
        to: z.string().min(1),
        rate: z.number().positive(),
        currency: z.string().length(3).optional(),
      }),
    })

    const UpdateRateSchema = z.object({
      id: z.string().min(1),
      payload: z.object({
        rate: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    })

    test('should validate create_rate input', () => {
      const input = {
        payload: {
          propertyId: 'prop-123',
          roomTypeId: 'room-456',
          from: '2025-12-01',
          to: '2025-12-31',
          rate: 150.00,
          currency: 'USD',
        },
      }
      expect(CreateRateSchema.parse(input)).toEqual(input)
      expect(() => CreateRateSchema.parse({ payload: { rate: -10 } })).toThrow()
    })

    test('should validate update_rate input', () => {
      const input = {
        id: 'rate-789',
        payload: {
          rate: 175.00,
          currency: 'EUR',
        },
      }
      expect(UpdateRateSchema.parse(input)).toEqual(input)
      expect(() => UpdateRateSchema.parse({ id: '', payload: {} })).toThrow()
    })
  })
})

describe('Tool Response Format', () => {
  test('should format successful response correctly', () => {
    const result = { id: 'prop-123', name: 'Test Property' }
    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
    
    expect(response.content[0].type).toBe('text')
    expect(JSON.parse(response.content[0].text)).toEqual(result)
  })

  test('should format validation error response correctly', () => {
    const zodError = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['id'],
        message: 'Required',
      },
    ])
    
    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: 'Validation error',
              details: zodError.errors,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
    
    expect(response.isError).toBe(true)
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.error).toBe(true)
    expect(parsed.message).toBe('Validation error')
    expect(parsed.details).toHaveLength(1)
  })

  test('should format API error response correctly', () => {
    const apiError = {
      error: true,
      message: 'Lodgify 404: Not Found',
      status: 404,
      path: '/v2/properties/non-existent',
      detail: { code: 'PROPERTY_NOT_FOUND' },
    }
    
    const response = {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: apiError.message,
              details: apiError.detail,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
    
    expect(response.isError).toBe(true)
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.error).toBe(true)
    expect(parsed.message).toContain('404')
    expect(parsed.details.code).toBe('PROPERTY_NOT_FOUND')
  })
})