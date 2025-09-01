/**
 * Retry mechanism types
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries?: number
  maxRetryDelay?: number
  initialDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (status: number, attempt: number) => boolean
}

/**
 * Sleep function type for testing
 */
export type SleepFunction = (ms: number) => Promise<void>

/**
 * Retry context passed to retry handlers
 */
export interface RetryContext {
  attempt: number
  totalAttempts: number
  lastError?: unknown
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: unknown
  attempts: number
}
