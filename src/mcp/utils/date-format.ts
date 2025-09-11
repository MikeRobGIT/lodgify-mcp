/**
 * Date format helpers
 * Shared validators for common date string formats used by MCP tools
 */

/**
 * Validate ISO 8601 date-time strings like 2024-03-01T00:00:00Z or with milliseconds
 */
export function isISODateTime(value: string): boolean {
  if (typeof value !== 'string') return false
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
  if (!isoRegex.test(value)) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime())
}

/**
 * Validate YYYY-MM-DD date strings
 */
export function isYYYYMMDD(value: string): boolean {
  if (typeof value !== 'string') return false
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(value)) return false
  const d = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const [y, m, day] = value.split('-').map(Number)
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day
}
