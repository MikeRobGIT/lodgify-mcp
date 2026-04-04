import { ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it, vi } from 'vitest'
import type { DailyBookingSummaryResult, LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { getBookingTools } from '../src/mcp/tools/booking-tools.js'

describe('lodgify_daily_booking_summary tool', () => {
  const mockGetDailyBookingSummary = vi.fn()
  const getClient = () =>
    ({
      getDailyBookingSummary: mockGetDailyBookingSummary,
    }) as unknown as LodgifyOrchestrator

  const tools = getBookingTools(getClient)
  const summaryTool = tools.find((tool) => tool.name === 'lodgify_daily_booking_summary')

  if (!summaryTool) {
    throw new Error('lodgify_daily_booking_summary tool not found')
  }

  const { handler } = summaryTool

  it('should call orchestrator and return formatted daily summary response', async () => {
    const summary: DailyBookingSummaryResult = {
      referenceDate: '2026-02-16',
      tomorrowDate: '2026-02-17',
      timezone: 'UTC',
      generatedAt: '2026-02-16T12:00:00.000Z',
      counts: {
        checkInsToday: 2,
        checkOutsToday: 1,
        occupancyTonight: 3,
        arrivalsTomorrow: 4,
        uniqueBookingsCovered: 6,
      },
      checkInsToday: [],
      checkOutsToday: [],
      occupancyTonight: [],
      arrivalsTomorrow: [],
    }

    mockGetDailyBookingSummary.mockResolvedValue(summary)

    const result = await handler({
      date: '2026-02-16',
      includeExternal: true,
      includeFullDetails: true,
    })

    expect(mockGetDailyBookingSummary).toHaveBeenCalledWith({
      date: '2026-02-16',
      includeExternal: true,
      includeFullDetails: true,
    })

    expect(result.content).toHaveLength(1)
    const response = JSON.parse(result.content[0].text)
    expect(response.operation).toMatchObject({
      type: 'read',
      entity: 'booking',
      status: 'success',
    })
    expect(response.data.referenceDate).toBe('2026-02-16')
    expect(response.data.counts.occupancyTonight).toBe(3)
    expect(response.summary).toContain('Daily booking summary for 2026-02-16')
  })

  it('should reject invalid date format', async () => {
    await expect(
      handler({
        date: '02-16-2026',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidParams,
      message: expect.stringContaining('Expected YYYY-MM-DD'),
    })
  })
})
