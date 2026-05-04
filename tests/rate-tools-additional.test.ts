import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { McpError } from '@modelcontextprotocol/sdk/types.js'
import { getRateTools } from '../src/mcp/tools/rate-tools.js'

describe('Rate tools additional coverage', () => {
  let mockClient: {
    rates: {
      getDailyRates: ReturnType<typeof mock>
      getRateSettings: ReturnType<typeof mock>
    }
    getQuote: ReturnType<typeof mock>
    updateRatesV1: ReturnType<typeof mock>
    createBookingQuote: ReturnType<typeof mock>
    isReadOnly: () => boolean
  }

  beforeEach(() => {
    mockClient = {
      rates: {
        getDailyRates: mock(),
        getRateSettings: mock(),
      },
      getQuote: mock(),
      updateRatesV1: mock(),
      createBookingQuote: mock(),
      isReadOnly: () => false,
    }
  })

  afterEach(() => {
    mock.restore()
  })

  it('loads global rate settings without a property filter', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_rate_settings',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.rates.getRateSettings.mockResolvedValue({})

    const result = await tool.handler({})
    const response = JSON.parse(result.content[0].text)

    expect(mockClient.rates.getRateSettings).toHaveBeenCalledWith({})
    expect(response.operation.type).toBe('get')
    expect(response.summary).toContain('rate')
  })

  it('stringifies the house id when requesting property-specific rate settings', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_rate_settings',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.rates.getRateSettings.mockResolvedValue({
      propertyId: 77,
      baseRate: 195,
      currency: 'USD',
    })

    const result = await tool.handler({ params: { houseId: 77 } })
    const response = JSON.parse(result.content[0].text)

    expect(mockClient.rates.getRateSettings).toHaveBeenCalledWith({ houseId: '77' })
    expect(response.data.propertyId).toBe(77)
    expect(response.suggestions.length).toBeGreaterThan(0)
  })

  it('converts from/to quote dates into arrival/departure parameters and fills guest defaults', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_get_quote',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.getQuote.mockResolvedValue({
      totalPrice: 420,
      currency: 'USD',
      quoteId: 'Q-1',
    })

    const result = await tool.handler({
      propertyId: 'prop-1',
      params: {
        from: '2026-06-01',
        to: '2026-06-03',
        'roomTypes[0].Id': 55,
      },
    })
    const response = JSON.parse(result.content[0].text)

    const quoteParams = mockClient.getQuote.mock.calls[0]?.[1]
    expect(mockClient.getQuote.mock.calls[0]?.[0]).toBe('prop-1')
    expect(quoteParams.arrival).toBe('2026-06-01')
    expect(quoteParams.departure).toBe('2026-06-03')
    expect(quoteParams['guest_breakdown[adults]']).toBe(2)
    expect(quoteParams['guest_breakdown[children]']).toBe(0)
    expect('from' in quoteParams).toBe(false)
    expect('to' in quoteParams).toBe(false)
    expect(response.operation.type).toBe('calculate')
    expect(response.data.totalPrice).toBe(420)
  })

  it('wraps quote validation errors in MCP invalid-params errors', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_get_quote',
    )
    if (!tool) throw new Error('Tool not found')

    let thrown: unknown
    try {
      await tool.handler({
        propertyId: 'prop-1',
        params: {
          arrival: 'bad-date',
          departure: '2026-06-03',
        },
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(McpError)
    expect((thrown as Error).message).toContain('Quote validation error')
  })

  it('preserves MCP validation wrapping for invalid date API responses', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_get_quote',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.getQuote.mockRejectedValue(new Error('400 Invalid dates supplied'))

    await expect(
      tool.handler({
        propertyId: 'prop-2',
        params: {
          arrival: '2026-07-01',
          departure: '2026-07-05',
          'roomTypes[0].Id': 1,
          'guest_breakdown[adults]': 2,
        },
      }),
    ).rejects.toThrow('Quote validation error: 400 Invalid dates supplied')
  })

  it('maps property configuration API failures to a friendly internal error', async () => {
    const tool = getRateTools(() => mockClient as never).find(
      (entry) => entry.name === 'lodgify_get_quote',
    )
    if (!tool) throw new Error('Tool not found')

    mockClient.getQuote.mockRejectedValue(new Error('500 Error getting property configuration'))

    await expect(
      tool.handler({
        propertyId: 'prop-3',
        params: {
          arrival: '2026-08-01',
          departure: '2026-08-03',
          'roomTypes[0].Id': 1,
          'guest_breakdown[adults]': 2,
        },
      }),
    ).rejects.toThrow(
      'Property configuration issue. The property may not be fully configured for quotes. Please verify the property settings in Lodgify.',
    )
  })
})
