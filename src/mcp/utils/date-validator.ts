/**
 * Date Validation Module
 *
 * Centralized date validation and correction system for Lodgify MCP
 * Handles LLM date cutoff issues and provides intelligent corrections
 */

/**
 * Validation modes for different handling strategies
 */
export enum ValidationMode {
  /** Reject invalid dates with error */
  HARD = 'hard',
  /** Warn about issues but allow processing */
  SOFT = 'soft',
  /** Auto-correct when safe to do so */
  AUTO_CORRECT = 'auto_correct',
}

/**
 * Date validation tool categories with different date handling requirements
 */
export enum DateToolCategory {
  /** Availability searches - typically need future dates */
  AVAILABILITY = 'availability',
  /** Booking operations - context-dependent */
  BOOKING = 'booking',
  /** Rate queries - may need historical data */
  RATE = 'rate',
  /** Quote generation - needs future dates */
  QUOTE = 'quote',
  /** Historical queries - allows past dates */
  HISTORICAL = 'historical',
}

/**
 * Result of date validation with feedback-based approach
 */
export interface ValidationResult {
  /** Whether the date passed validation */
  isValid: boolean
  /** The original input date (never modified) */
  originalDate: string
  /** The validated date (only changed if valid or explicitly accepted) */
  validatedDate: string
  /** Structured feedback for validation issues */
  feedback?: DateValidationFeedback
  /** Legacy fields for backward compatibility - deprecated */
  /** @deprecated Use feedback.message instead */
  warning?: string
  /** @deprecated Use feedback.message instead */
  error?: string
  /** @deprecated Use feedback.suggestions instead */
  suggestedDate?: string
  /** @deprecated Use feedback instead */
  wasAutoCorrected?: boolean
  /** @deprecated Use feedback.context instead */
  context?: {
    /** Detected LLM cutoff issue */
    llmCutoffDetected?: boolean
    /** Years adjusted */
    yearsAdjusted?: number
    /** Validation mode used */
    mode?: ValidationMode
  }
}

/**
 * Configuration for date validation
 */
export interface ValidationConfig {
  /** Validation mode to use */
  mode?: ValidationMode
  /** Tool category for context-aware validation */
  category?: DateToolCategory
  /** Allow dates in the past */
  allowPast?: boolean
  /** Allow dates in the future */
  allowFuture?: boolean
  /** Maximum days in the past to allow */
  maxPastDays?: number
  /** Maximum days in the future to allow */
  maxFutureDays?: number
  /** Reference date for comparisons (defaults to today) */
  referenceDate?: Date
  /** Whether to detect and correct LLM cutoff issues */
  detectLLMCutoff?: boolean
  /** Known LLM cutoff year (e.g., 2024) */
  llmCutoffYear?: number
  /** Accessibility enhancements for feedback */
  accessibility?: AccessibilityEnhancements
  /** Internationalization preferences */
  i18n?: InternationalizationOptions
}

/**
 * Feedback severity levels for validation issues
 */
export enum FeedbackSeverity {
  /** Critical error - operation cannot proceed */
  ERROR = 'error',
  /** Warning - operation can proceed but user should review */
  WARNING = 'warning',
  /** Informational - helpful context for decision making */
  INFO = 'info',
}

/**
 * Feedback styles for different user contexts
 */
export enum FeedbackStyle {
  /** Brief, concise feedback for experienced users */
  CONCISE = 'concise',
  /** Detailed explanations with context */
  DETAILED = 'detailed',
  /** Interactive prompts requiring user confirmation */
  PROMPT = 'prompt',
}

/**
 * Machine-readable codes for specific validation issues
 */
export enum ValidationIssueCode {
  /** Date format is invalid */
  INVALID_FORMAT = 'invalid_format',
  /** Date appears to be from LLM training cutoff period */
  LLM_CUTOFF_SUSPECTED = 'llm_cutoff_suspected',
  /** Date is in the past when future expected */
  DATE_IN_PAST = 'date_in_past',
  /** Date is in the future when past allowed */
  DATE_IN_FUTURE = 'date_in_future',
  /** Date is too far in the past */
  TOO_FAR_PAST = 'too_far_past',
  /** Date is too far in the future */
  TOO_FAR_FUTURE = 'too_far_future',
  /** End date is before start date in range */
  INVALID_RANGE = 'invalid_range',
  /** Date is ambiguous and needs clarification */
  AMBIGUOUS_DATE = 'ambiguous_date',
}

