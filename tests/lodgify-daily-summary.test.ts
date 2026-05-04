import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type {
  Booking,
  BookingSearchParams,
  BookingsListResponse,
} from '../src/api/v2/bookings/types.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'

function buildBooking(id: string, checkIn: string, checkOut: string): Booking {
  return {
    id,
    propertyId: 'P1',
    propertyName: 'Test Property',
    status: 'confirmed',
    checkIn,
    checkOut,
    guest: {
      name: `Guest ${id}`,
    },
    guestBreakdown: {
      adults: 2,
    },
  }
}

describe('LodgifyOrchestrator.getDailyBookingSummary', () => {
  let orchestrator: LodgifyOrchestrator

  beforeEach(() => {
    orchestrator = new LodgifyOrchestrator({ apiKey: 'test-api-key' })
  })

  test('should generate daily summary with check-ins, check-outs, occupancy, and tomorrow arrivals', async () => {
    const arrivalToday = [
      buildBooking('B1', '2026-02-16', '2026-02-17'),
      buildBooking('B4', '2026-02-16', '2026-02-16'),
    ]
    const departureToday = [
      buildBooking('B2', '2026-02-14', '2026-02-16'),
      buildBooking('B4', '2026-02-16', '2026-02-16'),
    ]
    const current = [
      buildBooking('B2', '2026-02-14', '2026-02-16'),
      buildBooking('B3', '2026-02-15', '2026-02-17'),
    ]
    const arrivalTomorrow = [buildBooking('B5', '2026-02-17', '2026-02-20')]

    const detailsById: Record<string, Booking> = {
      B1: { ...arrivalToday[0], notes: 'Late arrival' },
      B2: { ...departureToday[0], notes: 'Checkout by 11am' },
      B3: { ...current[1], notes: 'In-house guest' },
      B4: { ...arrivalToday[1], notes: 'Same-day use' },
      B5: { ...arrivalTomorrow[0], notes: 'Prepare welcome package' },
    }

    const listBookingsMock = mock(
      async (params?: BookingSearchParams): Promise<BookingsListResponse> => {
        const stayFilter = params?.stayFilter
        const stayFilterDate = params?.stayFilterDate

        let data: Booking[] = []
        if (stayFilter === 'ArrivalDate' && stayFilterDate === '2026-02-16T00:00:00Z') {
          data = arrivalToday
        } else if (stayFilter === 'DepartureDate' && stayFilterDate === '2026-02-16T00:00:00Z') {
          data = departureToday
        } else if (stayFilter === 'Current') {
          data = current
        } else if (stayFilter === 'ArrivalDate' && stayFilterDate === '2026-02-17T00:00:00Z') {
          data = arrivalTomorrow
        }

        return {
          data,
          count: data.length,
          pagination: {
            limit: 50,
            offset: params?.offset || 0,
            total: data.length,
          },
        }
      },
    )

    const getBookingMock = mock(async (id: string): Promise<Booking> => detailsById[id])

    orchestrator.bookings.listBookings =
      listBookingsMock as unknown as typeof orchestrator.bookings.listBookings
    orchestrator.bookings.getBooking =
      getBookingMock as unknown as typeof orchestrator.bookings.getBooking

    const summary = await orchestrator.getDailyBookingSummary({ date: '2026-02-16' })

    expect(summary.referenceDate).toBe('2026-02-16')
    expect(summary.tomorrowDate).toBe('2026-02-17')
    expect(summary.counts.checkInsToday).toBe(2)
    expect(summary.counts.checkOutsToday).toBe(2)
    expect(summary.counts.occupancyTonight).toBe(2)
    expect(summary.counts.arrivalsTomorrow).toBe(1)
    expect(summary.counts.uniqueBookingsCovered).toBe(5)

    expect(summary.occupancyTonight.map((booking) => booking.id)).toEqual(['B3', 'B1'])
    expect(summary.checkInsToday[0].notes).toBeDefined()
    expect(summary.checkOutsToday[0].notes).toBeDefined()
    expect(summary.arrivalsTomorrow[0].notes).toBeDefined()

    expect(getBookingMock).toHaveBeenCalledTimes(5)
    expect(listBookingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stayFilter: 'ArrivalDate',
        stayFilterDate: '2026-02-16T00:00:00Z',
        includeExternal: true,
      }),
    )
    expect(listBookingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stayFilter: 'DepartureDate',
        stayFilterDate: '2026-02-16T00:00:00Z',
        includeExternal: true,
      }),
    )
    expect(listBookingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stayFilter: 'Current',
        includeExternal: true,
      }),
    )
  })

  test('should skip booking detail lookups when includeFullDetails is false', async () => {
    const listBookingsMock = mock(
      async (_params?: BookingSearchParams): Promise<BookingsListResponse> => ({
        data: [buildBooking('B100', '2026-02-16', '2026-02-18')],
        count: 1,
        pagination: {
          limit: 50,
          offset: 0,
          total: 1,
        },
      }),
    )

    const getBookingMock = mock(
      async (id: string): Promise<Booking> => buildBooking(id, '2026-02-16', '2026-02-18'),
    )

    orchestrator.bookings.listBookings =
      listBookingsMock as unknown as typeof orchestrator.bookings.listBookings
    orchestrator.bookings.getBooking =
      getBookingMock as unknown as typeof orchestrator.bookings.getBooking

    const summary = await orchestrator.getDailyBookingSummary({
      date: '2026-02-16',
      includeFullDetails: false,
    })

    expect(summary.counts.checkInsToday).toBeGreaterThan(0)
    expect(getBookingMock).toHaveBeenCalledTimes(0)
  })

  test('should reject invalid date format', async () => {
    await expect(
      orchestrator.getDailyBookingSummary({
        date: '02-16-2026',
      }),
    ).rejects.toThrow('Invalid date format')
  })
})
