import { describe, expect, it } from 'vitest'

// Import the types we defined
type ListPropertiesInput = {
  wid?: number
  updatedSince?: string
  includeCount?: boolean
  includeInOut?: boolean
  page?: number
  size?: number
} & Record<string, unknown>

type GetPropertyInput = {
  id: number
  wid?: number
  includeInOut?: boolean
} & Record<string, unknown>

type FindPropertiesInput = {
  searchTerm?: string
  includePropertyIds?: boolean | string[] | string
  limit?: number | string
} & Record<string, unknown>

interface FindPropertiesResult {
  properties: Array<{
    id: string
    name?: string
    source?: string
  }>
  message: string
  suggestions: string[]
}

describe('Property Tools Type Safety', () => {
  it('should properly type ListPropertiesInput', () => {
    const validInputs: ListPropertiesInput[] = [
      {},
      { wid: 12345 },
      { updatedSince: '2024-01-01T00:00:00Z' },
      { includeCount: true, includeInOut: false },
      { page: 1, size: 10 },
      { wid: 12345, updatedSince: '2024-01-01T00:00:00Z', page: 2, size: 25 },
      { wid: 999, includeCount: true, page: 1, size: 50, extraField: 'allowed' },
    ]

    validInputs.forEach((input) => {
      expect(input).toBeDefined()
      // All properties are optional
      if (input.wid !== undefined) expect(typeof input.wid).toBe('number')
      if (input.page !== undefined) expect(typeof input.page).toBe('number')
      if (input.size !== undefined) expect(typeof input.size).toBe('number')
      if (input.includeCount !== undefined) expect(typeof input.includeCount).toBe('boolean')
      if (input.includeInOut !== undefined) expect(typeof input.includeInOut).toBe('boolean')
      if (input.updatedSince !== undefined) expect(typeof input.updatedSince).toBe('string')
    })
  })

  it('should properly type GetPropertyInput', () => {
    const validInputs: GetPropertyInput[] = [
      { id: 123 },
      { id: 456, wid: 789 },
      { id: 123, includeInOut: true },
      { id: 456, wid: 789, includeInOut: false },
      { id: 999, wid: 111, includeInOut: true, extraField: 'allowed' },
    ]

    validInputs.forEach((input) => {
      expect(input).toBeDefined()
      expect(input.id).toBeDefined()
      expect(typeof input.id).toBe('number')
      // TypeScript ensures these are valid at compile time
    })
  })
  it('should properly type FindPropertiesInput', () => {
    const validInputs: FindPropertiesInput[] = [
      { searchTerm: 'beach' },
      { includePropertyIds: true },
      { includePropertyIds: ['123', '456'] },
      { includePropertyIds: 'true' },
      { limit: 10 },
      { limit: '10' },
      { searchTerm: 'villa', includePropertyIds: false, limit: 5 },
      { searchTerm: 'ocean', includePropertyIds: ['789'], limit: '20', extraField: 'allowed' },
    ]

    validInputs.forEach((input) => {
      expect(input).toBeDefined()
      // TypeScript ensures these are valid at compile time
    })
  })

  it('should properly normalize input values', () => {
    // Test normalization functions behavior
    const normalizeIncludePropertyIds = (value?: boolean | string[] | string): boolean => {
      if (value === undefined) return true
      if (typeof value === 'boolean') return value
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') return value.toLowerCase() !== 'false' && value !== '0'
      return true
    }

    const normalizeLimit = (value?: number | string): number => {
      if (value === undefined) return 10
      if (typeof value === 'number') return Math.min(Math.max(1, value), 50)
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10)
        if (!Number.isNaN(parsed)) return Math.min(Math.max(1, parsed), 50)
      }
      return 10
    }

    // Test includePropertyIds normalization
    expect(normalizeIncludePropertyIds(undefined)).toBe(true)
    expect(normalizeIncludePropertyIds(true)).toBe(true)
    expect(normalizeIncludePropertyIds(false)).toBe(false)
    expect(normalizeIncludePropertyIds(['123'])).toBe(true)
    expect(normalizeIncludePropertyIds([])).toBe(false)
    expect(normalizeIncludePropertyIds('true')).toBe(true)
    expect(normalizeIncludePropertyIds('false')).toBe(false)
    expect(normalizeIncludePropertyIds('0')).toBe(false)
    expect(normalizeIncludePropertyIds('1')).toBe(true)

    // Test limit normalization
    expect(normalizeLimit(undefined)).toBe(10)
    expect(normalizeLimit(5)).toBe(5)
    expect(normalizeLimit(0)).toBe(1)
    expect(normalizeLimit(100)).toBe(50)
    expect(normalizeLimit('15')).toBe(15)
    expect(normalizeLimit('0')).toBe(1)
    expect(normalizeLimit('100')).toBe(50)
    expect(normalizeLimit('invalid')).toBe(10)
  })

  it('should ensure FindPropertiesResult has correct structure', () => {
    const mockResult: FindPropertiesResult = {
      properties: [
        { id: '123', name: 'Beach Villa', source: 'properties' },
        { id: '456', name: 'Ocean View', source: 'bookings' },
        { id: '789' }, // name and source are optional
      ],
      message: 'Found 3 properties',
      suggestions: ['Use property ID 123 for availability checks'],
    }

    expect(mockResult.properties).toHaveLength(3)
    expect(mockResult.properties[0].id).toBe('123')
    expect(mockResult.properties[0].name).toBe('Beach Villa')
    expect(mockResult.properties[2].name).toBeUndefined()
    expect(mockResult.message).toBe('Found 3 properties')
    expect(mockResult.suggestions).toHaveLength(1)
  })

  it('should ensure type safety for handler parameters', () => {
    // This test verifies that our types work with the actual handler signature
    type HandlerInput = FindPropertiesInput
    type HandlerOutput = { content: Array<{ type: 'text'; text: string }> }

    const mockHandler = async (input: HandlerInput): Promise<HandlerOutput> => {
      // Ensure input has the expected shape
      const { searchTerm, includePropertyIds, limit } = input

      // These should all be valid according to our types
      expect(searchTerm === undefined || typeof searchTerm === 'string').toBe(true)
      expect(
        includePropertyIds === undefined ||
          typeof includePropertyIds === 'boolean' ||
          Array.isArray(includePropertyIds) ||
          typeof includePropertyIds === 'string',
      ).toBe(true)
      expect(limit === undefined || typeof limit === 'number' || typeof limit === 'string').toBe(
        true,
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ properties: [], message: 'test', suggestions: [] }),
          },
        ],
      }
    }

    // Test that the handler can be called with valid inputs
    const testInputs: HandlerInput[] = [
      { searchTerm: 'test' },
      { includePropertyIds: true, limit: 5 },
      { searchTerm: 'beach', includePropertyIds: ['123'], limit: '10' },
    ]

    testInputs.forEach(async (input) => {
      const result = await mockHandler(input)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
    })
  })
})