/**
 * Accessibility features for validation feedback
 */
export interface AccessibilityEnhancements {
  /** ARIA label for screen readers */
  ariaLabel?: string
  /** ARIA description for additional context */
  ariaDescription?: string
  /** Semantic role for the feedback element */
  role?: 'alert' | 'status' | 'log'
  /** Priority level for screen readers */
  ariaPriority?: 'high' | 'medium' | 'low'
  /** Whether this feedback should be announced immediately */
  announceImmediately?: boolean
  /** Alternative text formats for different accessibility needs */
  alternativeFormats?: {
    /** Simple, clear language version */
    plainLanguage?: string
    /** Version with phonetic date pronunciation hints */
    phoneticHints?: string
    /** Structured format for screen reader navigation */
    structuredDescription?: string
  }
}

/**
 * Structured feedback object for date validation issues
 */
export interface DateValidationFeedback {
  /** Human-readable description of the validation issue */
  message: string
  /** Severity level of the issue */
  severity: FeedbackSeverity
  /** Current system date (ISO 8601 UTC) for context */
  currentDate: string
  /** Original date string provided by user */
  originalInput: string
  /** Machine-readable code for the specific issue */
  detectedIssue: ValidationIssueCode
  /** Actionable suggestions for correction */
  suggestions: string[]
  /** Whether explicit user confirmation is required */
  confirmationRequired: boolean
  /** Feedback style for user context */
  feedbackStyle: FeedbackStyle
  /** Accessibility enhancements for assistive technologies */
  accessibility?: AccessibilityEnhancements
  /** Additional context fields */
  context?: {
    /** LLM training cutoff year if relevant */
    cutoffYear?: number
    /** Days difference from current date */
    daysDifference?: number
    /** Allowed date range if applicable */
    allowedRange?: {
      minDate?: string
      maxDate?: string
    }
    /** Tool category context */
    toolCategory?: string
  }
}

/**
 * Internationalization support for feedback messages
 */
export interface InternationalizationOptions {
  /** Target language code (ISO 639-1) */
  language?: string
  /** Regional locale code (e.g., 'en-US', 'fr-CA') */
  locale?: string
  /** Date format preferences for the locale */
  dateFormat?: {
    /** Short date format (e.g., 'MM/dd/yyyy' for US, 'dd/MM/yyyy' for UK) */
    short: string
    /** Long date format (e.g., 'MMMM d, yyyy') */
    long: string
    /** Example date string in the preferred format */
    example: string
  }
  /** Cultural context considerations */
  culturalContext?: {
    /** Whether to use formal or informal language */
    formality?: 'formal' | 'informal'
    /** Cultural sensitivity for date-related concepts */
    culturalNotes?: string[]
  }
}

/**
 * Enhanced date validation info for tool responses with feedback-based approach
 */
export interface DateValidationInfo {
  dateValidation: {
    /** Feedback for single date validations */
    feedback?: DateValidationFeedback
    /** Legacy fields for backward compatibility */
    originalDate?: string
    validatedDate?: string
    wasAutoCorrected?: boolean
    warning?: string
    message?: string
    original?: string
    validated?: string
    // For range validations
    startDate?: {
      original: string
      validated: string
      warning?: string
      feedback?: DateValidationFeedback
    }
    endDate?: {
      original: string
      validated: string
      warning?: string
      feedback?: DateValidationFeedback
    }
    checkIn?: {
      original: string
      validated: string
      wasAutoCorrected?: boolean
      message?: string
      feedback?: DateValidationFeedback
    }
    checkOut?: {
      original: string
      validated: string
      wasAutoCorrected?: boolean
      message?: string
      feedback?: DateValidationFeedback
    }
    /** Range-specific feedback */
    rangeFeedback?: DateValidationFeedback
    /** Overall summary */
    summary?: string
  }
}

