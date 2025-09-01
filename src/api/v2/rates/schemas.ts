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
 * The API returns an array of rate entries directly, not wrapped in an object
 */
export const DailyRatesResponseSchema = z.union([
  // Handle array response (actual API format)
  z.array(
    z
      .object({
        date: z.string().optional(),
        Date: z.string().optional(), // API might use PascalCase
        rate: z.number().optional(),
        Rate: z.number().optional(), // API might use PascalCase
        price: z.number().optional(),
        Price: z.number().optional(), // API might use PascalCase
        currency: z.string().optional(),
        Currency: z.string().optional(), // API might use PascalCase
        MinStay: z.number().optional(),
        minStay: z.number().optional(),
        min_stay: z.number().optional(),
        available: z.boolean().optional(),
        Available: z.boolean().optional(),
      })
      .passthrough(), // Allow additional fields
  ),
  // Fallback to handle object formats
  z
    .object({
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
    .passthrough(),
])

/**
 * Rate settings response schema
 * Made flexible to handle various response formats from the API
 */
export const RateSettingsResponseSchema = z
  .object({
    property_id: z.number().int().positive().optional(),
    propertyId: z.number().int().positive().optional(),
    houseId: z.number().int().positive().optional(),
    currency: z.string().optional(),
    default_rate: z.number().min(0).optional(),
    defaultRate: z.number().min(0).optional(),
    minimum_stay: z.number().int().min(1).optional(),
    minimumStay: z.number().int().min(1).optional(),
    maximum_stay: z.number().int().min(1).optional(),
    maximumStay: z.number().int().min(1).optional(),
    check_in_days: z.array(z.number().int().min(0).max(6)).optional(),
    checkInDays: z.array(z.number().int().min(0).max(6)).optional(),
    check_out_days: z.array(z.number().int().min(0).max(6)).optional(),
    checkOutDays: z.array(z.number().int().min(0).max(6)).optional(),
    rate_type: z.enum(['per_night', 'per_week', 'per_month']).optional(),
    rateType: z.enum(['per_night', 'per_week', 'per_month']).optional(),
    pricing_model: z.enum(['base_rate', 'dynamic', 'seasonal']).optional(),
    pricingModel: z.enum(['base_rate', 'dynamic', 'seasonal']).optional(),
    tax_settings: z
      .object({
        tax_rate: z.number().min(0).max(1).optional(),
        tax_inclusive: z.boolean().optional(),
        tax_name: z.string().optional(),
      })
      .optional(),
    taxSettings: z
      .object({
        taxRate: z.number().min(0).max(1).optional(),
        taxInclusive: z.boolean().optional(),
        taxName: z.string().optional(),
      })
      .optional(),
    seasonal_rates: z
      .array(
        z.object({
          name: z.string().optional(),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
          rate_multiplier: z.number().min(0).optional(),
        }),
      )
      .optional(),
    seasonalRates: z
      .array(
        z.object({
          name: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          rateMultiplier: z.number().min(0).optional(),
        }),
      )
      .optional(),
    last_updated: z.string().optional(),
    lastUpdated: z.string().optional(),
  })
  .passthrough() // Allow additional fields

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
