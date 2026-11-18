/**
 * V1 Bookings Client - quote creation and read-back.
 * Lodgify answers POST /quote with a bare integer and builds the quote from rate plans.
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { BaseApiClient } from '../src/api/base-client'
import { BookingsV1Client } from '../src/api/v1/bookings/client'

describe('BookingsV1Client quote handling', () => {
  let client: BookingsV1Client
  let requestSpy: ReturnType<typeof mock>

  beforeEach(() => {
    requestSpy = mock()
    client = new BookingsV1Client({ request: requestSpy } as unknown as BaseApiClient)
  })

  describe('createBookingQuote', () => {
    it('posts the snake_case body Lodgify documents', async () => {
      requestSpy.mockResolvedValue(23159953)

      const id = await client.createBookingQuote(24415735, {
        is_policy_active: false,
        promotion_code: 'DIRECT10',
        room_types: [{ room_type_id: 751902 }],
      })

      expect(id).toBe(23159953)
      expect(requestSpy).toHaveBeenCalledWith('POST', 'reservation/booking/24415735/quote', {
        apiVersion: 'v1',
        body: {
          is_policy_active: false,
          promotion_code: 'DIRECT10',
          room_types: [{ room_type_id: 751902 }],
        },
      })
    })

    it('accepts the quote id as a numeric string', async () => {
      requestSpy.mockResolvedValue('23159953')
      expect(await client.createBookingQuote('1', {})).toBe(23159953)
    })

    it.each([[{}], [undefined], [null], ['abc'], [0]])(
      'throws when Lodgify returns %p instead of a quote id',
      async (response) => {
        requestSpy.mockResolvedValue(response)
        await expect(client.createBookingQuote(1, {})).rejects.toThrow('did not return a quote id')
      },
    )

    it('rejects a non-numeric booking id before calling Lodgify', async () => {
      await expect(client.createBookingQuote('BK12345', {})).rejects.toThrow('must be numeric')
      expect(requestSpy).not.toHaveBeenCalled()
    })
  })

  describe('attachQuote', () => {
    const quote = {
      id: 23159953,
      status: 'NotScheduled',
      is_policy_active: false,
      rate_policy_name: 'N/A',
      amount_gross: 663.25,
      currency: { code: 'USD' },
      room_type_items: [
        {
          room_type_id: 751902,
          subtotal: 663.25,
          prices: [
            { type: 'RoomRate', amount: 579 },
            { type: 'Tax', amount: 52.11, description: 'BTB Tax' },
          ],
        },
      ],
    }

    it('reports what Lodgify stored, not what was requested', async () => {
      requestSpy
        .mockResolvedValueOnce(23159953) // POST quote
        .mockResolvedValueOnce(quote) // GET quote
        .mockResolvedValueOnce({ status: 'Booked' }) // GET booking

      const result = await client.attachQuote(1, { is_policy_active: false })

      expect(result).toEqual({
        quoteId: 23159953,
        status: 'NotScheduled',
        policy: 'N/A',
        isPolicyActive: false,
        totalAmount: 663.25,
        currency: 'USD',
        lines: quote.room_type_items[0].prices,
        bookingStatus: 'Booked',
      })
    })

    it('fails when the booking reports a different quote than the one created', async () => {
      requestSpy.mockResolvedValueOnce(23159953).mockResolvedValueOnce({ ...quote, id: 1 })

      await expect(client.attachQuote(1, {})).rejects.toThrow('now reports quote 1')
    })
  })

  describe('createBookingV1 status failures', () => {
    const request = {
      property_id: 684855,
      room_type_id: 751902,
      arrival: '2027-06-07',
      departure: '2027-06-11',
      guest_name: 'Test Guest',
      adults: 1,
      status: 'booked' as const,
    }

    it('surfaces the real error text and the actual status when the PUT fails', async () => {
      requestSpy
        .mockResolvedValueOnce(24415735) // POST create
        .mockRejectedValueOnce({ message: 'Cannot transition', code: 666 }) // PUT /book
        .mockResolvedValueOnce({ status: 'Open' }) // GET booking

      const result = await client.createBookingV1(request)

      expect(result.statusUpdateError).toContain('booking is Open')
      expect(result.statusUpdateError).toContain('Cannot transition')
      expect(result.statusUpdateError).not.toContain('[object Object]')
    })

    it('stays quiet when the booking already holds the requested status', async () => {
      requestSpy
        .mockResolvedValueOnce(24415735)
        .mockRejectedValueOnce(new Error('Cannot transition from Booked to Booked'))
        .mockResolvedValueOnce({ status: 'Booked' })

      const result = await client.createBookingV1(request)

      expect(result.statusUpdateError).toBeUndefined()
    })
  })
})