/**
 * Creates a structured feedback object for date validation issues
 */
export function createDateValidationFeedback(options: {
  message: string
  severity: FeedbackSeverity
  originalInput: string
  detectedIssue: ValidationIssueCode
  suggestions: string[]
  confirmationRequired?: boolean
  feedbackStyle?: FeedbackStyle
  context?: DateValidationFeedback['context']
  accessibility?: AccessibilityEnhancements
  i18n?: InternationalizationOptions
}): DateValidationFeedback {
  // Generate accessibility enhancements if not provided
  const accessibility =
    options.accessibility ??
    generateAccessibilityEnhancements(options.severity, options.detectedIssue, options.message)

  // Apply internationalization if provided
  const message = options.i18n ? localizeMessage(options.message, options.i18n) : options.message
  const suggestions = options.i18n
    ? options.suggestions.map((s) =>
        localizeMessage(s, options.i18n as InternationalizationOptions),
      )
    : options.suggestions

  return {
    message,
    severity: options.severity,
    currentDate: new Date().toISOString(),
    originalInput: options.originalInput,
    detectedIssue: options.detectedIssue,
    suggestions,
    confirmationRequired: options.confirmationRequired ?? false,
    feedbackStyle: options.feedbackStyle ?? FeedbackStyle.DETAILED,
    accessibility,
    context: options.context,
  }
}

/**
 * Generates accessibility enhancements based on feedback characteristics
 */
function generateAccessibilityEnhancements(
  severity: FeedbackSeverity,
  issue: ValidationIssueCode,
  message: string,
): AccessibilityEnhancements {
  const roleMap: Record<FeedbackSeverity, 'alert' | 'status' | 'log'> = {
    [FeedbackSeverity.ERROR]: 'alert',
    [FeedbackSeverity.WARNING]: 'status',
    [FeedbackSeverity.INFO]: 'log',
  }

  const priorityMap: Record<FeedbackSeverity, 'high' | 'medium' | 'low'> = {
    [FeedbackSeverity.ERROR]: 'high',
    [FeedbackSeverity.WARNING]: 'medium',
    [FeedbackSeverity.INFO]: 'low',
  }

  const ariaLabel = `Date validation ${severity}: ${issue.replace(/_/g, ' ')}`
  const plainLanguage = simplifyLanguage(message)
  const structuredDescription = createStructuredDescription(severity, issue, message)

  return {
    ariaLabel,
    ariaDescription: `Date validation feedback for input validation`,
    role: roleMap[severity],
    ariaPriority: priorityMap[severity],
    announceImmediately: severity === FeedbackSeverity.ERROR,
    alternativeFormats: {
      plainLanguage,
      phoneticHints: generatePhoneticHints(message),
      structuredDescription,
    },
  }
}

/**
 * Simplifies technical language for accessibility
 */
function simplifyLanguage(message: string): string {
  return message
    .replace(/YYYY-MM-DD/g, 'year-month-day format')
    .replace(/ISO 8601/g, 'international date standard')
    .replace(/LLM/g, 'AI system')
    .replace(/cutoff/g, 'training data limit')
    .replace(/validation/g, 'checking')
}

/**
 * Generates phonetic pronunciation hints for dates
 */
function generatePhoneticHints(message: string): string {
  // Extract dates and add pronunciation guidance
  return message.replace(/\d{4}-\d{2}-\d{2}/g, (date) => {
    const [year, month, day] = date.split('-')
    return `${date} (pronounced: ${year} ${month} ${day})`
  })
}

/**
 * Creates structured description for screen readers
 */
function createStructuredDescription(
  severity: FeedbackSeverity,
  issue: ValidationIssueCode,
  message: string,
): string {
  const severityText =
    severity === FeedbackSeverity.ERROR
      ? 'Error'
      : severity === FeedbackSeverity.WARNING
        ? 'Warning'
        : 'Information'

  const issueText = issue.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  return `${severityText}: ${issueText}. ${message}`
}

/**
 * Basic localization function - in a real implementation, this would use a full i18n library
 */
