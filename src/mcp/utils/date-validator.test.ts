/**
 * Unit tests for Date Validation Module
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createValidator,
  DateToolCategory,
  DateValidator,
  ValidationMode,
  type ValidationResult,
  validators,
} from './date-validator'

describe('DateValidator', () => {
  let originalDate: DateConstructor
  const testDate = new Date('2025-08-31T12:00:00Z')

  beforeEach(() => {
    // Mock current date to a known value for consistent testing
    originalDate = globalThis.Date
    globalThis.Date = class extends originalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super('2025-08-31T12:00:00Z')
        } else {
          super(...(args as ConstructorParameters<typeof Date>))
        }
      }
      static now() {
        return testDate.getTime()
      }
    } as DateConstructor
  })

  afterEach(() => {
    // Restore original Date
    globalThis.Date = originalDate
  })

  describe('Basic date format validation', () => {
    test('should accept valid YYYY-MM-DD format', () => {
      const validator = new DateValidator()
      const result = validator.validateDate('2025-09-15')
      expect(result.isValid).toBe(true)
      expect(result.validatedDate).toBe('2025-09-15')
    })

    test('should reject invalid date formats', () => {
      const validator = new DateValidator()
      const invalidDates = ['2025/09/15', '15-09-2025', '2025-9-15', '2025-09-32', 'invalid', '']

      invalidDates.forEach((date) => {
        const result = validator.validateDate(date)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Invalid date format')
      })
    })

    test('should handle leap year dates correctly', () => {
      const validator = new DateValidator()

      // Valid leap year date
      const validResult = validator.validateDate('2024-02-29')
      expect(validResult.isValid).toBe(true)

      // Invalid non-leap year date
      const invalidResult = validator.validateDate('2023-02-29')
      expect(invalidResult.isValid).toBe(false)
    })
  })

  describe('LLM cutoff detection with feedback', () => {
    test('should detect dates from LLM cutoff year (2024) and provide feedback', () => {
      const validator = new DateValidator({
        detectLLMCutoff: true,
        llmCutoffYear: 2024,
      })

      const result = validator.validateDate('2024-09-15')
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('llm_cutoff_suspected')
      expect(result.feedback?.originalInput).toBe('2024-09-15')
      expect(result.feedback?.suggestions).toContain('If you meant this year, use: 2025-09-15')
      expect(result.feedback?.confirmationRequired).toBe(true)
      expect(result.warning).toContain('previous year')
      expect(result.suggestedDate).toBe('2025-09-15')
      expect(result.context?.llmCutoffDetected).toBe(true)
    })

    test('should provide feedback instead of auto-correcting (no AUTO_CORRECT mode)', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT, // AUTO_CORRECT eliminated
        allowPast: false,
        detectLLMCutoff: true,
      })

      const result = validator.validateDate('2024-09-15')
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2024-09-15') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.severity).toBe('warning')
    })

    test('should provide feedback in SOFT mode', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT,
        detectLLMCutoff: true,
      })

      const result = validator.validateDate('2024-09-15')
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2024-09-15') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.warning).toBeDefined()
    })

    test('should provide feedback for multi-year cutoff differences', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT
        allowPast: false,
        detectLLMCutoff: true,
        llmCutoffYear: 2024,
      })

      const result = validator.validateDate('2023-09-15')
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2023-09-15') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.suggestions).toContain('If you meant this year, use: 2025-09-15')
    })
  })

  describe('Past/Future date constraints with feedback', () => {
    test('should reject past dates when allowPast is false in HARD mode', () => {
      const validator = new DateValidator({
        mode: ValidationMode.HARD,
        allowPast: false,
      })

      const result = validator.validateDate('2025-08-01')
      expect(result.isValid).toBe(false)
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
      expect(result.feedback?.severity).toBe('error')
      expect(result.error).toContain('in the past')
    })

    test('should provide feedback for past dates in SOFT mode (no auto-correction)', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT
        allowPast: false,
      })

      const result = validator.validateDate('2025-08-01')
      expect(result.isValid).toBe(true) // SOFT mode allows processing
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2025-08-01') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
      expect(result.feedback?.severity).toBe('warning')
      expect(result.feedback?.confirmationRequired).toBe(true)
    })

    test('should warn about past dates in SOFT mode with feedback', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT,
        allowPast: false,
      })

      const result = validator.validateDate('2025-08-01')
      expect(result.isValid).toBe(true)
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.suggestions).toContain('Did you mean a future date?')
      expect(result.warning).toContain('in the past')
    })

    test('should enforce maxPastDays constraint', () => {
      const validator = new DateValidator({
        mode: ValidationMode.HARD,
        allowPast: true,
        maxPastDays: 30,
      })

      const result = validator.validateDate('2025-07-01')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too far in the past')
    })

    test('should enforce maxFutureDays constraint', () => {
      const validator = new DateValidator({
        mode: ValidationMode.HARD,
        allowFuture: true,
        maxFutureDays: 365,
      })

      const result = validator.validateDate('2027-09-01')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too far in the future')
    })
  })

  describe('Date range validation with feedback', () => {
    test('should validate valid date ranges', () => {
      const validator = new DateValidator()
      const result = validator.validateDateRange('2025-09-01', '2025-09-10')

      expect(result.start.isValid).toBe(true)
      expect(result.end.isValid).toBe(true)
      expect(result.rangeValid).toBe(true)
    })

    test('should provide feedback for invalid date ranges (end before start)', () => {
      const validator = new DateValidator()
      const result = validator.validateDateRange('2025-09-10', '2025-09-01')

      expect(result.rangeValid).toBe(false)
      expect(result.rangeFeedback).toBeDefined()
      expect(result.rangeFeedback?.detectedIssue).toBe('invalid_range')
      expect(result.rangeError).toContain('Invalid date range')
    })

    test('should provide feedback for both dates with LLM cutoff issues (no auto-correction)', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT
        allowPast: false,
        detectLLMCutoff: true,
      })

      const result = validator.validateDateRange('2024-09-01', '2024-09-10')

      expect(result.start.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.start.validatedDate).toBe('2024-09-01') // Original input preserved
      expect(result.start.feedback).toBeDefined()
      expect(result.end.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.end.validatedDate).toBe('2024-09-10') // Original input preserved
      expect(result.end.feedback).toBeDefined()
      expect(result.rangeValid).toBe(true) // Range is valid for original dates
    })

    test('should provide feedback for LLM cutoff dates while preserving original relationship', () => {
      const validator = new DateValidator({
        mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT
        allowPast: false,
        detectLLMCutoff: true,
        llmCutoffYear: 2024,
      })

      // Test the specific case from the bug report: 2024-02-15 to 2024-02-22
      const result = validator.validateDateRange('2024-02-15', '2024-02-22')

      // No auto-correction - original inputs preserved
      expect(result.start.wasAutoCorrected).toBe(false)
      expect(result.start.validatedDate).toBe('2024-02-15')
      expect(result.start.feedback).toBeDefined()
      expect(result.start.feedback?.detectedIssue).toBe('llm_cutoff_suspected')
      expect(result.start.context?.llmCutoffDetected).toBe(true)

      expect(result.end.wasAutoCorrected).toBe(false)
      expect(result.end.validatedDate).toBe('2024-02-22')
      expect(result.end.feedback).toBeDefined()
      expect(result.end.feedback?.detectedIssue).toBe('llm_cutoff_suspected')
      expect(result.end.context?.llmCutoffDetected).toBe(true)

      // Range validation passes for original dates
      expect(result.rangeValid).toBe(true)
      expect(result.rangeError).toBeUndefined()

      // Verify the original dates maintain their 7-day relationship
      const startDate = new Date(`${result.start.validatedDate}T12:00:00Z`)
      const endDate = new Date(`${result.end.validatedDate}T12:00:00Z`)
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
      expect(daysDiff).toBe(7)
    })
  })

  describe('Tool category configurations with feedback', () => {
    test('AVAILABILITY category should provide feedback for past dates (no auto-correction)', () => {
      const validator = createValidator(DateToolCategory.AVAILABILITY)
      const result = validator.validateDate('2025-08-01')

      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2025-08-01') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
      expect(result.feedback?.severity).toBe('warning')
    })

    test('BOOKING category should warn but allow processing with feedback', () => {
      const validator = createValidator(DateToolCategory.BOOKING)
      const result = validator.validateDate('2024-09-15')

      expect(result.isValid).toBe(true)
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('llm_cutoff_suspected')
      expect(result.warning).toBeDefined()
      expect(result.wasAutoCorrected).toBe(false)
    })

    test('RATE category should allow both past and future dates', () => {
      const validator = createValidator(DateToolCategory.RATE)

      const pastResult = validator.validateDate('2025-07-01')
      expect(pastResult.isValid).toBe(true)

      const futureResult = validator.validateDate('2026-01-01')
      expect(futureResult.isValid).toBe(true)
    })

    test('QUOTE category should provide feedback for past dates (no auto-correction)', () => {
      const validator = createValidator(DateToolCategory.QUOTE)
      const result = validator.validateDate('2025-08-01')

      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.validatedDate).toBe('2025-08-01') // Original input preserved
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
      expect(result.feedback?.severity).toBe('warning')
    })

    test('HISTORICAL category should allow all dates without LLM detection', () => {
      const validator = createValidator(DateToolCategory.HISTORICAL)
      const result = validator.validateDate('2020-01-01')

      expect(result.isValid).toBe(true)
      expect(result.warning).toBeUndefined()
      expect(result.context?.llmCutoffDetected).toBeUndefined()
    })
  })

  describe('Convenience validators with feedback', () => {
    test('should create availability validator with feedback', () => {
      const validator = validators.availability()
      const result = validator.validateDate('2025-08-01')
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
    })

    test('should create booking validator with feedback', () => {
      const validator = validators.booking()
      const result = validator.validateDate('2024-09-15')
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('llm_cutoff_suspected')
      expect(result.warning).toBeDefined()
    })

    test('should create rate validator', () => {
      const validator = validators.rate()
      const result = validator.validateDate('2025-07-01')
      expect(result.isValid).toBe(true)
    })

    test('should create quote validator with feedback', () => {
      const validator = validators.quote()
      const result = validator.validateDate('2025-08-01')
      expect(result.wasAutoCorrected).toBe(false) // Never auto-correct
      expect(result.feedback).toBeDefined()
      expect(result.feedback?.detectedIssue).toBe('date_in_past')
    })

    test('should create historical validator', () => {
      const validator = validators.historical()
      const result = validator.validateDate('2020-01-01')
      expect(result.isValid).toBe(true)
    })
  })

  describe('User message formatting', () => {
    test('should format error messages', () => {
      const result: ValidationResult = {
        isValid: false,
        originalDate: '2025-08-01',
        validatedDate: '2025-08-01',
        wasAutoCorrected: false,
        error: 'Date is in the past',
      }

      const message = DateValidator.formatUserMessage(result)
      expect(message).toContain('❌')
      expect(message).toContain('Date is in the past')
    })

    test('should format auto-correction messages', () => {
      const result: ValidationResult = {
        isValid: true,
        originalDate: '2024-09-15',
        validatedDate: '2025-09-15',
        wasAutoCorrected: true,
      }

      const message = DateValidator.formatUserMessage(result)
      expect(message).toContain('✅')
      expect(message).toContain('auto-corrected')
    })

    test('should format warning messages', () => {
      const result: ValidationResult = {
        isValid: true,
        originalDate: '2024-09-15',
        validatedDate: '2024-09-15',
        wasAutoCorrected: false,
        warning: 'Date may be outdated',
      }

      const message = DateValidator.formatUserMessage(result)
      expect(message).toContain('⚠️')
      expect(message).toContain('Date may be outdated')
    })

    test('should format suggestion messages', () => {
      const result: ValidationResult = {
        isValid: true,
        originalDate: '2024-09-15',
        validatedDate: '2024-09-15',
        wasAutoCorrected: false,
        suggestedDate: '2025-09-15',
      }

      const message = DateValidator.formatUserMessage(result)
      expect(message).toContain('💡')
      expect(message).toContain('2025-09-15')
    })
  })

  describe('Edge cases', () => {
    test('should handle same-day date ranges', () => {
      const validator = new DateValidator()
      const result = validator.validateDateRange('2025-09-15', '2025-09-15')

      // Same day should be valid for a range (e.g., single-day rate queries)
      expect(result.rangeValid).toBe(true)
      expect(result.start.isValid).toBe(true)
      expect(result.end.isValid).toBe(true)
      expect(result.rangeError).toBeUndefined()
      expect(result.rangeFeedback).toBeUndefined()
    })

    test('should handle year boundaries', () => {
      const validator = new DateValidator({
        referenceDate: new Date('2025-12-31T12:00:00Z'),
      })

      const result = validator.validateDate('2026-01-01')
      expect(result.isValid).toBe(true)
    })

    test('should handle month boundaries', () => {
      const validator = new DateValidator({
        referenceDate: new Date('2025-08-31T12:00:00Z'),
      })

      const result = validator.validateDate('2025-09-01')
      expect(result.isValid).toBe(true)
    })

    test('should handle configuration overrides', () => {
      const validator = createValidator(DateToolCategory.AVAILABILITY, {
        mode: ValidationMode.HARD,
        maxFutureDays: 30,
      })

      const result = validator.validateDate('2025-10-15')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too far in the future')
    })
  })
})
