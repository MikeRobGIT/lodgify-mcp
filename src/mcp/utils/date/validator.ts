import { getTranslator } from '../i18n/index.js'

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
 * Date range constants for validation limits
 */
export const ONE_YEAR_DAYS = 365
export const TWO_YEARS_DAYS = 730
export const DEFAULT_MAX_PAST_DAYS = 365
export const DEFAULT_MAX_FUTURE_DAYS_SHORT = 365 // For bookings, quotes, rates
export const DEFAULT_MAX_FUTURE_DAYS_LONG = 730 // For availability (2 years)

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
 * Descriptor for messages that can be localized via translation keys
 */
export type LocalizableText =
  | string
  | {
      /** Translation key (namespace included) */
      key: string
      /** Default English message with interpolation placeholders */
      defaultValue: string
      /** Dynamic values for interpolation */
      values?: Record<string, unknown>
      /** Count value for pluralization */
      count?: number
    }

/**
 * Helper to build LocalizableText descriptors with strong defaults
 */
export function createLocalizedText(
  key: string,
  defaultValue: string,
  values?: Record<string, unknown>,
  count?: number,
): LocalizableText {
  return {
    key,
    defaultValue,
    values,
    count,
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
  message: LocalizableText
  severity: FeedbackSeverity
  originalInput: string
  detectedIssue: ValidationIssueCode
  suggestions: LocalizableText[]
  confirmationRequired?: boolean
  feedbackStyle?: FeedbackStyle
  context?: DateValidationFeedback['context']
  accessibility?: AccessibilityEnhancements
  i18n?: InternationalizationOptions
}): DateValidationFeedback {
  // Generate accessibility enhancements if not provided
  const baseMessage = formatDefaultText(options.message)
  const accessibility =
    options.accessibility ??
    generateAccessibilityEnhancements(options.severity, options.detectedIssue, baseMessage)

  // Apply internationalization if provided
  const message = renderLocalizedText(options.message, options.i18n)
  const suggestions = options.suggestions.map((suggestion) =>
    renderLocalizedText(suggestion, options.i18n),
  )

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
 * Resolve localized message text with fallback interpolation support
 */
function renderLocalizedText(text: LocalizableText, i18n?: InternationalizationOptions): string {
  if (!i18n) {
    return formatDefaultText(text)
  }

  return localizeMessage(text, i18n)
}

/**
 * Localize a message using the shared i18n translator infrastructure
 */
function localizeMessage(text: LocalizableText, i18n: InternationalizationOptions): string {
  if (typeof text === 'string') {
    return text
  }

  const translator = getTranslator('validator', i18n)
  const values = {
    ...(text.values ?? {}),
  }

  if (typeof text.count === 'number' && values.count === undefined) {
    values.count = text.count
  }

  const translationKey = normalizeTranslationKey(text.key)

  return translator(translationKey, {
    defaultValue: text.defaultValue,
    ...values,
  })
}

function normalizeTranslationKey(key: string): string {
  if (key.includes(':')) {
    return key
  }

  const [maybeNamespace, ...rest] = key.split('.')
  if (rest.length > 0 && maybeNamespace === 'validator') {
    return rest.join('.')
  }

  return key
}

/**
 * Replace interpolation tokens in the default message for fallback rendering
 */
function formatDefaultText(text: LocalizableText): string {
  if (typeof text === 'string') {
    return text
  }

  const values = {
    ...(text.values ?? {}),
  }

  if (typeof text.count === 'number' && values.count === undefined) {
    values.count = text.count
  }

  return interpolateDefault(text.defaultValue, values)
}

function interpolateDefault(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^,}\s]+)[^}]*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim()
    const value = values[key]

    if (value === undefined || value === null) {
      return ''
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
    }

    return String(value)
  })
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
    i18n?: InternationalizationOptions,
  ): DateValidationFeedback => {
    // Extract the year from the input and replace it with current year
    const inputYear = new Date(`${originalInput}T12:00:00Z`).getFullYear()
    const suggestedDate = originalInput.replace(String(inputYear), String(currentYear))
    const currentDate = new Date()

    return createDateValidationFeedback({
      message: createLocalizedText(
        'validator.llmCutoffSuspected',
        'The date "{{date}}" appears to be from a previous year ({{cutoffYear}}). Current year is {{currentYear}}.',
        {
          date: originalInput,
          cutoffYear,
          currentYear,
        },
      ),
      severity: FeedbackSeverity.WARNING,
      originalInput,
      detectedIssue: ValidationIssueCode.LLM_CUTOFF_SUSPECTED,
      suggestions: [
        createLocalizedText(
          'validator.suggestions.useCurrentYear',
          'If you meant this year, use: {{suggestedDate}}',
          {
            suggestedDate,
          },
        ),
        createLocalizedText(
          'validator.suggestions.confirmHistoricalDate',
          'If you meant the historical date {{originalDate}}, please confirm',
          {
            originalDate: originalInput,
          },
        ),
        createLocalizedText(
          'validator.suggestions.currentDate',
          'Current date: {{currentDate, date}}',
          {
            currentDate,
          },
        ),
      ],
      confirmationRequired: true,
      context: {
        cutoffYear,
      },
      i18n,
    })
  },

  /**
   * Create feedback for dates in the past when future expected
   */
  dateInPast: (
    originalInput: string,
    daysPast: number,
    toolCategory: string,
    i18n?: InternationalizationOptions,
  ): DateValidationFeedback => {
    const today = new Date()
    return createDateValidationFeedback({
      message: createLocalizedText(
        'validator.dateInPastSoft',
        'The date "{{date}}" is {{count}} days in the past. {{toolCategory}} operations typically require future dates.',
        {
          date: originalInput,
          toolCategory,
        },
        daysPast,
      ),
      severity: FeedbackSeverity.WARNING,
      originalInput,
      detectedIssue: ValidationIssueCode.DATE_IN_PAST,
      suggestions: [
        createLocalizedText(
          'validator.suggestions.didYouMeanFuture',
          'Did you mean a future date?',
        ),
        createLocalizedText(
          'validator.suggestions.todaysDate',
          "Today's date: {{currentDate, date}}",
          {
            currentDate: today,
          },
        ),
        createLocalizedText(
          'validator.suggestions.confirmPastData',
          'If you need past data, please confirm this is intentional',
        ),
      ],
      confirmationRequired: true,
      context: {
        daysDifference: -daysPast,
        toolCategory,
      },
      i18n,
    })
  },

  /**
   * Create feedback for invalid date ranges
   */
  invalidRange: (
    startDate: string,
    endDate: string,
    i18n?: InternationalizationOptions,
  ): DateValidationFeedback => {
    return createDateValidationFeedback({
      message: createLocalizedText(
        'validator.invalidRange',
        'Invalid date range: end date "{{endDate}}" is before start date "{{startDate}}".',
        {
          startDate,
          endDate,
        },
      ),
      severity: FeedbackSeverity.ERROR,
      originalInput: `${startDate} to ${endDate}`,
      detectedIssue: ValidationIssueCode.INVALID_RANGE,
      suggestions: [
        createLocalizedText(
          'validator.suggestions.ensureEndAfterStart',
          'Ensure the end date is after the start date',
        ),
        createLocalizedText(
          'validator.suggestions.checkDateOrder',
          'Check if the dates were entered in the correct order',
        ),
        createLocalizedText(
          'validator.suggestions.currentDate',
          'Current date: {{currentDate, date}}',
          {
            currentDate: new Date(),
          },
        ),
      ],
      confirmationRequired: false,
      i18n,
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
    maxFutureDays: DEFAULT_MAX_FUTURE_DAYS_LONG, // 2 years
    detectLLMCutoff: true,
  },
  [DateToolCategory.BOOKING]: {
    mode: ValidationMode.SOFT,
    allowPast: false,
    allowFuture: true,
    maxFutureDays: DEFAULT_MAX_FUTURE_DAYS_SHORT,
    detectLLMCutoff: true,
  },
  [DateToolCategory.RATE]: {
    mode: ValidationMode.SOFT,
    allowPast: true,
    allowFuture: true,
    maxPastDays: DEFAULT_MAX_PAST_DAYS,
    maxFutureDays: DEFAULT_MAX_FUTURE_DAYS_SHORT,
    detectLLMCutoff: true,
  },
  [DateToolCategory.QUOTE]: {
    mode: ValidationMode.SOFT, // Changed from AUTO_CORRECT - provides feedback instead
    allowPast: false,
    allowFuture: true,
    maxFutureDays: DEFAULT_MAX_FUTURE_DAYS_SHORT,
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
      const isoExample = '2025-08-31'
      const feedback = createDateValidationFeedback({
        message: createLocalizedText(
          'validator.invalidFormat',
          'Invalid date format. Expected {{expectedFormat}}, got: {{actual}}',
          {
            expectedFormat: 'YYYY-MM-DD',
            actual: dateString,
          },
        ),
        severity: FeedbackSeverity.ERROR,
        originalInput: dateString,
        detectedIssue: ValidationIssueCode.INVALID_FORMAT,
        suggestions: [
          createLocalizedText(
            'validator.suggestions.useIsoFormat',
            'Use {{expectedFormat}} format (e.g., {{example}})',
            {
              expectedFormat: 'YYYY-MM-DD',
              example: isoExample,
            },
          ),
          createLocalizedText(
            'validator.suggestions.ensureValidRange',
            'Ensure the date is valid (check month/day ranges)',
          ),
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

      rangeValid = endDateObj >= startDateObj

      if (!rangeValid) {
        rangeFeedback = FeedbackTemplates.invalidRange(startDate, endDate, this.config.i18n)
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
      const feedback = FeedbackTemplates.llmCutoffSuspected(
        dateString,
        currentYear,
        llmCutoffYear,
        this.config.i18n,
      )

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

    // Check each constraint in order, returning first issue found
    const pastResult = this.checkPastConstraint(originalInput, daysDiff)
    if (pastResult) return pastResult

    const futureResult = this.checkFutureConstraint(originalInput, daysDiff)
    if (futureResult) return futureResult

    const maxPastResult = this.checkMaxPastDays(originalInput, daysDiff)
    if (maxPastResult) return maxPastResult

    const maxFutureResult = this.checkMaxFutureDays(originalInput, daysDiff)
    if (maxFutureResult) return maxFutureResult

    return { isValid: true }
  }

  /**
   * Check if date violates past constraint
   */
  private checkPastConstraint(
    originalInput: string,
    daysDiff: number,
  ): Partial<ValidationResult> | null {
    if (daysDiff < 0 && !this.config.allowPast) {
      const absDays = Math.abs(daysDiff)
      const toolCategory = this.config.category || 'this operation'
      const severity =
        this.config.mode === ValidationMode.HARD ? FeedbackSeverity.ERROR : FeedbackSeverity.WARNING

      const feedback = this.buildDateFeedback({
        messageKey: 'validator.dateInPastHard',
        messageTemplate:
          'Date is {{count}} days in the past. Past dates are not allowed for {{toolCategory}}.',
        messageParams: { toolCategory },
        count: absDays,
        severity,
        originalInput,
        issueCode: ValidationIssueCode.DATE_IN_PAST,
        suggestions: [
          {
            key: 'validator.suggestions.provideFutureDate',
            template: 'Please provide a future date',
          },
          {
            key: 'validator.suggestions.currentDate',
            template: 'Current date: {{currentDate, date}}',
            params: { currentDate: new Date() },
          },
        ],
        context: {
          daysDifference: daysDiff,
          toolCategory,
        },
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }
    return null
  }

  /**
   * Check if date violates future constraint
   */
  private checkFutureConstraint(
    originalInput: string,
    daysDiff: number,
  ): Partial<ValidationResult> | null {
    if (daysDiff > 0 && !this.config.allowFuture) {
      const severity = this.determineSeverity()

      const feedback = this.buildDateFeedback({
        messageKey: 'validator.dateInFuture',
        messageTemplate:
          'Date is {{count}} days in the future. Future dates may not be intended for this operation.',
        count: daysDiff,
        severity,
        originalInput,
        issueCode: ValidationIssueCode.DATE_IN_FUTURE,
        suggestions: [
          {
            key: 'validator.suggestions.confirmFutureDate',
            template: 'Please confirm this future date is correct',
          },
          {
            key: 'validator.suggestions.currentDate',
            template: 'Current date: {{currentDate, date}}',
            params: { currentDate: new Date() },
          },
        ],
        context: {
          daysDifference: daysDiff,
          toolCategory: this.config.category,
        },
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }
    return null
  }

  /**
   * Check if date violates maximum past days constraint
   */
  private checkMaxPastDays(
    originalInput: string,
    daysDiff: number,
  ): Partial<ValidationResult> | null {
    if (this.config.maxPastDays && daysDiff < 0 && Math.abs(daysDiff) > this.config.maxPastDays) {
      const absDays = Math.abs(daysDiff)
      const maxPastDays = this.config.maxPastDays
      const severity = this.determineSeverity()

      const feedback = this.buildDateFeedback({
        messageKey: 'validator.tooFarPast',
        messageTemplate:
          'Date is too far in the past ({{count}} days). Maximum allowed: {{maxDays}} days.',
        messageParams: { maxDays: maxPastDays },
        count: absDays,
        severity,
        originalInput,
        issueCode: ValidationIssueCode.TOO_FAR_PAST,
        suggestions: [
          {
            key: 'validator.suggestions.provideRecentDate',
            template: 'Please provide a date within the last {{maxDays}} days',
            params: { maxDays: maxPastDays },
          },
          {
            key: 'validator.suggestions.currentDate',
            template: 'Current date: {{currentDate, date}}',
            params: { currentDate: new Date() },
          },
        ],
        context: {
          daysDifference: daysDiff,
          allowedRange: {
            minDate: new Date(this.referenceDate.getTime() - maxPastDays * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
          },
        },
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }
    return null
  }

  /**
   * Check if date violates maximum future days constraint
   */
  private checkMaxFutureDays(
    originalInput: string,
    daysDiff: number,
  ): Partial<ValidationResult> | null {
    if (this.config.maxFutureDays && daysDiff > this.config.maxFutureDays) {
      const maxFutureDays = this.config.maxFutureDays
      const severity = this.determineSeverity()

      const feedback = this.buildDateFeedback({
        messageKey: 'validator.tooFarFuture',
        messageTemplate:
          'Date is too far in the future ({{count}} days). Maximum allowed: {{maxDays}} days.',
        messageParams: { maxDays: maxFutureDays },
        count: daysDiff,
        severity,
        originalInput,
        issueCode: ValidationIssueCode.TOO_FAR_FUTURE,
        suggestions: [
          {
            key: 'validator.suggestions.provideUpcomingDate',
            template: 'Please provide a date within the next {{maxDays}} days',
            params: { maxDays: maxFutureDays },
          },
          {
            key: 'validator.suggestions.currentDate',
            template: 'Current date: {{currentDate, date}}',
            params: { currentDate: new Date() },
          },
        ],
        context: {
          daysDifference: daysDiff,
          allowedRange: {
            maxDate: new Date(this.referenceDate.getTime() + maxFutureDays * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
          },
        },
      })

      return {
        isValid: this.config.mode !== ValidationMode.HARD,
        feedback,
        error: this.config.mode === ValidationMode.HARD ? feedback.message : undefined,
        warning: this.config.mode !== ValidationMode.HARD ? feedback.message : undefined,
      }
    }
    return null
  }

  /**
   * Helper: Determine severity based on validation mode
   */
  private determineSeverity(): FeedbackSeverity {
    return this.config.mode === ValidationMode.HARD
      ? FeedbackSeverity.ERROR
      : FeedbackSeverity.WARNING
  }

  /**
   * Helper: Build date validation feedback with standardized structure
   */
  private buildDateFeedback(options: {
    messageKey: string
    messageTemplate: string
    messageParams?: Record<string, unknown>
    count?: number
    severity: FeedbackSeverity
    originalInput: string
    issueCode: ValidationIssueCode
    suggestions: Array<{
      key: string
      template: string
      params?: Record<string, unknown>
    }>
    context?: Record<string, unknown>
  }): DateValidationFeedback {
    const {
      messageKey,
      messageTemplate,
      messageParams,
      count,
      severity,
      originalInput,
      issueCode,
      suggestions,
      context,
    } = options

    return createDateValidationFeedback({
      message: createLocalizedText(messageKey, messageTemplate, messageParams, count),
      severity,
      originalInput,
      detectedIssue: issueCode,
      suggestions: suggestions.map((suggestion) =>
        createLocalizedText(suggestion.key, suggestion.template, suggestion.params),
      ),
      context,
      i18n: this.config.i18n,
    })
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