function localizeMessage(message: string, i18n: InternationalizationOptions): string {
  // This is a placeholder implementation - real i18n would use message keys and translation dictionaries
  if (i18n.language === 'es') {
    // Spanish translations for common patterns
    return message
      .replace(/Invalid date format/g, 'Formato de fecha inválido')
      .replace(/Date is in the past/g, 'La fecha está en el pasado')
      .replace(/Date appears to be from/g, 'La fecha parece ser de')
      .replace(/Current date:/g, 'Fecha actual:')
  } else if (i18n.language === 'fr') {
    // French translations for common patterns
    return message
      .replace(/Invalid date format/g, 'Format de date invalide')
      .replace(/Date is in the past/g, 'La date est dans le passé')
      .replace(/Date appears to be from/g, 'La date semble provenir de')
      .replace(/Current date:/g, 'Date actuelle:')
  }

  return message // Default to English
}

/**
 * Helper functions for creating common feedback scenarios
 */
export const FeedbackTemplates = {
  /**
   * Create feedback for suspected LLM cutoff dates
   */
  llmCutoffSuspected: (
    originalInput: string,
    currentYear: number,
    cutoffYear: number = 2024,
  ): DateValidationFeedback => {
    // Extract the year from the input and replace it with current year
    const inputYear = new Date(`${originalInput}T12:00:00Z`).getFullYear()
    const suggestedDate = originalInput.replace(String(inputYear), String(currentYear))
    return createDateValidationFeedback({
      message: `The date "${originalInput}" appears to be from a previous year (${cutoffYear}). Current year is ${currentYear}.`,
      severity: FeedbackSeverity.WARNING,
      originalInput,
      detectedIssue: ValidationIssueCode.LLM_CUTOFF_SUSPECTED,
      suggestions: [
        `If you meant this year, use: ${suggestedDate}`,
        `If you meant the historical date ${originalInput}, please confirm`,
        `Current date: ${new Date().toISOString().split('T')[0]}`,
      ],
      confirmationRequired: true,
      context: {
        cutoffYear,
      },
    })
  },

  /**
   * Create feedback for dates in the past when future expected
   */
  dateInPast: (
    originalInput: string,
    daysPast: number,
    toolCategory: string,
  ): DateValidationFeedback => {
    const todayDate = new Date().toISOString().split('T')[0]
    return createDateValidationFeedback({
      message: `The date "${originalInput}" is ${daysPast} days in the past. ${toolCategory} operations typically require future dates.`,
      severity: FeedbackSeverity.WARNING,
      originalInput,
      detectedIssue: ValidationIssueCode.DATE_IN_PAST,
      suggestions: [
        `Did you mean a future date?`,
        `Today's date: ${todayDate}`,
        `If you need past data, please confirm this is intentional`,
      ],
      confirmationRequired: true,
      context: {
        daysDifference: -daysPast,
        toolCategory,
      },
    })
  },

  /**
   * Create feedback for invalid date ranges
   */
  invalidRange: (startDate: string, endDate: string): DateValidationFeedback => {
    return createDateValidationFeedback({
      message: `Invalid date range: end date "${endDate}" is before start date "${startDate}".`,
      severity: FeedbackSeverity.ERROR,
      originalInput: `${startDate} to ${endDate}`,
      detectedIssue: ValidationIssueCode.INVALID_RANGE,
      suggestions: [
        `Ensure the end date is after the start date`,
        `Check if the dates were entered in the correct order`,
        `Current date: ${new Date().toISOString().split('T')[0]}`,
      ],
      confirmationRequired: false,
    })
  },
}

/**
 * Default configurations for different tool categories
 * Note: AUTO_CORRECT mode has been eliminated in favor of feedback-based validation
 */
