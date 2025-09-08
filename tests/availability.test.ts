import { describe, expect, test } from 'bun:test'

// Date utility functions that were removed from the client
// These are now local test utilities
function getTodayISO(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function isValidDateISO(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }

  // Parse the date components
  const [year, month, day] = dateStr.split('-').map(Number)

  // Create a date object and check if it represents the same date
  const date = new Date(Date.UTC(year, month - 1, day))

  // Check if date is valid and components match
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function compareDates(date1: string, date2: string): number {
  const d1 = new Date(date1).getTime()
  const d2 = new Date(date2).getTime()
  if (d1 < d2) return -1
  if (d1 > d2) return 1
  return 0
}

function isDateInRange(date: string, start: string, end: string): boolean {
  // Inclusive of both start and end
  return compareDates(date, start) >= 0 && compareDates(date, end) <= 0
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1).getTime()
  const d2 = new Date(date2).getTime()
  return Math.abs(Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)))
}

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

    // Test dates outside the range
    expect(isDateInRange('2025-08-13', '2025-08-14', '2025-08-16')).toBe(false)
    expect(isDateInRange('2025-08-17', '2025-08-14', '2025-08-16')).toBe(false)

    // Test boundary conditions: both start and end are inclusive
    expect(isDateInRange('2025-08-14', '2025-08-14', '2025-08-16')).toBe(true) // Start boundary (inclusive)
    expect(isDateInRange('2025-08-16', '2025-08-14', '2025-08-16')).toBe(true) // End boundary (inclusive)

    // Test invalid range (start > end)
    expect(isDateInRange('2025-08-15', '2025-08-16', '2025-08-14')).toBe(false)
  })

  test('daysBetween correctly calculates days between dates', () => {
    expect(daysBetween('2025-08-14', '2025-08-15')).toBe(1)
    expect(daysBetween('2025-08-14', '2025-08-21')).toBe(7)
    expect(daysBetween('2025-08-14', '2025-09-14')).toBe(31)
    expect(daysBetween('2025-08-15', '2025-08-14')).toBe(1) // Order doesn't matter
    expect(daysBetween('2025-08-14', '2025-08-14')).toBe(0) // Same date
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
})

// Tests for availability helper methods removed - these methods were deleted
// The remaining tool (lodgify_get_property_availability) is tested in server.test.ts
