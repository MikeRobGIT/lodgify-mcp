/**
 * Date formatting utilities for Response Enhancer
 */

import { getString } from '../helpers.js'

/**
 * Format date for display
 */
export function formatDate(
  date: string | undefined | unknown,
  includeTime = false,
  locale = 'en-US',
): string {
  const dateStr = getString(date)
  if (!dateStr) return 'N/A'

  try {
    const dateObj = new Date(dateStr)
    if (Number.isNaN(dateObj.getTime())) return dateStr // Return original if invalid

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    if (includeTime) {
      options.hour = '2-digit'
      options.minute = '2-digit'
    }

    return dateObj.toLocaleString(locale, options)
  } catch {
    return dateStr // Return original on error
  }
}

/**
 * Calculate nights between dates
 * Handles timezone edge cases by normalizing to UTC midnight
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  try {
    // Parse dates and normalize to UTC midnight to avoid timezone issues
    const start = new Date(checkIn)
    const end = new Date(checkOut)

    // Check for invalid dates
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0
    }

    // Normalize to UTC midnight to handle cross-timezone calculations
    // This ensures consistent behavior regardless of local timezone
    const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())

    const diffTime = endUTC - startUTC
    const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
    const diffDays = Math.floor(diffTime / MILLISECONDS_PER_DAY)

    // Ensure non-negative result
    return Math.max(0, diffDays)
  } catch {
    return 0
  }
}