const DEFAULT_CONFIGS: Record<DateToolCategory, Partial<ValidationConfig>> = {
  [DateToolCategory.AVAILABILITY]: {
    mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT - provides feedback instead
    allowPast: false,
    allowFuture: true,
    maxFutureDays: 730, // 2 years
    detectLLMCutoff: true,
  },
  [DateToolCategory.BOOKING]: {
    mode: ValidationMode.SOFT,
    allowPast: false,
    allowFuture: true,
    maxFutureDays: 365,
    detectLLMCutoff: true,
  },
  [DateToolCategory.RATE]: {
    mode: ValidationMode.SOFT,
    allowPast: true,
    allowFuture: true,
    maxPastDays: 365,
    maxFutureDays: 365,
    detectLLMCutoff: true,
  },
  [DateToolCategory.QUOTE]: {
    mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT - provides feedback instead
    allowPast: false,
    allowFuture: true,
    maxFutureDays: 365,
    detectLLMCutoff: true,
  },
  [DateToolCategory.HISTORICAL]: {
    mode: ValidationMode.SOFT,
    allowPast: true,
    allowFuture: true,
    detectLLMCutoff: false,
  },
}

/**
 * Main date validator class
 */
export class DateValidator {
  private config: ValidationConfig
  private referenceDate: Date

  constructor(config: ValidationConfig = {}) {
    this.config = this.mergeWithDefaults(config)
    this.referenceDate = config.referenceDate || new Date()
  }

  /**
   * Merge user config with category defaults
   */
  private mergeWithDefaults(config: ValidationConfig): ValidationConfig {
    const categoryDefaults = config.category ? DEFAULT_CONFIGS[config.category] : {}

    return {
      mode: ValidationMode.SOFT,
      allowPast: true,
      allowFuture: true,
      detectLLMCutoff: true,
      llmCutoffYear: 2024, // Common LLM training cutoff
      ...categoryDefaults,
      ...config,
    }
  }

  /**
   * Validate a single date with feedback-based approach
   */
  validateDate(dateString: string): ValidationResult {
    const originalDate = dateString

    // Basic format validation
    if (!this.isValidDateFormat(dateString)) {
      const feedback = createDateValidationFeedback({
        message: `Invalid date format. Expected YYYY-MM-DD, got: ${dateString}`,
        severity: FeedbackSeverity.ERROR,
        originalInput: dateString,
        detectedIssue: ValidationIssueCode.INVALID_FORMAT,
        suggestions: [
          'Use YYYY-MM-DD format (e.g., 2025-08-31)',
          'Ensure the date is valid (check month/day ranges)',
        ],
        i18n: this.config.i18n,
      })

      return {
        isValid: false,
        originalDate,
        validatedDate: originalDate, // Never modify the original input
        feedback,
        error: feedback.message,
      }
    }

    const date = new Date(`${dateString}T12:00:00Z`) // Use noon UTC to avoid timezone issues

    // Check for LLM cutoff issues (no auto-correction)
    const llmCutoffResult = this.detectLLMCutoffIssues(date, dateString)

    // Validate against past/future constraints (no auto-correction)
    const constraintResult = this.validateTimeConstraints(date, dateString)

    // Combine results with feedback prioritization
    return this.combineResults(originalDate, date, llmCutoffResult, constraintResult)
  }

  /**
   * Validate a date range (e.g., check-in/check-out)
   */
  validateDateRange(
    startDate: string,
    endDate: string,
  ): {
    start: ValidationResult
    end: ValidationResult
    rangeValid: boolean
    rangeError?: string
    rangeFeedback?: DateValidationFeedback
  } {
    const startResult = this.validateDate(startDate)
    const endResult = this.validateDate(endDate)

    // Only check range validity if both individual dates are valid
    let rangeValid = true
    let rangeError: string | undefined
    let rangeFeedback: DateValidationFeedback | undefined

    if (startResult.isValid && endResult.isValid) {
      // Use original dates for range comparison (never modified in feedback mode)
      const startDateObj = new Date(`${startResult.validatedDate}T12:00:00Z`)
      const endDateObj = new Date(`${endResult.validatedDate}T12:00:00Z`)

      rangeValid = endDateObj > startDateObj

      if (!rangeValid) {
        rangeFeedback = FeedbackTemplates.invalidRange(startDate, endDate)
        rangeError = rangeFeedback.message
      }
    } else {
      // If either date is invalid, range cannot be valid
      rangeValid = false
    }

    return {
      start: startResult,
      end: endResult,
      rangeValid,
      rangeError,
      rangeFeedback,
    }
  }

