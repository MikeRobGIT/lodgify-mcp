import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  addDays,
  compareDates,
  daysBetween,
  getTodayISO,
  isDateInRange,
  isValidDateISO,
} from '../src/api/v2/availability/client.js'
import { LodgifyOrchestrator } from '../src/lodgify-orchestrator.js'
import { createMockResponse } from './utils.js'

describe('Date Utility Functions', () => {
  test('getTodayISO returns today in YYYY-MM-DD format', () => {
    const today = getTodayISO()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(today).toDateString()).toBe(new Date().toDateString())
  })

  test('addDays correctly adds days to a date', () => {
    expect(addDays('2025-08-14', 1)).toBe('2025-08-15')
    expect(addDays('2025-08-14', 7)).toBe('2025-08-21')
    expect(addDays('2025-08-31', 1)).toBe('2025-09-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })

  test('isValidDateISO validates date strings correctly', () => {
    expect(isValidDateISO('2025-08-14')).toBe(true)
    expect(isValidDateISO('2025-12-31')).toBe(true)
    expect(isValidDateISO('2025-02-29')).toBe(false) // Not a leap year
    expect(isValidDateISO('2024-02-29')).toBe(true) // Leap year
    expect(isValidDateISO('2025-13-01')).toBe(false) // Invalid month
    expect(isValidDateISO('2025-08-32')).toBe(false) // Invalid day
    expect(isValidDateISO('25-08-14')).toBe(false) // Wrong format
    expect(isValidDateISO('2025/08/14')).toBe(false) // Wrong format
    expect(isValidDateISO('')).toBe(false)
    expect(isValidDateISO('invalid')).toBe(false)
  })

  test('compareDates correctly compares date strings', () => {
    expect(compareDates('2025-08-14', '2025-08-15')).toBe(-1)
    expect(compareDates('2025-08-15', '2025-08-14')).toBe(1)
    expect(compareDates('2025-08-14', '2025-08-14')).toBe(0)
    expect(compareDates('2025-08-14', '2025-09-14')).toBe(-1)
    expect(compareDates('2025-09-14', '2025-08-14')).toBe(1)
  })

  test('isDateInRange correctly checks if date is in range', () => {
    // Test dates within the range
    expect(isDateInRange('2025-08-15', '2025-08-14', '2025-08-16')).toBe(true)

    // Test boundary conditions: start is inclusive, end is exclusive
    // This behavior follows standard interval notation [start, end)
    expect(isDateInRange('2025-08-14', '2025-08-14', '2025-08-16')).toBe(true) // Start boundary (inclusive)
    expect(isDateInRange('2025-08-16', '2025-08-14', '2025-08-16')).toBe(false) // End boundary (exclusive)

    // Test dates outside the range
    expect(isDateInRange('2025-08-13', '2025-08-14', '2025-08-16')).toBe(false)
    expect(isDateInRange('2025-08-17', '2025-08-14', '2025-08-16')).toBe(false)
  })

  test('daysBetween correctly calculates days between dates', () => {
    expect(daysBetween('2025-08-14', '2025-08-15')).toBe(1)
    expect(daysBetween('2025-08-14', '2025-08-21')).toBe(7)
    expect(daysBetween('2025-08-14', '2025-08-14')).toBe(0)
    expect(daysBetween('2025-08-31', '2025-09-01')).toBe(1)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
})

describe('LodgifyOrchestrator Availability Helper Methods', () => {
  let client: LodgifyOrchestrator
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    client = new LodgifyOrchestrator({ apiKey: 'test-api-key' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('getNextAvailableDate', () => {
    test('should find next available date when property has bookings', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123', // Use snake_case to match API format
            arrival: '2025-08-14',
            departure: '2025-08-16',
            status: 'Booked',
          },
          {
            id: 2,
            property_id: '123', // Use snake_case to match API format
            arrival: '2025-08-20',
            departure: '2025-08-22',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getNextAvailableDate('123', '2025-08-14', 30)

      expect(result.nextAvailableDate).toBe('2025-08-16')
      expect(result.blockedPeriods).toHaveLength(2)
      expect(result.message).toContain('Available')
    })

    test('should return null when no availability found', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123',
            arrival: '2025-08-14',
            departure: '2025-09-14', // Covers entire check period
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getNextAvailableDate('123', '2025-08-14', 30)

      expect(result.nextAvailableDate).toBeNull()
      expect(result.message).toContain('No availability found')
    })

    test('should filter out cancelled bookings', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123',
            arrival: '2025-08-14',
            departure: '2025-08-16',
            status: 'Declined', // Should be ignored
          },
          {
            id: 2,
            property_id: '123',
            arrival: '2025-08-20',
            departure: '2025-08-22',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getNextAvailableDate('123', '2025-08-14', 30)

      expect(result.nextAvailableDate).toBe('2025-08-14') // Available immediately
      expect(result.blockedPeriods).toHaveLength(1) // Only the non-cancelled booking
    })

    test('should use default values when not provided', async () => {
      const mockBookingsResponse = { data: [] }
      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getNextAvailableDate('123')

      expect(result.nextAvailableDate).toBe(getTodayISO())
      expect(result.totalDaysAvailable).toBeGreaterThan(80) // Should be close to 90 days default
    })

    test('should detect when property does not exist', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '456', // Different property ID
            arrival: '2025-08-14',
            departure: '2025-08-16',
            status: 'Booked',
          },
          {
            id: 2,
            property_id: '789', // Another different property ID
            arrival: '2025-08-20',
            departure: '2025-08-22',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getNextAvailableDate('123', '2025-08-14', 30)

      expect(result.nextAvailableDate).toBeNull()
      expect(result.message).toContain('No booking data found for property ID 123')
      expect(result.message).toContain('Property may not exist')
    })
  })

  describe('checkDateRangeAvailability', () => {
    test('should return available when no conflicting bookings', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123',
            arrival: '2025-08-10',
            departure: '2025-08-12',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.checkDateRangeAvailability(
        '123',
        '2025-08-15',
        '2025-08-18',
      )

      expect(result.isAvailable).toBe(true)
      expect(result.conflictingBookings).toHaveLength(0)
      expect(result.message).toContain('Available for 3 nights')
    })

    test('should return unavailable when there are conflicting bookings', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123',
            arrival: '2025-08-16',
            departure: '2025-08-18',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.checkDateRangeAvailability(
        '123',
        '2025-08-15',
        '2025-08-17',
      )

      expect(result.isAvailable).toBe(false)
      expect(result.conflictingBookings).toHaveLength(1)
      expect(result.message).toContain('Not available')
    })

    test('should validate date format', async () => {
      await expect(
        client.availability.checkDateRangeAvailability('123', 'invalid-date', '2025-08-18'),
      ).rejects.toThrow('Invalid date format')

      await expect(
        client.availability.checkDateRangeAvailability('123', '2025-08-15', 'invalid-date'),
      ).rejects.toThrow('Invalid date format')
    })

    test('should validate check-in before check-out', async () => {
      await expect(
        client.availability.checkDateRangeAvailability('123', '2025-08-18', '2025-08-15'),
      ).rejects.toThrow('Check-in date must be before check-out date')

      await expect(
        client.availability.checkDateRangeAvailability('123', '2025-08-15', '2025-08-15'),
      ).rejects.toThrow('Check-in date must be before check-out date')
    })
  })

  describe('getAvailabilityCalendar', () => {
    test('should generate calendar with availability status', async () => {
      const mockBookingsResponse = {
        items: [
          {
            id: 1,
            property_id: '123',
            arrival: '2025-08-16',
            departure: '2025-08-18',
            status: 'Booked',
          },
        ],
      }

      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getAvailabilityCalendar('123', '2025-08-15', 7)

      expect(result.calendar).toHaveLength(7)
      expect(result.calendar[0].date).toBe('2025-08-15')
      expect(result.calendar[0].isAvailable).toBe(true)
      expect(result.calendar[1].date).toBe('2025-08-16')
      expect(result.calendar[1].isAvailable).toBe(false)
      expect(result.calendar[1].bookingStatus).toBe('Booked')

      expect(result.summary.totalDays).toBe(7)
      expect(result.summary.availableDays).toBe(5) // 7 total - 2 blocked days (exclusive end date)
      expect(result.summary.blockedDays).toBe(2)
      expect(result.summary.availabilityRate).toBe(71) // Math.round(5/7 * 100)
    })

    test('should mark today correctly', async () => {
      const mockBookingsResponse = { data: [] }
      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const today = getTodayISO()
      const result = await client.availability.getAvailabilityCalendar('123', today, 3)

      expect(result.calendar[0].isToday).toBe(true)
      expect(result.calendar[1].isToday).toBe(false)
      expect(result.calendar[2].isToday).toBe(false)
    })

    test('should use default values when not provided', async () => {
      const mockBookingsResponse = { data: [] }
      global.fetch = mock(async () => createMockResponse(200, mockBookingsResponse))

      const result = await client.availability.getAvailabilityCalendar('123')

      expect(result.calendar).toHaveLength(30) // Default days to show
      expect(result.calendar[0].date).toBe(getTodayISO()) // Default start date
      expect(result.summary.totalDays).toBe(30)
    })
  })

  describe('error handling', () => {
    test('should handle API errors gracefully', async () => {
      // Simulate a network error to test error handling without relying on status codes
      global.fetch = mock(async () => {
        throw new Error('Network error')
      })

      await expect(client.availability.getNextAvailableDate('123')).rejects.toThrow()

      await expect(
        client.availability.checkDateRangeAvailability('123', '2025-08-15', '2025-08-18'),
      ).rejects.toThrow()

      await expect(client.availability.getAvailabilityCalendar('123')).rejects.toThrow()
    })

    test('should handle empty booking responses', async () => {
      global.fetch = mock(async () => createMockResponse(200, {}))

      const result = await client.getNextAvailableDate('123', '2025-08-14', 7)
      expect(result.nextAvailableDate).toBe('2025-08-14')
      expect(result.blockedPeriods).toHaveLength(0)
    })
  })
})
