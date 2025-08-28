/**
 * Rate API Response Schemas
 * Zod schemas for validating and typing rate API responses
 */

import { z } from 'zod'

/**
 * Daily rate entry schema
 */
export const DailyRateEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  rate: z.number().min(0, 'Rate must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').optional(),
  min_stay: z.number().int().min(1).optional(),
  max_stay: z.number().int().min(1).optional(),
  available: z.boolean().optional(),
  room_type_id: z.number().int().positive().optional(),
  property_id: z.number().int().positive().optional(),
})

/**
 * Daily rates calendar response schema
 */
export const DailyRatesResponseSchema = z.object({
  property_id: z.number().int().positive(),
  room_type_id: z.number().int().positive().optional(),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  rates: z.array(DailyRateEntrySchema),
  total_entries: z.number().int().min(0).optional(),
  date_range: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
})

/**
 * Rate settings response schema
 */
export const RateSettingsResponseSchema = z.object({
  property_id: z.number().int().positive(),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  default_rate: z.number().min(0).optional(),
  minimum_stay: z.number().int().min(1).optional(),
  maximum_stay: z.number().int().min(1).optional(),
  check_in_days: z.array(z.number().int().min(0).max(6)).optional(), // 0-6 for Sunday-Saturday
  check_out_days: z.array(z.number().int().min(0).max(6)).optional(),
  rate_type: z.enum(['per_night', 'per_week', 'per_month']).optional(),
  pricing_model: z.enum(['base_rate', 'dynamic', 'seasonal']).optional(),
  tax_settings: z
    .object({
      tax_rate: z.number().min(0).max(1), // Percentage as decimal (e.g., 0.1 for 10%)
      tax_inclusive: z.boolean(),
      tax_name: z.string().optional(),
    })
    .optional(),
  seasonal_rates: z
    .array(
      z.object({
        name: z.string(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        rate_multiplier: z.number().min(0),
      }),
    )
    .optional(),
  last_updated: z.string().datetime().optional(),
})

/**
 * Create/Update rate response schema
 */
export const RateOperationResponseSchema = z.object({
  rate_id: z.string().or(z.number()),
  property_id: z.number().int().positive(),
  room_type_id: z.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.number().min(0),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  success: z.boolean().default(true),
  message: z.string().optional(),
})

/**
 * Common rate response wrapper
 */
export const RateResponseWrapperSchema = z.object({
  data: z.unknown(), // Will be replaced with specific schemas
  success: z.boolean().default(true),
  message: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  errors: z.array(z.string()).optional(),
})

// Export inferred types
export type DailyRateEntry = z.infer<typeof DailyRateEntrySchema>
export type DailyRatesResponse = z.infer<typeof DailyRatesResponseSchema>
export type RateSettingsResponse = z.infer<typeof RateSettingsResponseSchema>
export type RateOperationResponse = z.infer<typeof RateOperationResponseSchema>
export type RateResponseWrapper<T = unknown> = z.infer<typeof RateResponseWrapperSchema> & {
  data: T
}

/**
 * Validation helpers
 */
export const validateDailyRatesResponse = (data: unknown): DailyRatesResponse => {
  return DailyRatesResponseSchema.parse(data)
}

export const validateRateSettingsResponse = (data: unknown): RateSettingsResponse => {
  return RateSettingsResponseSchema.parse(data)
}

export const validateRateOperationResponse = (data: unknown): RateOperationResponse => {
  return RateOperationResponseSchema.parse(data)
}

/**
 * Safe validation helpers that return results with error information
 */
export const safeParseDailyRates = (data: unknown) => {
  return DailyRatesResponseSchema.safeParse(data)
}

export const safeParseRateSettings = (data: unknown) => {
  return RateSettingsResponseSchema.safeParse(data)
}

export const safeParseRateOperation = (data: unknown) => {
  return RateOperationResponseSchema.safeParse(data)
}
