/**
 * Tests for lodgify_update_rates MCP tool
 * Critical user-facing feature for dynamic pricing management
 */

import { beforeEach, describe, expect, it, jest } from 'bun:test'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import type { LodgifyOrchestrator } from '../../src/lodgify-orchestrator.js'
import { getRateTools } from '../../src/mcp/tools/rate-tools.js'
import type { ToolRegistration } from '../../src/mcp/utils/types.js'

describe('Rate Tools - Critical User-Facing Pricing Management Feature', () => {
  describe('lodgify_update_rates - Revenue Management for Property Managers', () => {
    let mockClient: LodgifyOrchestrator
    let updateRatesMock: jest.Mock
    let tools: ToolRegistration[]
    let updateRatesTool: ToolRegistration | undefined

    beforeEach(() => {
      // Create mock client with updateRatesV1 method
      updateRatesMock = jest.fn()
      mockClient = {
        updateRatesV1: updateRatesMock,
        getConfig: jest.fn().mockReturnValue({ isReadOnly: false }),
        checkDependencies: jest.fn(),
        getAvailableVacant: jest.fn(),
        bookings: {},
        properties: {},
        messaging: {},
        webhooks: {},
        rates: {},
        quotes: {},
        availability: {},
      } as unknown as LodgifyOrchestrator

      // Get tools with the mock client
      tools = getRateTools(() => mockClient)
      updateRatesTool = tools.find((t) => t.name === 'lodgify_update_rates')
    })

    describe('Successful Rate Updates (Happy Path)', () => {
      it('should update rates for a single room type with basic pricing', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Rates updated successfully',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith({
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        })

        expect(response.operation).toEqual({
          type: 'update',
          entity: 'rate',
          status: 'success',
          timestamp: expect.any(String),
        })

        expect(response.summary).toContain('updated')
        expect(response.data.success).toBe(true)
        expect(response.suggestions).toBeInstanceOf(Array)
      })

      it('should update rates with minimum stay requirements for peak season', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Rates with minimum stay updated',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-07-01',
              end_date: '2025-07-31',
              price_per_day: 250.0,
              min_stay: 7, // Week minimum during peak season
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.data.success).toBe(true)
      })

      it('should bulk update rates for multiple room types', async () => {
        // Mock successful response for bulk update
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'All rates updated successfully',
          updatedCount: 3,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
              min_stay: 3,
              currency: 'USD',
            },
            {
              room_type_id: 790,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 200.0,
              min_stay: 2,
              currency: 'USD',
            },
            {
              room_type_id: 791,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 175.0,
              min_stay: 4,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.data.updatedCount).toBe(3)
        expect(response.suggestions).toContain('Review the updated rates for accuracy')
      })

      it('should handle multi-currency rate updates for international properties', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'EUR rates updated',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 135.5,
              currency: 'EUR',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })

      it('should apply seasonal pricing adjustments', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Seasonal rates applied',
          updatedCount: 2,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-12-20',
              end_date: '2026-01-05',
              price_per_day: 350.0, // Holiday premium
              min_stay: 5,
              currency: 'USD',
            },
            {
              room_type_id: 789,
              start_date: '2025-02-01',
              end_date: '2025-03-31',
              price_per_day: 95.0, // Off-season discount
              min_stay: 2,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.data.updatedCount).toBe(2)
      })

      it('should handle same-day rate updates for immediate changes', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: "Today's rate updated",
          updatedCount: 1,
        })

        const today = new Date().toISOString().split('T')[0]
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: today,
              end_date: today,
              price_per_day: 175.0,
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })

      it('should update long-term rates for extended stays', async () => {
        // Mock successful response
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Long-term rates applied',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-09-01',
              end_date: '2025-11-30',
              price_per_day: 85.0, // Monthly rate discount
              min_stay: 30,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.suggestions).toContain(
          'Consider offering additional long-term stay benefits',
        )
      })
    })

    describe('Input Validation', () => {
      it('should reject invalid date format', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '06-01-2025', // Invalid format
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('Invalid date format')
      })

      it('should reject end date before start date', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-08-31',
              end_date: '2025-06-01', // End before start
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow(
          'End date must be on or after start date',
        )
      })

      it('should reject negative pricing', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: -50.0, // Negative price
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow()
      })

      it('should reject zero pricing', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 0, // Zero price
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow()
      })

      it('should reject invalid currency code', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
              currency: 'DOLLAR', // Invalid - must be 3 chars
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow()
      })

      it('should reject invalid minimum stay', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
              min_stay: 0, // Invalid - must be >= 1
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow()
      })

      it('should reject empty rates array', async () => {
        const input = {
          property_id: 123456,
          rates: [], // Empty array
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow()
      })

      it('should validate all rates in bulk update', async () => {
        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
            {
              room_type_id: 790,
              start_date: '2025-07-01',
              end_date: '2025-06-01', // Invalid date range in second rate
              price_per_day: 200.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow(
          'End date must be on or after start date',
        )
      })
    })

    describe('Error Handling', () => {
      it('should handle API network timeout', async () => {
        updateRatesMock.mockRejectedValue(new Error('Network timeout'))

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('Network timeout')
      })

      it('should handle 401 unauthorized error', async () => {
        updateRatesMock.mockRejectedValue(
          new McpError(ErrorCode.InvalidRequest, '401: Unauthorized'),
        )

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('401')
      })

      it('should handle 404 property not found', async () => {
        updateRatesMock.mockRejectedValue(
          new McpError(ErrorCode.InvalidRequest, '404: Property not found'),
        )

        const input = {
          property_id: 999999,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('404')
      })

      it('should handle 429 rate limiting', async () => {
        updateRatesMock.mockRejectedValue(
          new McpError(ErrorCode.InvalidRequest, '429: Too many requests'),
        )

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('429')
      })

      it('should handle conflict with existing rates', async () => {
        updateRatesMock.mockRejectedValue(
          new McpError(ErrorCode.InvalidRequest, '409: Rate conflict - overlapping dates'),
        )

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow('409')
      })
    })

    describe('Read-Only Mode Protection', () => {
      it('should block rate updates in read-only mode', async () => {
        // Set read-only mode
        mockClient.getConfig = jest.fn().mockReturnValue({ isReadOnly: true })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        await expect(updateRatesTool?.handler(input)).rejects.toThrow(/read-only|READ_ONLY/i)
        expect(updateRatesMock).not.toHaveBeenCalled()
      })
    })

    describe('Edge Cases', () => {
      it('should handle high-precision pricing', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Rates updated',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 149.99, // Precision pricing
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })

      it('should handle very large rate updates', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Premium rates applied',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 9999.99, // Luxury property pricing
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })

      it('should handle year-long rate periods', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Annual rates set',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              price_per_day: 125.0,
              min_stay: 2,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })
    })

    describe('Business Scenarios', () => {
      it('should support last-minute rate adjustments for unsold inventory', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Last-minute rate applied',
          updatedCount: 1,
        })

        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const nextWeekStr = nextWeek.toISOString().split('T')[0]

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: tomorrowStr,
              end_date: nextWeekStr,
              price_per_day: 89.0, // Discount for last-minute booking
              min_stay: 1,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.suggestions).toContain('Monitor booking response to the new rates')
      })

      it('should support special event pricing', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Event pricing applied',
          updatedCount: 1,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-07-03',
              end_date: '2025-07-05',
              price_per_day: 450.0, // July 4th premium
              min_stay: 3,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
      })

      it('should support weekend pricing differentials', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Weekend rates set',
          updatedCount: 2,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-06', // Friday
              end_date: '2025-06-08', // Sunday
              price_per_day: 225.0, // Weekend premium
              min_stay: 2,
              currency: 'USD',
            },
            {
              room_type_id: 789,
              start_date: '2025-06-09', // Monday
              end_date: '2025-06-12', // Thursday
              price_per_day: 145.0, // Weekday rate
              min_stay: 1,
              currency: 'USD',
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(updateRatesMock).toHaveBeenCalledWith(input)
        expect(response.operation.status).toBe('success')
        expect(response.data.updatedCount).toBe(2)
      })
    })

    describe('Response Enhancement', () => {
      it('should provide enhanced response with operation metadata', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Rates updated successfully',
          updatedCount: 1,
          details: {
            property: 'Beach House',
            room: 'Master Suite',
          },
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(response.operation).toHaveProperty('type', 'update')
        expect(response.operation).toHaveProperty('entity', 'rate')
        expect(response.operation).toHaveProperty('status', 'success')
        expect(response.operation).toHaveProperty('timestamp')
        expect(response.summary).toBeTruthy()
        expect(response.suggestions).toBeInstanceOf(Array)
        expect(response.data).toHaveProperty('success', true)
      })

      it('should generate contextual suggestions', async () => {
        updateRatesMock.mockResolvedValue({
          success: true,
          message: 'Rates updated',
          updatedCount: 3,
        })

        const input = {
          property_id: 123456,
          rates: [
            {
              room_type_id: 789,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 150.0,
            },
            {
              room_type_id: 790,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 200.0,
            },
            {
              room_type_id: 791,
              start_date: '2025-06-01',
              end_date: '2025-08-31',
              price_per_day: 175.0,
            },
          ],
        }

        const result = await updateRatesTool?.handler(input)
        const response = JSON.parse(result?.content[0].text || '{}')

        expect(response.suggestions).toContain('Review the updated rates for accuracy')
        expect(response.suggestions).toContain('Monitor booking response to the new rates')
        expect(response.suggestions.length).toBeGreaterThan(0)
      })
    })
  })
})
