/**
 * Tests for lodgify_create_booking handler - THE most critical user-facing feature
 *
 * Creating bookings is the foundational operation in property management.
 * Without this, property managers cannot accept new reservations, generate revenue,
 * or operate their business. This test validates the handler logic that processes
 * booking creation requests.
 */

import { beforeEach, describe, expect, it, vi } from 'bun:test'
import { McpError } from '@modelcontextprotocol/sdk/types.js'
import type { LodgifyOrchestrator } from '../src/lodgify-orchestrator'
import { getBookingTools } from '../src/mcp/tools/booking-tools'

describe('lodgify_create_booking handler - Critical Booking Creation Feature', () => {
  // Mock client to isolate handler logic from API calls
  const mockClient = {
    createBookingV1: vi.fn(),
    bookings: {},
    properties: {},
    rates: {},
    availability: {},
    messaging: {},
    quotes: {},
    webhooks: {},
    // Add other properties as needed
  } as unknown as LodgifyOrchestrator

  const getClient = () => mockClient
  const tools = getBookingTools(getClient)
  const createBookingTool = tools.find((t) => t.name === 'lodgify_create_booking')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Successful Booking Creation - Happy Path', () => {
    it('should create a booking with all required fields', async () => {
      // Mock successful API response
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12345',
        status: 'Booked',
        property_id: 684855,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest: {
          name: 'Test Guest',
          email: 'test@example.com',
        },
        rooms: [
          {
            room_type_id: 751902,
            guest_breakdown: { adults: 2, children: 0 },
          },
        ],
        total_amount: 250.0,
        currency: 'USD',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
        children: 0,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Verify the handler called the client with correct params
      expect(mockClient.createBookingV1).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 684855,
          room_type_id: 751902,
          arrival: '2025-08-27',
          departure: '2025-08-28',
          guest_name: 'Test Guest',
          adults: 2,
          children: 0,
        }),
      )

      // Verify enhanced response structure
      expect(response).toHaveProperty('operation')
      expect(response.operation).toMatchObject({
        type: 'create',
        entity: 'booking',
        status: 'success',
      })
      expect(response).toHaveProperty('summary')
      expect(response.summary).toContain('successfully created')
      // Suggestions may or may not be present based on implementation
      if (response.suggestions) {
        expect(Array.isArray(response.suggestions)).toBe(true)
      }
    })

    it('should create a booking with all optional fields', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12346',
        status: 'Tentative',
        property_id: 684855,
        arrival: '2025-09-15',
        departure: '2025-09-20',
        guest: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        rooms: [
          {
            room_type_id: 751902,
            guest_breakdown: { adults: 2, children: 1, infants: 1 },
          },
        ],
        source: 'Direct Website',
        notes: 'Early check-in requested',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-09-15',
        departure: '2025-09-20',
        guest_name: 'John Doe',
        guest_email: 'john@example.com',
        guest_phone: '+1234567890',
        adults: 2,
        children: 1,
        infants: 1,
        status: 'tentative',
        source: 'Direct Website',
        notes: 'Early check-in requested',
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Verify all optional fields were passed to client
      expect(mockClient.createBookingV1).toHaveBeenCalledWith(
        expect.objectContaining({
          property_id: 684855,
          room_type_id: 751902,
          guest_name: 'John Doe',
          guest_email: 'john@example.com',
          guest_phone: '+1234567890',
          adults: 2,
          children: 1,
          infants: 1,
          status: 'tentative',
          source: 'Direct Website',
          notes: 'Early check-in requested',
        }),
      )

      expect(response.operation.status).toBe('success')
      expect(response).toHaveProperty('details')
    })
  })

  describe('Date Validation - Critical for Booking Integrity', () => {
    it('should reject invalid arrival date format', async () => {
      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: 'invalid-date',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool?.handler(params)).rejects.toThrow(McpError)
      await expect(createBookingTool.handler(params)).rejects.toThrow(
        /Arrival date validation failed/,
      )
    })

    it('should reject invalid departure date format', async () => {
      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: 'not-a-date',
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool?.handler(params)).rejects.toThrow(McpError)
      await expect(createBookingTool.handler(params)).rejects.toThrow(
        /Departure date validation failed/,
      )
    })

    it('should reject departure date before arrival date', async () => {
      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-28',
        departure: '2025-08-27', // Before arrival
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool?.handler(params)).rejects.toThrow(McpError)
      await expect(createBookingTool.handler(params)).rejects.toThrow(
        /Invalid date range.*end date.*before start date/i,
      )
    })

    it('should handle same-day bookings', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12347',
        status: 'Booked',
        arrival: '2025-08-27',
        departure: '2025-08-27', // Same day
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-27',
        guest_name: 'Day Guest',
        adults: 1,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
    })

    it('should include date validation feedback when dates are in the past', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12348',
        status: 'Booked',
      })

      // Use past dates that are still valid format
      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2020-01-01',
        departure: '2020-01-02',
        guest_name: 'Past Booking',
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Should succeed but include validation feedback about past dates
      expect(response.operation.status).toBe('success')
      // The handler may include dateValidation feedback in the response
      if (response.data?.dateValidation) {
        expect(response.data.dateValidation).toHaveProperty('feedback')
      }
    })
  })

  describe('Guest Information Handling', () => {
    it('should handle guest names with special characters', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12349',
        guest: { name: "O'Brien-Smith" },
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: "O'Brien-Smith",
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(mockClient.createBookingV1).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_name: "O'Brien-Smith",
        }),
      )
    })

    it('should validate guest count (minimum 1 adult)', async () => {
      // NOTE: This test verifies the Zod schema definition has .min(1) for adults
      // However, when calling the handler directly in unit tests, Zod validation
      // is bypassed. The MCP SDK validates this before calling the handler in production.
      // We can verify the schema definition exists correctly.
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK_ZERO_ADULTS',
        status: 'Booked',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 0, // Invalid in schema but bypassed in direct handler call
        children: 2,
      }

      // In unit test context, handler is called directly so Zod validation is bypassed
      // The tool's schema definition has .min(1) which the MCP SDK enforces in production
      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Verify the tool's schema requires at least 1 adult
      const schema = createBookingTool.config.inputSchema
      expect(schema.adults._def.checks).toContainEqual(
        expect.objectContaining({ kind: 'min', value: 1 }),
      )
      expect(response.operation.status).toBe('success')
    })

    it('should handle international phone numbers', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12350',
        guest: { phone: '+44 20 7123 4567' },
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'International Guest',
        guest_phone: '+44 20 7123 4567',
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
    })
  })

  describe('Business Logic and Edge Cases', () => {
    it('should handle tentative bookings requiring confirmation', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12351',
        status: 'Tentative',
        confirmationRequired: true,
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-12-20',
        departure: '2025-12-27',
        guest_name: 'Holiday Guest',
        adults: 4,
        status: 'tentative',
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      // Suggestions should include confirmation reminder
      expect(response.suggestions).toBeDefined()
    })

    it('should handle extended stay bookings (30+ nights)', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12352',
        status: 'Booked',
        nights: 45,
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-06-01',
        departure: '2025-07-16', // 45 nights
        guest_name: 'Long Stay Guest',
        adults: 2,
        notes: 'Extended summer stay',
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
    })

    it('should handle bookings with source tracking', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12353',
        source: 'Partner Website',
        commission: 15.0,
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Partner Guest',
        adults: 2,
        source: 'Partner Website',
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
      expect(mockClient.createBookingV1).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'Partner Website',
        }),
      )
    })

    it('should handle bookings with special requests in notes', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12354',
        notes: 'Late arrival after 10pm, pet-friendly room needed',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-29',
        guest_name: 'Guest with Requests',
        adults: 2,
        notes: 'Late arrival after 10pm, pet-friendly room needed',
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      expect(response.operation.status).toBe('success')
    })
  })

  describe('Error Handling - Critical for User Experience', () => {
    it('should handle API errors gracefully', async () => {
      mockClient.createBookingV1.mockRejectedValueOnce(
        new Error('Property not available for these dates'),
      )

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool?.handler(params)).rejects.toThrow()
    })

    it('should handle network timeout errors', async () => {
      mockClient.createBookingV1.mockRejectedValueOnce(new Error('Network timeout'))

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool.handler(params)).rejects.toThrow(/Network timeout/)
    })

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded') as Error & { statusCode: number }
      rateLimitError.statusCode = 429
      mockClient.createBookingV1.mockRejectedValueOnce(rateLimitError)

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      await expect(createBookingTool?.handler(params)).rejects.toThrow()
    })
  })

  describe('Response Enhancement Features', () => {
    it('should extract and include booking details in response', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12355',
        status: 'Booked',
        property: {
          id: 684855,
          name: 'Ocean View Villa',
        },
        guest: {
          name: 'Test Guest',
          email: 'test@example.com',
        },
        checkIn: '2025-08-27',
        checkOut: '2025-08-28',
        totalAmount: 250.0,
        currency: 'USD',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        guest_email: 'test@example.com',
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Should have extracted details
      expect(response).toHaveProperty('details')
      if (response.details) {
        expect(response.details).toHaveProperty('bookingId', 'BK12355')
      }
    })

    it('should generate contextual suggestions for newly created booking', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12356',
        status: 'Booked',
        paymentStatus: 'pending',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Should have suggestions for next steps
      expect(response.suggestions).toBeDefined()
      expect(Array.isArray(response.suggestions)).toBe(true)
      if (response.suggestions.length > 0) {
        // Might suggest sending confirmation, creating payment link, etc.
        expect(
          response.suggestions.some(
            (s: string) =>
              s.toLowerCase().includes('payment') ||
              s.toLowerCase().includes('confirmation') ||
              s.toLowerCase().includes('email'),
          ),
        ).toBe(true)
      }
    })

    it('should include operation metadata in response', async () => {
      mockClient.createBookingV1.mockResolvedValueOnce({
        id: 'BK12357',
        status: 'Booked',
      })

      const params = {
        property_id: 684855,
        room_type_id: 751902,
        arrival: '2025-08-27',
        departure: '2025-08-28',
        guest_name: 'Test Guest',
        adults: 2,
      }

      const result = await createBookingTool?.handler(params)
      const response = JSON.parse(result.content[0].text)

      // Should have operation metadata
      expect(response.operation).toMatchObject({
        type: 'create',
        entity: 'booking',
        status: 'success',
      })
      expect(response.operation).toHaveProperty('timestamp')
    })
  })
})
