import { describe, expect, it } from 'bun:test'
import {
  enhanceResponse,
  extractEntityDetails,
  flexibleEnhanceResponse,
  formatMcpResponse,
} from '../../../src/mcp/utils/response/builder.js'
import type {
  ApiResponseData,
  EnhancedResponse,
  EnhanceOptions,
  FlexibleBuilderOptions,
} from '../../../src/mcp/utils/response/types.js'

describe('ResponseBuilder', () => {
  describe('enhanceResponse', () => {
    it('should build a successful response with all fields', () => {
      const data = {
        id: 123,
        name: 'Test Property',
        status: 'active',
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'property',
        status: 'success',
        inputParams: { propertyId: '123' },
        customSuggestions: ['View property details', 'Check availability'],
        customWarnings: ['Property has limited availability'],
        customSummary: 'Successfully retrieved property information',
      }

      const result = enhanceResponse(data, options)

      expect(result.operation.type).toBe('read')
      expect(result.operation.entity).toBe('property')
      expect(result.operation.status).toBe('success')
      expect(result.summary).toBe('Successfully retrieved property information')
      expect(result.suggestions).toEqual(['View property details', 'Check availability'])
      expect(result.warnings).toEqual(['Property has limited availability'])
      expect(result.data).toEqual(data)
      expect(result.details.id).toBe('123') // getStringOrNumber returns strings
      expect(result.details.name).toBe('Test Property')
    })

    it('should handle error responses', () => {
      const errorData = {
        error: 'Not found',
        statusCode: 404,
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'booking',
        status: 'failed',
        inputParams: { bookingId: '999' },
      }

      const result = enhanceResponse(errorData, options)

      expect(result.operation.status).toBe('failed')
      expect(result.summary).toContain('Failed to')
      expect(result.data).toEqual(errorData)
    })

    it('should handle null and undefined data gracefully', () => {
      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'booking',
        status: 'success',
      }

      const result1 = enhanceResponse(null, options)
      expect(result1.data).toEqual({})
      expect(result1.details).toBeDefined()

      const result2 = enhanceResponse(undefined, options)
      expect(result2.data).toEqual({})
      expect(result2.details).toBeDefined()
    })

    it('should generate default summary when not provided', () => {
      const data = { id: 1 }
      const options: EnhanceOptions = {
        operationType: 'update',
        entityType: 'rate',
        status: 'success',
        inputParams: { property_id: 123 },
      }

      const result = enhanceResponse(data, options)

      expect(result.summary).toContain('Successfully updated')
      expect(result.summary).toContain('rate')
    })

    it('should handle partial success status', () => {
      const data = {
        processed: 5,
        failed: 2,
        total: 7,
      }

      const options: EnhanceOptions = {
        operationType: 'create',
        entityType: 'booking',
        status: 'partial',
      }

      const result = enhanceResponse(data, options)

      expect(result.operation.status).toBe('partial')
      expect(result.summary).toContain('Partially')
    })
  })

  describe('extractEntityDetails', () => {
    it('should extract booking details correctly', () => {
      const apiData: ApiResponseData = {
        id: 'BK001',
        guest: { name: 'John Doe', email: 'john@example.com' },
        checkIn: '2024-03-15',
        checkOut: '2024-03-22',
        totalAmount: 1500,
        status: 'confirmed',
      }

      const details = extractEntityDetails('booking', apiData)

      expect(details.bookingId).toBe('BK001')
      expect(details.guest).toBe('Guest') // Default guest name
      expect(details.checkIn).toBe('March 15, 2024') // formatDate formats dates
      expect(details.checkOut).toBe('March 22, 2024') // formatDate formats dates
      expect(details.amount).toBe('$1,500.00') // formatCurrency formats amounts
      expect(details.status).toBe('Confirmed') // formatStatus capitalizes status
    })

    it('should extract property details correctly', () => {
      const apiData: ApiResponseData = {
        id: 123,
        name: 'Beach House',
        location: 'Miami',
        status: 'active',
      }

      const details = extractEntityDetails('property', apiData)

      expect(details.id).toBe('123') // getStringOrNumber returns strings
      expect(details.name).toBe('Beach House')
      expect(details.status).toBe('active')
    })

    it('should extract webhook details correctly', () => {
      const apiData: ApiResponseData = {
        id: 'webhook_123',
        event: 'booking_new_status_booked',
        targetUrl: 'https://example.com/webhook', // Should be targetUrl not target_url
      }

      const inputParams: ApiResponseData = {
        event: 'booking_new_status_booked',
      }

      const details = extractEntityDetails('webhook', apiData, inputParams)

      expect(details.webhookId).toBe('webhook_123')
      expect(details.event).toBe('booking_new_status_booked')
      expect(details.targetUrl).toBe('https://example.com/webhook')
    })

    it('should extract quote details with booking ID from input params', () => {
      const apiData: ApiResponseData = {
        id: 'Q123',
        totalPrice: 1000,
        currency: 'USD',
        validUntil: '2024-04-01',
      }

      const inputParams: ApiResponseData = {
        bookingId: 'BK456',
        payload: {
          totalPrice: 1000,
          currency: 'USD',
        },
      }

      const details = extractEntityDetails('quote', apiData, inputParams)

      expect(details.bookingId).toBe('BK456')
      expect(details.quoteId).toBe('Q123')
      expect(details.totalPrice).toBe('$1,000.00')
      expect(details.validUntil).toBeDefined() // Date formatting may vary
    })

    it('should extract vacant inventory details correctly', () => {
      const apiData: ApiResponseData = {
        properties: [
          { id: '1', available: true },
          { id: '2', available: false },
          { id: '3', available: true },
        ],
        counts: {
          propertiesChecked: 3,
          availableProperties: 2,
          unavailableProperties: 1,
        },
      }

      const details = extractEntityDetails('vacant_inventory', apiData)

      expect(details.propertiesChecked).toBe(3)
      expect(details.availableProperties).toBe(2)
      expect(details.vacantCount).toBe(2)
    })

    it('should handle unknown entity types gracefully', () => {
      const apiData: ApiResponseData = {
        id: 999,
        name: 'Unknown Entity',
        status: 'test',
      }

      // biome-ignore lint/suspicious/noExplicitAny: Testing edge case with unknown entity type
      const details = extractEntityDetails('unknown' as any, apiData)

      expect(details.id).toBe('999') // getStringOrNumber returns strings
      expect(details.name).toBe('Unknown Entity')
      expect(details.status).toBe('test')
    })

    it('should handle missing or malformed data gracefully', () => {
      const details1 = extractEntityDetails('booking', {})
      expect(details1).toBeDefined()
      expect(details1.guest).toBe('Guest') // Default guest name

      // biome-ignore lint/suspicious/noExplicitAny: Testing null data handling
      const details2 = extractEntityDetails('property', null as any)
      expect(details2).toBeDefined()
      expect(Object.keys(details2)).toHaveLength(0) // Empty object for null data

      // biome-ignore lint/suspicious/noExplicitAny: Testing undefined data handling
      const details3 = extractEntityDetails('rate', undefined as any)
      expect(details3).toBeDefined()
      expect(details3.property).toBe('Property') // Default property name

      // biome-ignore lint/suspicious/noExplicitAny: Testing null data handling
      const details4 = extractEntityDetails('webhook', null as any)
      expect(details4).toBeDefined()
      expect(details4.event).toBe('unknown') // Default event name
    })
  })

  describe('flexibleEnhanceResponse', () => {
    it('should handle FlexibleBuilderOptions format', () => {
      const data = { id: 1, name: 'Test' }
      const options: FlexibleBuilderOptions = {
        entityType: 'property',
        operation: 'list',
        status: 'success',
        inputParams: { page: 1 },
        extractedInfo: { count: 10 },
        metadata: {
          summary: 'Found 10 properties',
          suggestions: ['View next page'],
          warnings: ['Limited results'],
        },
      }

      const result = flexibleEnhanceResponse(data, options)

      expect(result.operation.type).toBe('list')
      expect(result.operation.entity).toBe('property')
      expect(result.summary).toBe('Found 10 properties')
      expect(result.suggestions).toEqual(['View next page'])
      expect(result.warnings).toEqual(['Limited results'])
    })

    it('should handle EnhanceOptions format (backward compatibility)', () => {
      const data = { id: 1 }
      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'booking',
        status: 'success',
      }

      const result = flexibleEnhanceResponse(data, options)

      expect(result.operation.type).toBe('read')
      expect(result.operation.entity).toBe('booking')
      expect(result.operation.status).toBe('success')
    })

    it('should merge extracted info into data', () => {
      const data = { id: 1, name: 'Original' }
      const options: FlexibleBuilderOptions = {
        entityType: 'property',
        operation: 'read',
        extractedInfo: {
          additionalField: 'Extra data',
          count: 5,
        },
      }

      const result = flexibleEnhanceResponse(data, options)

      expect(result.data).toHaveProperty('_extracted')
      // biome-ignore lint/suspicious/noExplicitAny: Testing dynamic extracted data structure
      expect((result.data as any)._extracted.additionalField).toBe('Extra data')
      // biome-ignore lint/suspicious/noExplicitAny: Testing dynamic extracted data structure
      expect((result.data as any)._extracted.count).toBe(5)
    })

    it('should use operationType if operation is not provided', () => {
      const options: FlexibleBuilderOptions = {
        entityType: 'booking',
        operationType: 'create',
        status: 'success',
      }

      const result = flexibleEnhanceResponse({}, options)

      expect(result.operation.type).toBe('create')
    })

    it('should default to "read" operation if neither provided', () => {
      const options: FlexibleBuilderOptions = {
        entityType: 'property',
      }

      const result = flexibleEnhanceResponse({}, options)

      expect(result.operation.type).toBe('read')
    })
  })

  describe('formatMcpResponse', () => {
    it('should format enhanced response as pretty JSON', () => {
      const enhanced: EnhancedResponse = {
        operation: {
          type: 'read',
          entity: 'property',
          status: 'success',
          timestamp: '2024-01-01T00:00:00Z',
        },
        summary: 'Test summary',
        details: { id: 1 },
        data: { test: 'data' },
        suggestions: ['Test suggestion'],
      }

      const formatted = formatMcpResponse(enhanced)

      expect(formatted).toBeTypeOf('string')
      expect(formatted).toContain('"type": "read"')
      expect(formatted).toContain('"entity": "property"')
      expect(formatted).toContain('"summary": "Test summary"')
      expect(formatted).toContain('Test suggestion')

      // Should be pretty formatted with 2-space indentation
      const lines = formatted.split('\n')
      expect(lines.length).toBeGreaterThan(1)
      expect(lines[1]).toMatch(/^ {2}/)
    })

    it('should handle complex nested structures', () => {
      const enhanced: EnhancedResponse = {
        operation: {
          type: 'create',
          entity: 'booking',
          status: 'success',
          timestamp: new Date().toISOString(),
        },
        summary: 'Booking created',
        details: {
          booking: {
            id: 'BK001',
            guest: {
              name: 'John Doe',
              contact: {
                email: 'john@example.com',
                phone: '+1234567890',
              },
            },
            dates: {
              checkIn: '2024-03-15',
              checkOut: '2024-03-22',
            },
          },
        },
        data: {},
        suggestions: ['Send confirmation', 'Update calendar'],
        warnings: ['Peak season pricing'],
      }

      const formatted = formatMcpResponse(enhanced)
      const parsed = JSON.parse(formatted)

      expect(parsed).toEqual(enhanced)
      expect(formatted).toContain('john@example.com')
      expect(formatted).toContain('Peak season pricing')
    })

    it('should handle responses with undefined optional fields', () => {
      const enhanced: EnhancedResponse = {
        operation: {
          type: 'read',
          entity: 'property',
          status: 'success',
          timestamp: '2024-01-01T00:00:00Z',
        },
        summary: 'Success',
        details: {},
        data: {},
        // No suggestions or warnings
      }

      const formatted = formatMcpResponse(enhanced)
      const parsed = JSON.parse(formatted)

      expect(parsed.suggestions).toBeUndefined()
      expect(parsed.warnings).toBeUndefined()
      expect(parsed.operation).toBeDefined()
      expect(parsed.summary).toBe('Success')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle circular references in data', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference handling
      const circularData: any = { id: 1 }
      circularData.self = circularData

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'property',
      }

      // This should not throw, as the implementation should handle circular refs
      const result = enhanceResponse(circularData, options)
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
    })

    it('should handle very large data sets', () => {
      const largeData: ApiResponseData = {
        items: Array(1000).fill({ id: 1, name: 'Item' }),
      }

      const options: EnhanceOptions = {
        operationType: 'list',
        entityType: 'property',
        status: 'success',
      }

      const result = enhanceResponse(largeData, options)

      expect(result.data).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: Testing large data set handling
      expect((result.data as any).items.length).toBe(1000)
    })

    it('should handle special characters in strings', () => {
      const data = {
        name: 'Test "Property" with \'quotes\' and \n newlines',
        description: 'Unicode: 🏠 💰 ✓',
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'property',
        customSummary: 'Property with special chars: "test" & 🏠',
      }

      const result = enhanceResponse(data, options)
      const formatted = formatMcpResponse(result)

      expect(formatted).toContain('Test \\"Property\\"')
      expect(formatted).toContain('Unicode: 🏠')
      expect(result.summary).toContain('🏠')
    })

    it('should handle date objects correctly', () => {
      const now = new Date()
      const data = {
        createdAt: now,
        updatedAt: now.toISOString(),
        scheduledFor: '2024-12-25',
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'booking',
      }

      const result = enhanceResponse(data, options)

      expect(result.data.createdAt).toBe(now)
      expect(result.data.updatedAt).toBe(now.toISOString())
      expect(result.data.scheduledFor).toBe('2024-12-25')
    })

    it('should handle numeric edge cases', () => {
      const data = {
        zero: 0,
        negative: -100,
        float: 99.99,
        largeNumber: Number.MAX_SAFE_INTEGER,
        infinity: Infinity,
        notANumber: NaN,
      }

      const options: EnhanceOptions = {
        operationType: 'read',
        entityType: 'rate',
      }

      const result = enhanceResponse(data, options)

      expect(result.data.zero).toBe(0)
      expect(result.data.negative).toBe(-100)
      expect(result.data.float).toBe(99.99)
      expect(result.data.largeNumber).toBe(Number.MAX_SAFE_INTEGER)
      expect(result.data.infinity).toBe(Infinity)
      expect(result.data.notANumber).toBeNaN()
    })
  })
})
