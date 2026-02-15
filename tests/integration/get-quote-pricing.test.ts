/**
 * Integration tests for lodgify_get_quote MCP tool
 * Tests the critical pricing quote functionality that property managers depend on for accurate pricing
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { TestServer } from '../test-server.js'
import { createTestServer } from '../test-server.js'
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'

describe('Rate Tools - Critical Pricing Quote Feature', () => {
  let testServer: TestServer
  let mockClient: any

  beforeEach(async () => {
    mockClient = {
      getQuote: () => Promise.resolve(),
    }
    testServer = createTestServer(mockClient)
  })

  afterEach(() => {
    // Clean up any mocks
  })

  describe('lodgify_get_quote - Property Pricing Calculator for Guests', () => {
    describe('Successful Quote Calculations', () => {
      test('should calculate pricing quote with basic parameters', async () => {
        const mockQuoteResponse = {
          propertyId: '684855',
          arrival: '2025-09-01',
          departure: '2025-09-03',
          totalPrice: 450.00,
          currency: 'USD',
          nightlyRate: 225.00,
          nights: 2,
          available: true,
          breakdown: {
            accommodation: 400.00,
            taxes: 50.00,
            fees: 0
          }
        }

        mockClient.getQuote = async (propertyId: string, params: any) => {
          expect(propertyId).toBe('684855')
          expect(params.arrival).toBe('2025-09-01')
          expect(params.departure).toBe('2025-09-03')
          expect(params['roomTypes[0].Id']).toBe(751902)
          expect(params['guest_breakdown[adults]']).toBe(2)
          return mockQuoteResponse
        }

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '684855',
          params: {
            from: '2025-09-01',
            to: '2025-09-03',
            'roomTypes[0].Id': 751902,
            'guest_breakdown[adults]': 2
          }
        })

        const responseText = response.content[0].text
        const result = responseText ? JSON.parse(responseText) : undefined
        expect(result).toBeDefined()
        expect(result.totalPrice).toBe(450.00)
        expect(result.currency).toBe('USD')
        expect(result.available).toBe(true)
      })

      test('should handle arrival/departure date format variations', async () => {
        const mockQuoteResponse = {
          totalPrice: 600.00,
          currency: 'EUR',
          available: true
        }

        mockClient.getQuote = async (propertyId: string, params: any) => {
          // Should normalize to arrival/departure
          expect(params.arrival).toBe('2025-10-15')
          expect(params.departure).toBe('2025-10-18')
          return mockQuoteResponse
        }

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '123456',
          params: {
            arrival: '2025-10-15',
            departure: '2025-10-18',
            'roomTypes[0].Id': 999,
            'guest_breakdown[adults]': 4
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.totalPrice).toBe(600.00)
        expect(result.currency).toBe('EUR')
      })

      test('should calculate complex quote with multiple room types and guests', async () => {
        const mockQuoteResponse = {
          totalPrice: 1250.00,
          currency: 'USD',
          rooms: [
            { id: 101, name: 'Suite', price: 750.00 },
            { id: 102, name: 'Standard', price: 500.00 }
          ],
          guestBreakdown: {
            adults: 4,
            children: 2,
            infants: 1
          }
        }

        mockClient.getQuote = async (propertyId: string, params: any) => {
          expect(params['roomTypes[0].Id']).toBe(101)
          expect(params['roomTypes[1].Id']).toBe(102)
          expect(params['guest_breakdown[adults]']).toBe(4)
          expect(params['guest_breakdown[children]']).toBe(2)
          expect(params['guest_breakdown[infants]']).toBe(1)
          return mockQuoteResponse
        }

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '789',
          params: {
            from: '2025-07-01',
            to: '2025-07-07',
            'roomTypes[0].Id': 101,
            'roomTypes[1].Id': 102,
            'guest_breakdown[adults]': 4,
            'guest_breakdown[children]': 2,
            'guest_breakdown[infants]': 1
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.totalPrice).toBe(1250.00)
        expect(result.rooms.length).toBe(2)
      })

      test('should include seasonal pricing information', async () => {
        const mockQuoteResponse = {
          totalPrice: 3500.00,
          currency: 'USD',
          season: 'Peak Summer',
          priceModifier: 1.5,
          standardRate: 2333.33,
          seasonalRate: 3500.00,
          message: 'Peak season rates apply'
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '456',
          params: {
            from: '2025-08-01',
            to: '2025-08-07',
            'roomTypes[0].Id': 200,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.season).toBe('Peak Summer')
        expect(result.priceModifier).toBe(1.5)
        expect(result.message).toContain('Peak season')
      })

      test('should handle minimum stay requirements in quote', async () => {
        const mockQuoteResponse = {
          totalPrice: 900.00,
          currency: 'USD',
          minimumStay: 3,
          nights: 3,
          available: true,
          restrictions: {
            minNights: 3,
            maxNights: 14,
            checkInDays: ['Friday', 'Saturday']
          }
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '321',
          params: {
            from: '2025-06-20',
            to: '2025-06-23',
            'roomTypes[0].Id': 150,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.minimumStay).toBe(3)
        expect(result.restrictions.minNights).toBe(3)
      })
    })

    describe('Date Validation and Normalization', () => {
      test('should normalize ISO date-time to YYYY-MM-DD format', async () => {
        const mockQuoteResponse = { totalPrice: 500.00, currency: 'USD' }

        mockClient.getQuote = async (propertyId: string, params: any) => {
          // Should normalize ISO dates to YYYY-MM-DD
          expect(params.arrival).toBe('2025-09-15')
          expect(params.departure).toBe('2025-09-20')
          return mockQuoteResponse
        }

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '111',
          params: {
            from: '2025-09-15T14:00:00Z',
            to: '2025-09-20T11:00:00Z',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.totalPrice).toBe(500.00)
      })

      test('should reject invalid date formats', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '222',
            params: {
              from: '15/09/2025', // Invalid format
              to: '20/09/2025',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/Invalid arrival date/)
      })

      test('should reject when end date is before start date', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '333',
            params: {
              from: '2025-09-20',
              to: '2025-09-15', // End before start
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/Invalid date range/)
      })

      test('should handle dates in the past with warning', async () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const dayBeforeYesterday = new Date()
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)

        const mockQuoteResponse = {
          totalPrice: 0,
          available: false,
          message: 'Dates are in the past'
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '444',
          params: {
            from: dayBeforeYesterday.toISOString().split('T')[0],
            to: yesterday.toISOString().split('T')[0],
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.available).toBe(false)
      })

      test('should handle same-day quotes (0 nights)', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '555',
            params: {
              from: '2025-09-15',
              to: '2025-09-15', // Same day
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/Invalid date range/)
      })
    })

    describe('Error Handling', () => {
      test('should handle property not found errors', async () => {
        mockClient.getQuote = async () => {
          throw new Error('404: Property not found')
        }

        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '99999',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow('Property not found')
      })

      test('should handle unavailable property for dates', async () => {
        const mockQuoteResponse = {
          available: false,
          totalPrice: 0,
          message: 'Property is not available for the selected dates',
          alternativeDates: [
            { from: '2025-09-10', to: '2025-09-12' },
            { from: '2025-09-15', to: '2025-09-17' }
          ]
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '666',
          params: {
            from: '2025-09-01',
            to: '2025-09-03',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.available).toBe(false)
        expect(result.message).toContain('not available')
        expect(result.alternativeDates).toBeDefined()
      })

      test('should handle network timeout errors', async () => {
        mockClient.getQuote = async () => {
          throw new Error('Network timeout')
        }

        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '777',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow('Network timeout')
      })

      test('should handle property configuration issues', async () => {
        mockClient.getQuote = async () => {
          throw new Error('500: Error getting property configuration')
        }

        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '888',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/property configuration/)
      })

      test('should handle rate limiting (429) errors', async () => {
        mockClient.getQuote = async () => {
          const error = new Error('429: Too Many Requests')
          ;(error as any).statusCode = 429
          throw error
        }

        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '999',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow('429')
      })
    })

    describe('Required Parameter Validation', () => {
      test('should reject missing property ID', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow()
      })

      test('should reject missing dates', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '123',
            params: {
              'roomTypes[0].Id': 100,
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/Invalid arrival date/)
      })

      test('should reject missing room type', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '123',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'guest_breakdown[adults]': 2
            }
          })
        ).rejects.toThrow(/room type/)
      })

      test('should reject missing guest count', async () => {
        await expect(
          testServer.callTool('lodgify_get_quote', {
            propertyId: '123',
            params: {
              from: '2025-09-01',
              to: '2025-09-03',
              'roomTypes[0].Id': 100
            }
          })
        ).rejects.toThrow(/number of adults/)
      })
    })

    describe('Response Format (Raw API Response)', () => {
      test('should return quote response with pricing details', async () => {
        const mockQuoteResponse = {
          totalPrice: 750.00,
          currency: 'USD',
          available: true
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '1111',
          params: {
            from: '2025-09-01',
            to: '2025-09-03',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.totalPrice).toBe(750.00)
        expect(result.currency).toBe('USD')
        expect(result.available).toBe(true)
      })

      test('should include pricing breakdown when available', async () => {
        const mockQuoteResponse = {
          totalPrice: 550.00,
          currency: 'USD',
          breakdown: {
            accommodation: 450.00,
            taxes: 50.00,
            fees: 30.00,
            discount: -20.00,
            extras: 40.00
          }
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '3333',
          params: {
            from: '2025-11-01',
            to: '2025-11-03',
            'roomTypes[0].Id': 300,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.breakdown).toBeDefined()
        expect(result.breakdown.accommodation).toBe(450.00)
        expect(result.breakdown.taxes).toBe(50.00)
      })
    })

    describe('Edge Cases', () => {
      test('should handle empty API response gracefully', async () => {
        mockClient.getQuote = async () => ({})

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '4444',
          params: {
            from: '2025-09-01',
            to: '2025-09-03',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result).toEqual({})
      })

      test('should handle very long stay quotes (30+ nights)', async () => {
        const mockQuoteResponse = {
          totalPrice: 6000.00,
          currency: 'USD',
          nights: 35,
          longTermDiscount: 0.15,
          message: 'Long-term stay discount applied'
        }

        mockClient.getQuote = async () => mockQuoteResponse

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: '5555',
          params: {
            from: '2025-09-01',
            to: '2025-10-06',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.nights).toBe(35)
        expect(result.longTermDiscount).toBe(0.15)
      })

      test('should handle special characters in property ID', async () => {
        const mockQuoteResponse = { totalPrice: 400.00, currency: 'USD' }

        mockClient.getQuote = async (propertyId: string) => {
          expect(propertyId).toBe('prop-123-special')
          return mockQuoteResponse
        }

        const response = await testServer.callTool('lodgify_get_quote', {
          propertyId: 'prop-123-special',
          params: {
            from: '2025-09-01',
            to: '2025-09-03',
            'roomTypes[0].Id': 100,
            'guest_breakdown[adults]': 2
          }
        })

        const result = JSON.parse(response.content[0].text)
        expect(result.totalPrice).toBe(400.00)
      })
    })
  })
})