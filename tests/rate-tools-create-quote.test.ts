/**
 * lodgify_create_booking_quote tool: real Lodgify schema, read-back result, legacy rejection.
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { McpError } from '@modelcontextprotocol/sdk/types.js'
import { ReadOnlyModeError } from '../src/core/errors/read-only-error.js'
import { getRateTools } from '../src/mcp/tools/rate-tools.js'

describe('lodgify_create_booking_quote', () => {
  let attachBookingQuote: ReturnType<typeof mock>
  let handler: (input: Record<string, unknown>) => Promise<{ content: { text: string }[] }>

  const stored = {
    quoteId: 23159953,
    status: 'NotScheduled',
    policy: 'N/A',
    isPolicyActive: false,
    totalAmount: 663.25,
    currency: 'USD',
    lines: [{ type: 'RoomRate', amount: 579 }],
    bookingStatus: 'Booked',
  }

  beforeEach(() => {
    attachBookingQuote = mock().mockResolvedValue(stored)
    const tools = getRateTools(() => ({ attachBookingQuote }) as never)
    const tool = tools.find((t) => t.name === 'lodgify_create_booking_quote')
    if (!tool) throw new Error('tool not registered')
    handler = tool.handler as typeof handler
  })

  const run = async (input: Record<string, unknown>) =>
    JSON.parse((await handler(input)).content[0].text)

  it('sends Lodgify fields with the policy off by default', async () => {
    await run({ bookingId: 24415735 })

    expect(attachBookingQuote).toHaveBeenCalledWith(24415735, { is_policy_active: false })
  })

  it('passes promotion code, room types and add-ons through', async () => {
    await run({
      bookingId: '1',
      promotion_code: 'DIRECT10',
      room_types: [{ room_type_id: 5 }],
      add_ons: [{ add_on_id: 9, units: 2 }],
    })

    expect(attachBookingQuote).toHaveBeenCalledWith('1', {
      is_policy_active: false,
      promotion_code: 'DIRECT10',
      room_types: [{ room_type_id: 5 }],
      add_ons: [{ add_on_id: 9, units: 2 }],
    })
  })

  it('takes details from Lodgify, not from the request', async () => {
    const response = await run({ bookingId: 1 })

    expect(response.operation.status).toBe('success')
    expect(response.data.quoteId).toBe(23159953)
    expect(response.data.totalAmount).toBe(663.25)
    expect(response.summary).toContain('663.25')
  })

  it.each([
    ['payload', { payload: { totalPrice: 100 } }],
    ['totalPrice', { totalPrice: 100 }],
    ['replaceExisting', { replaceExisting: true }],
  ])('rejects the legacy field %s instead of ignoring it', async (name, extra) => {
    const error = await handler({ bookingId: 1, ...extra }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(McpError)
    expect((error as McpError).message).toContain(name)
    expect(attachBookingQuote).not.toHaveBeenCalled()
  })

  it('reports partial when Lodgify priced the stay differently from expected_total', async () => {
    const response = await run({ bookingId: 1, expected_total: 3008.34 })

    expect(response.operation.status).toBe('partial')
    expect(response.warnings.join(' ')).toContain('priced the stay at 663.25')
  })

  it.each([
    [663.25, 'success'],
    [663.26, 'success'], // exactly one cent
    [663.24, 'success'],
    [663.27, 'partial'], // two cents
  ])('expected_total %p gives %s', async (expected, status) => {
    const response = await run({ bookingId: 1, expected_total: expected })

    expect(response.operation.status).toBe(status)
  })

  it('warns when a promotion code produced no Promotion line', async () => {
    const response = await run({ bookingId: 1, promotion_code: 'NOSUCHCODE' })

    expect(response.operation.status).toBe('partial')
    expect(response.warnings.join(' ')).toContain('NOSUCHCODE')
  })

  it('does not warn when the Promotion line is present', async () => {
    attachBookingQuote.mockResolvedValue({
      ...stored,
      lines: [...stored.lines, { type: 'Promotion', amount: -50 }],
    })

    const response = await run({ bookingId: 1, promotion_code: 'DIRECT10' })

    expect(response.operation.status).toBe('success')
  })

  it('warns that an active policy blocks payment links', async () => {
    attachBookingQuote.mockResolvedValue({
      ...stored,
      status: 'NotSent',
      policy: 'Primary policy',
      isPolicyActive: true,
      bookingStatus: 'Tentative',
    })

    const response = await run({ bookingId: 1, is_policy_active: true })

    expect(response.operation.status).toBe('partial')
    expect(response.warnings.join(' ')).toContain('payment links')
  })

  it('propagates read-only mode errors', async () => {
    attachBookingQuote.mockRejectedValue(new ReadOnlyModeError('Create Booking Quote', '/x'))

    await expect(handler({ bookingId: 1 })).rejects.toThrow()
  })
})