  /**
   * Check if date string is in valid YYYY-MM-DD format
   */
  private isValidDateFormat(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(dateString)) {
      return false
    }

    const date = new Date(`${dateString}T12:00:00Z`)
    if (!date || Number.isNaN(date.getTime())) {
      return false
    }

    // Check if the date components match what was provided
    // This catches invalid dates like 2023-02-29 which JS auto-corrects
    const [year, month, day] = dateString.split('-').map(Number)
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 && // JS months are 0-indexed
      date.getUTCDate() === day
    )
  }

  /**
   * Detect LLM cutoff issues and generate feedback
   */
  private detectLLMCutoffIssues(date: Date, dateString: string): Partial<ValidationResult> {
    if (!this.config.detectLLMCutoff) {
      return {}
    }

    const currentYear = this.referenceDate.getFullYear()
    const dateYear = date.getFullYear()
    const llmCutoffYear = this.config.llmCutoffYear || 2024

    // Detect if date is from a past year that might be LLM cutoff
    if (dateYear <= llmCutoffYear && dateYear < currentYear) {
      const feedback = FeedbackTemplates.llmCutoffSuspected(dateString, currentYear, llmCutoffYear)

      return {
        feedback,
        // Legacy fields for backward compatibility
        warning: feedback.message,
        suggestedDate: dateString.replace(String(dateYear), String(currentYear)),
        context: {
          llmCutoffDetected: true,
          yearsAdjusted: 0,
          mode: this.config.mode,
        },
      }
    }

    return {}
  }

  /**
   * Validate date against past/future constraints and generate feedback
   */
  private validateTimeConstraints(date: Date, originalInput: string): Partial<ValidationResult> {
    const daysDiff = this.getDaysDifference(date, this.referenceDate)

    // Check past constraint
    if (daysDiff < 0 && !this.config.allowPast) {
      const absDays = Math.abs(daysDiff)
      const toolCategory = this.config.category || 'this operation'

      if (this.config.mode === ValidationMode.HARD) {
        const feedback = createDateValidationFeedback({
          message: `Date is ${absDays} days in the past. Past dates are not allowed for ${toolCategory}.`,
          severity: FeedbackSeverity.ERROR,
          originalInput,
          detectedIssue: ValidationIssueCode.DATE_IN_PAST,
          suggestions: [
            'Please provide a future date',
            `Current date: ${new Date().toISOString().split('T')[0]}`,
          ],
          context: {
            daysDifference: daysDiff,
            toolCategory,
          },
          i18n: this.config.i18n,
        })

        return {
          isValid: false,
          feedback,
          error: feedback.message,
        }
      } else {
        // SOFT mode: provide feedback but allow processing
        const feedback = FeedbackTemplates.dateInPast(originalInput, absDays, toolCategory)

        return {
          isValid: true,
          feedback,
          warning: feedback.message,
        }
      }
    }

    // Check future constraint
    if (daysDiff > 0 && !this.config.allowFuture) {
      const feedback = createDateValidationFeedback({
        message: `Date is ${daysDiff} days in the future. Future dates may not be intended for this operation.`,
        severity:
          this.config.mode === ValidationMode.HARD
            ? FeedbackSeverity.ERROR
            : FeedbackSeverity.WARNING,
        originalInput,
        detectedIssue: ValidationIssueCode.DATE_IN_FUTURE,
        suggestions: [
          'Please confirm this future date is correct',
          `Current date: ${new Date().toISOString().split('T')[0]}`,
        ],
        context: {
          daysDifference: daysDiff,
          toolCategory: this.config.category,
        },
        i18n: this.config.i18n,
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }

    // Check max past days
    if (this.config.maxPastDays && daysDiff < 0 && Math.abs(daysDiff) > this.config.maxPastDays) {
      const feedback = createDateValidationFeedback({
        message: `Date is too far in the past (${Math.abs(daysDiff)} days). Maximum allowed: ${this.config.maxPastDays} days.`,
        severity:
          this.config.mode === ValidationMode.HARD
            ? FeedbackSeverity.ERROR
            : FeedbackSeverity.WARNING,
        originalInput,
        detectedIssue: ValidationIssueCode.TOO_FAR_PAST,
        suggestions: [
          `Please provide a date within the last ${this.config.maxPastDays} days`,
          `Current date: ${new Date().toISOString().split('T')[0]}`,
        ],
        context: {
          daysDifference: daysDiff,
          allowedRange: {
            minDate: new Date(
              this.referenceDate.getTime() - this.config.maxPastDays * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .split('T')[0],
          },
        },
        i18n: this.config.i18n,
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }

    // Check max future days
    if (this.config.maxFutureDays && daysDiff > this.config.maxFutureDays) {
      const feedback = createDateValidationFeedback({
        message: `Date is too far in the future (${daysDiff} days). Maximum allowed: ${this.config.maxFutureDays} days.`,
        severity:
          this.config.mode === ValidationMode.HARD
            ? FeedbackSeverity.ERROR
            : FeedbackSeverity.WARNING,
        originalInput,
        detectedIssue: ValidationIssueCode.TOO_FAR_FUTURE,
        suggestions: [
          `Please provide a date within the next ${this.config.maxFutureDays} days`,
          `Current date: ${new Date().toISOString().split('T')[0]}`,
        ],
        context: {
          daysDifference: daysDiff,
          allowedRange: {
            maxDate: new Date(
              this.referenceDate.getTime() + this.config.maxFutureDays * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .split('T')[0],
          },
        },
        i18n: this.config.i18n,
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }

    return { isValid: true }
  }

  /**
   * Calculate difference in days between two dates
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    const d1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate())
    const d2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate())
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.round((d1 - d2) / msPerDay)
  }

  /**
   * Combine validation results with feedback prioritization (no auto-correction)
   */
  private combineResults(
    originalDate: string,
    _validatedDate: Date, // Unused in feedback mode - we never modify original input
    llmResult: Partial<ValidationResult>,
    constraintResult: Partial<ValidationResult>,
  ): ValidationResult {
    // The validated date is only the original input - no modification
    const finalDateString = originalDate

    // Determine overall validity
    const isValid = constraintResult.isValid !== false

    // Prioritize feedback: LLM cutoff issues take precedence over constraint issues
    // This is because LLM cutoff issues are often the root cause of past date issues
    const primaryFeedback = llmResult.feedback || constraintResult.feedback

    return {
      isValid,
      originalDate,
      validatedDate: finalDateString, // Always return original input
      feedback: primaryFeedback,
      // Legacy fields for backward compatibility
      warning: constraintResult.warning || llmResult.warning,
      error: constraintResult.error,
      suggestedDate: llmResult.suggestedDate,
      wasAutoCorrected: false, // Never auto-correct in feedback mode
      context: {
        ...llmResult.context,
        mode: this.config.mode,
      },
    }
  }

  /**
   * Get a user-friendly message for validation results
   */
  static formatUserMessage(result: ValidationResult): string {
    if (!result.isValid && result.error) {
      return `❌ Date validation failed: ${result.error}`
    }

    const messages: string[] = []

    if (result.wasAutoCorrected) {
      messages.push(`✅ Date auto-corrected from ${result.originalDate} to ${result.validatedDate}`)
    }

    if (result.warning) {
      messages.push(`⚠️ ${result.warning}`)
    }

    if (result.suggestedDate && !result.wasAutoCorrected) {
      messages.push(`💡 Suggestion: Use ${result.suggestedDate} instead`)
    }

    return messages.length > 0 ? messages.join('\n') : '✅ Date is valid'
  }
}

/**
 * Factory function to create validators for specific tool categories
 */
export function createValidator(
  category: DateToolCategory,
  overrides?: Partial<ValidationConfig>,
): DateValidator {
  return new DateValidator({
    category,
    ...overrides,
  })
}

/**
 * Convenience validators for common use cases
 */
export const validators = {
  availability: () => createValidator(DateToolCategory.AVAILABILITY),
  booking: () => createValidator(DateToolCategory.BOOKING),
  rate: () => createValidator(DateToolCategory.RATE),
  quote: () => createValidator(DateToolCategory.QUOTE),
  historical: () => createValidator(DateToolCategory.HISTORICAL),
}
