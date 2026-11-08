/**
 * Common Zod schemas used across MCP tools
 */

import { z } from 'zod'
import { isYYYYMMDD } from '../utils/date/format.js'

/**
 * Optional Lodgify website ID. Must be a positive integer: Lodgify's API fails with an opaque
 * .NET NullReferenceException (code 666) for 0 or negative values, so reject them up front.
 * Models often fill unknown optional numbers with 0; the message tells them to omit it instead.
 */
export const WebsiteIdSchema = z
  .number()
  .int()
  .positive('wid must be a positive integer; omit it if you do not know the website ID')
  .optional()

/**
 * Date format validation for YYYY-MM-DD format
 */
export const DateStringSchema = z.string().refine(isYYYYMMDD, 'Date must be in YYYY-MM-DD format')

/**
 * DateTime format validation for ISO 8601
 */
export const DateTimeSchema = z.string().datetime({
  message: 'DateTime must be in ISO 8601 format (e.g., 2024-03-15T10:00:00Z)',
})

/**
 * Stay filter enum for booking queries
 */
export const StayFilterEnum = z.enum([
  'Upcoming',
  'Current',
  'Historic',
  'All',
  'ArrivalDate',
  'DepartureDate',
])

/**
 * Trash filter enum for booking queries
 */
export const TrashFilterEnum = z.enum(['False', 'True', 'All'])

/**
 * Webhook event types enum
 */
export const WebhookEventEnum = z.enum([
  'rate_change',
  'availability_change',
  'booking_new_any_status',
  'booking_new_status_booked',
  'booking_change',
  'booking_status_change_booked',
  'booking_status_change_tentative',
  'booking_status_change_open',
  'booking_status_change_declined',
  'guest_message_received',
])

/**
 * Booking status enum
 */
export const BookingStatusEnum = z.enum(['booked', 'tentative', 'declined', 'confirmed'])
