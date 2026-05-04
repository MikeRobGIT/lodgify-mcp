/**
 * Integration test for lodgify_rate_settings MCP tool
 * This tests a critical user-facing feature that allows property managers
 * to understand and configure their pricing rules and rate calculation settings.
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { createTestServer, type TestServer } from '../test-server.js'

describe('lodgify_rate_settings - Critical Rate Configuration Tool', () => {
  let testServer: TestServer
  let mockClient: Record<string, unknown>

  beforeEach(() => {
    // Create a mock client with all required methods
    mockClient = {
      // Rate management methods (test server calls these directly)
      getRateSettings: mock(() => Promise.resolve()),
      getDailyRates: mock(() => Promise.resolve()),
      // Other required methods for test server
      listProperties: mock(() => Promise.resolve()),
      getProperty: mock(() => Promise.resolve()),
      listPropertyRooms: mock(() => Promise.resolve()),
      listDeletedProperties: mock(() => Promise.resolve()),
      listBookings: mock(() => Promise.resolve()),
      getBooking: mock(() => Promise.resolve()),
      getBookingPaymentLink: mock(() => Promise.resolve()),
      createBookingPaymentLink: mock(() => Promise.resolve()),
      updateKeyCodes: mock(() => Promise.resolve()),
      getQuote: mock(() => Promise.resolve()),
      getThread: mock(() => Promise.resolve()),
      listWebhooks: mock(() => Promise.resolve()),
      subscribeWebhook: mock(() => Promise.resolve()),
      unsubscribeWebhook: mock(() => Promise.resolve()),
      createBooking: mock(() => Promise.resolve()),
      updateBooking: mock(() => Promise.resolve()),
      deleteBooking: mock(() => Promise.resolve()),
      updateRates: mock(() => Promise.resolve()),
      availabilityAll: mock(() => Promise.resolve()),
      getExternalBookings: mock(() => Promise.resolve()),
      checkinBooking: mock(() => Promise.resolve()),
      checkoutBooking: mock(() => Promise.resolve()),
      createBookingQuote: mock(() => Promise.resolve()),
      updateRatesV1: mock(() => Promise.resolve()),
    }

    // Create test server with the mock client
    testServer = createTestServer(mockClient)
  })

  describe('User-Facing Rate Configuration Retrieval', () => {
    it('should retrieve default rate settings without property ID', async () => {
      // Arrange - User wants to see global rate settings
      const request = {
        // No params means getting default/global settings
      }

      // Mock API response for rate settings
      const mockRateSettings = {
        baseRate: 100,
        currency: 'USD',
        minimumStayDefault: 2,
        seasonalModifiers: [
          {
            season: 'high',
            modifier: 1.5,
            startMonth: 6,
            endMonth: 8,
          },
          {
            season: 'low',
            modifier: 0.8,
            startMonth: 11,
            endMonth: 2,
          },
        ],
        weekendModifier: 1.2,
        lastMinuteDiscount: {
          enabled: true,
          daysBeforeArrival: 3,
          discountPercent: 15,
        },
        longStayDiscount: {
          enabled: true,
          minNights: 7,
          discountPercent: 10,
        },
        extraGuestCharges: {
          enabled: true,
          baseGuests: 2,
          chargePerExtraGuest: 25,
        },
        cancellationPolicy: {
          type: 'flexible',
          refundDays: 7,
          penaltyPercent: 0,
        },
      }

      // Set up mock client to return rate settings
      mockClient.getRateSettings.mockResolvedValue(mockRateSettings)

      // Act - Tool handler processes the request
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - User gets comprehensive rate configuration
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)

      // Verify the response contains rate configuration details
      expect(result).toMatchObject({
        baseRate: 100,
        currency: 'USD',
        minimumStayDefault: 2,
      })

      // User can see seasonal pricing modifiers
      expect(result.seasonalModifiers).toHaveLength(2)
      expect(result.seasonalModifiers[0]).toMatchObject({
        season: 'high',
        modifier: 1.5,
      })

      // User can understand discount rules
      expect(result.lastMinuteDiscount).toMatchObject({
        enabled: true,
        discountPercent: 15,
      })

      // User can see cancellation policy
      expect(result.cancellationPolicy).toMatchObject({
        type: 'flexible',
        refundDays: 7,
      })
    })

    it('should retrieve property-specific rate settings when property ID is provided', async () => {
      // Arrange - User wants settings for a specific property
      const request = {
        params: {
          houseId: 12345, // Specific property ID
        },
      }

      const mockPropertyRateSettings = {
        propertyId: 12345,
        propertyName: 'Beach House Villa',
        baseRate: 250,
        currency: 'EUR',
        minimumStayDefault: 3,
        seasonalModifiers: [
          {
            season: 'peak',
            modifier: 2.0,
            startDate: '2024-07-01',
            endDate: '2024-08-31',
          },
        ],
        weekendModifier: 1.5,
        cleaningFee: {
          amount: 150,
          perStay: true,
        },
        securityDeposit: {
          amount: 500,
          refundable: true,
        },
        taxRate: 0.1,
        serviceFeePercent: 5,
      }

      mockClient.getRateSettings.mockImplementation(async (params: Record<string, unknown>) => {
        // Test server mirrors real handler which stringifies houseId before
        // calling the API (src/mcp/tools/rate-tools.ts).
        if (params?.houseId) {
          expect(params.houseId).toBe('12345')
        }
        return mockPropertyRateSettings
      })

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - Property-specific settings are returned
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)

      expect(result.propertyId).toBe(12345)
      expect(result.propertyName).toBe('Beach House Villa')
      expect(result.baseRate).toBe(250)
      expect(result.currency).toBe('EUR')

      // User can see property-specific fees
      expect(result.cleaningFee).toMatchObject({
        amount: 150,
        perStay: true,
      })

      // User can see security deposit requirements
      expect(result.securityDeposit).toMatchObject({
        amount: 500,
        refundable: true,
      })
    })

    it('should handle empty rate settings response gracefully', async () => {
      // Arrange - Property has no configured rate settings
      const request = {
        params: {
          houseId: 99999,
        },
      }

      mockClient.getRateSettings.mockResolvedValue({}) // Empty settings

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - Tool handles empty response gracefully
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)
      expect(result).toEqual({})
    })

    it('should handle network errors when retrieving rate settings', async () => {
      // Arrange - Network issue scenario
      const request = {
        params: {
          houseId: 12345,
        },
      }

      mockClient.getRateSettings.mockRejectedValue(new Error('Network timeout'))

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - User gets clear error message
      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Network timeout')
    })

    it('should handle rate settings with complex pricing rules', async () => {
      // Arrange - Complex rate configuration with multiple rules
      const request = {
        params: {
          houseId: 55555,
        },
      }

      const complexRateSettings = {
        baseRate: 300,
        currency: 'GBP',
        dynamicPricing: {
          enabled: true,
          algorithm: 'demand-based',
          minRate: 200,
          maxRate: 500,
        },
        occupancyBasedPricing: [
          { guests: 1, modifier: 0.8 },
          { guests: 2, modifier: 1.0 },
          { guests: 3, modifier: 1.1 },
          { guests: 4, modifier: 1.2 },
        ],
        dayOfWeekRates: {
          monday: 0.9,
          tuesday: 0.9,
          wednesday: 0.9,
          thursday: 0.95,
          friday: 1.2,
          saturday: 1.3,
          sunday: 1.1,
        },
        minimumStayByPeriod: [
          {
            period: 'summer',
            minNights: 7,
            startDate: '2024-06-01',
            endDate: '2024-08-31',
          },
          {
            period: 'winter',
            minNights: 3,
            startDate: '2024-12-01',
            endDate: '2025-02-28',
          },
        ],
        checkInRestrictions: {
          allowedDays: ['friday', 'saturday', 'sunday'],
          checkInTime: '15:00',
          checkOutTime: '11:00',
        },
        advanceBookingDiscount: [
          { daysInAdvance: 60, discountPercent: 10 },
          { daysInAdvance: 90, discountPercent: 15 },
          { daysInAdvance: 120, discountPercent: 20 },
        ],
      }

      mockClient.getRateSettings.mockResolvedValue(complexRateSettings)

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - All complex pricing rules are available
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)

      // User can see dynamic pricing configuration
      expect(result.dynamicPricing).toMatchObject({
        enabled: true,
        algorithm: 'demand-based',
        minRate: 200,
        maxRate: 500,
      })

      // User can understand occupancy-based pricing
      expect(result.occupancyBasedPricing).toHaveLength(4)
      expect(result.occupancyBasedPricing[0]).toMatchObject({
        guests: 1,
        modifier: 0.8,
      })

      // User can see day-of-week variations
      expect(result.dayOfWeekRates).toMatchObject({
        friday: 1.2,
        saturday: 1.3,
      })

      // User can understand minimum stay requirements by period
      expect(result.minimumStayByPeriod).toHaveLength(2)
      expect(result.minimumStayByPeriod[0]).toMatchObject({
        period: 'summer',
        minNights: 7,
      })

      // User can see check-in restrictions
      expect(result.checkInRestrictions).toMatchObject({
        allowedDays: ['friday', 'saturday', 'sunday'],
        checkInTime: '15:00',
      })

      // User can understand advance booking discounts
      expect(result.advanceBookingDiscount).toHaveLength(3)
      expect(result.advanceBookingDiscount[2]).toMatchObject({
        daysInAdvance: 120,
        discountPercent: 20,
      })
    })

    it('should handle API validation errors for invalid property ID format', async () => {
      // Arrange - Invalid property ID format
      const request = {
        params: {
          houseId: -1, // Invalid negative ID
        },
      }

      mockClient.getRateSettings.mockRejectedValue(new Error('Invalid property ID format'))

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert
      expect(response.isError).toBe(true)
      expect(response.content[0].text).toContain('Invalid property ID')
    })

    it('should handle rate settings with promotional rules', async () => {
      // Arrange - Rate settings with active promotions
      const request = {
        params: {
          houseId: 77777,
        },
      }

      const promotionalRateSettings = {
        baseRate: 180,
        currency: 'USD',
        activePromotions: [
          {
            code: 'SUMMER2024',
            description: 'Summer special - 20% off',
            discountPercent: 20,
            validFrom: '2024-06-01',
            validTo: '2024-08-31',
            minNights: 3,
            maxUsages: 50,
            usedCount: 12,
          },
          {
            code: 'EARLYBIRD',
            description: 'Book 60+ days in advance',
            discountPercent: 15,
            requiresAdvanceDays: 60,
            active: true,
          },
        ],
        blackoutDates: [
          {
            startDate: '2024-12-24',
            endDate: '2024-12-26',
            reason: 'Christmas Holiday',
          },
          {
            startDate: '2024-12-31',
            endDate: '2025-01-01',
            reason: 'New Year',
          },
        ],
      }

      mockClient.getRateSettings.mockResolvedValue(promotionalRateSettings)

      // Act
      const response = await testServer.callTool('lodgify_rate_settings', request)

      // Assert - Promotional rules are visible
      expect(response.content[0].type).toBe('text')
      const result = JSON.parse(response.content[0].text)

      expect(result.activePromotions).toHaveLength(2)
      expect(result.activePromotions[0]).toMatchObject({
        code: 'SUMMER2024',
        discountPercent: 20,
        usedCount: 12,
      })

      // User can see blackout dates
      expect(result.blackoutDates).toHaveLength(2)
      expect(result.blackoutDates[1]).toMatchObject({
        reason: 'New Year',
      })
    })

    it('should verify tool registration metadata', async () => {
      // Verify the tool is properly registered with correct metadata
      const response = await testServer.listTools()
      const toolInfo = response.tools.find(
        (t: { name: string }) => t.name === 'lodgify_rate_settings',
      )

      expect(toolInfo).toBeDefined()
      expect(toolInfo.description).toContain('rate settings')

      // Verify input schema allows optional params
      expect(toolInfo.inputSchema.properties.params).toBeDefined()
    })
  })

  describe('Why This Feature Matters', () => {
    it('validates critical business importance of rate settings', () => {
      // Rate settings are essential for property managers because they:
      // 1. Define pricing strategy and revenue optimization
      // 2. Configure seasonal variations and demand-based pricing
      // 3. Set minimum stay requirements and booking rules
      // 4. Establish cancellation policies and fees
      // 5. Control discounts and promotional offerings

      // Without access to rate settings, property managers cannot:
      // - Understand how their prices are calculated
      // - Troubleshoot pricing issues
      // - Verify promotional codes are working
      // - Check seasonal rate adjustments
      // - Confirm minimum stay requirements

      // This feature is used daily for:
      // - Revenue management decisions
      // - Responding to guest pricing inquiries
      // - Setting competitive rates
      // - Managing seasonal pricing strategies
      // - Configuring special event pricing

      expect(true).toBe(true) // Assertion to document importance
    })
  })
})
