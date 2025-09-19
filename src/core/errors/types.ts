/**
 * Error handling types
 */

/**
 * Lodgify API Error Codes as documented in the API
 */
export enum LodgifyErrorCode {
  Unknown = 'Unknown',
  NoRateDefined = 'NoRateDefined',
  MinStayRequired = 'MinStayRequired',
  BookingStatusUnknown = 'BookingStatusUnknown',
  BookingMessageTypeNotAllowed = 'BookingMessageTypeNotAllowed',
  BookingNoRooms = 'BookingNoRooms',
  BookingCannotChangeStatus = 'BookingCannotChangeStatus',
  EnquiryAlreadyUpgraded = 'EnquiryAlreadyUpgraded',
  BookingPaymentNotValid = 'BookingPaymentNotValid',
  ArrivalNotValid = 'ArrivalNotValid',
  DepartureNotValid = 'DepartureNotValid',
  PropertyNotAvailable = 'PropertyNotAvailable',
  CaptchaInvalid = 'CaptchaInvalid',
  StripeError = 'StripeError',
  ValidationError = 'ValidationError',
  PaymentError = 'PaymentError',
  ArgumentError = 'ArgumentError',
  NotFound = 'NotFound',
  NotImplemented = 'NotImplemented',
  NotAuthorized = 'NotAuthorized',
}

/**
 * Actual error structure returned by Lodgify API v2
 * Based on API documentation review
 */
export interface LodgifyApiError {
  message: string | null
  code: LodgifyErrorCode | string
  correlation_id: string | null
  event_id: string | null
}

/**
 * Standard error structure for Lodgify API errors (legacy/internal use)
 * @deprecated Use LodgifyApiError for new code that handles API responses
 */
export interface LodgifyError {
  error: true
  message: string
  status: number
  path: string
  detail?: unknown
}

/**
 * Validation result for input validation
 */
export interface ValidationResult {
  isValid: boolean
  sanitized?: string
  error?: string
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  includeStackTrace?: boolean
  sanitizeSensitiveData?: boolean
  customStatusMessages?: Record<number, string>
}

/**
 * HTTP error response
 */
export interface HttpErrorResponse {
  status: number
  statusText: string
  headers?: Headers
  body?: unknown
}

/**
 * Type guard to check if an error is a LodgifyApiError
 */
export function isLodgifyApiError(error: unknown): error is LodgifyApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    !('error' in error) // Distinguish from LodgifyError
  )
}

/**
 * Type guard to check if an error is a legacy LodgifyError
 */
export function isLodgifyError(error: unknown): error is LodgifyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    (error as LodgifyError).error === true &&
    'message' in error &&
    'status' in error &&
    'path' in error
  )
}

/**
 * Maps a LodgifyApiError to a LodgifyError for backward compatibility
 */
export function mapApiErrorToLegacy(
  apiError: LodgifyApiError,
  status: number,
  path: string,
): LodgifyError {
  return {
    error: true,
    message: apiError.message || 'An error occurred',
    status,
    path,
    detail: {
      code: apiError.code,
      correlation_id: apiError.correlation_id,
      event_id: apiError.event_id,
    },
  }
}
