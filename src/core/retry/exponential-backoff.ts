/**
 * Exponential backoff retry mechanism
 */

import type { RetryConfig, RetryContext, RetryResult, SleepFunction } from './types.js'

/**
 * Exponential backoff retry handler
 * Implements retry logic with exponential backoff and configurable parameters
 */
export class ExponentialBackoffRetry {
  private readonly maxRetries: number
  private readonly maxRetryDelay: number
  private readonly initialDelay: number
  private readonly backoffMultiplier: number
  private readonly shouldRetry: (status: number, attempt: number) => boolean
  private readonly sleepFn: SleepFunction

  constructor(config?: RetryConfig, sleepFn?: SleepFunction) {
    this.maxRetries = config?.maxRetries ?? 5
    this.maxRetryDelay = config?.maxRetryDelay ?? 30000 // 30 seconds
    this.initialDelay = config?.initialDelay ?? 1000 // 1 second
    this.backoffMultiplier = config?.backoffMultiplier ?? 2
    this.shouldRetry = config?.shouldRetry ?? this.defaultShouldRetry
    this.sleepFn = sleepFn ?? this.defaultSleep
  }

  /**
   * Default sleep implementation using setTimeout
   */
  private defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Default retry predicate - retry on 429 and 5xx errors
   */
  private defaultShouldRetry(status: number, _attempt: number): boolean {
    // Always retry on rate limiting
    if (status === 429) return true

    // Retry on server errors (5xx)
    if (status >= 500 && status < 600) return true

    // Don't retry on client errors (4xx) except 429
    if (status >= 400 && status < 500) return false

    // Retry on network errors (status 0)
    if (status === 0) return true

    return false
  }

  /**
   * Calculate delay for the next retry attempt
   */
  private calculateDelay(attempt: number, retryAfterHeader?: string): number {
    // Use Retry-After header if present
    if (retryAfterHeader) {
      const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10)
      if (!Number.isNaN(retryAfterSeconds)) {
        return Math.min(retryAfterSeconds * 1000, this.maxRetryDelay)
      }
    }

    // Calculate exponential backoff delay
    const delay = this.initialDelay * this.backoffMultiplier ** attempt
    return Math.min(delay, this.maxRetryDelay)
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: (context: RetryContext) => Promise<T>,
    getRetryAfter?: (error: unknown) => string | undefined,
  ): Promise<RetryResult<T>> {
    let lastError: unknown

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const context: RetryContext = {
        attempt: attempt + 1,
        totalAttempts: this.maxRetries,
        lastError,
      }

      try {
        const data = await fn(context)
        return {
          success: true,
          data,
          attempts: attempt + 1,
        }
      } catch (error) {
        lastError = error

        // Check if we should retry
        const status = this.getStatusFromError(error)
        if (!this.shouldRetry(status, attempt)) {
          return {
            success: false,
            error,
            attempts: attempt + 1,
          }
        }

        // Don't sleep on the last attempt
        if (attempt < this.maxRetries - 1) {
          const retryAfter = getRetryAfter?.(error)
          const delay = this.calculateDelay(attempt, retryAfter)
          await this.sleepFn(delay)
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.maxRetries,
    }
  }

  /**
   * Extract HTTP status code from error
   */
  private getStatusFromError(error: unknown): number {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: unknown }).status
      if (typeof status === 'number') {
        return status
      }
    }
    return 0 // Network error or unknown
  }

  /**
   * Execute a function with retry logic, throwing on failure
   */
  async executeOrThrow<T>(
    fn: (context: RetryContext) => Promise<T>,
    getRetryAfter?: (error: unknown) => string | undefined,
  ): Promise<T> {
    const result = await this.execute(fn, getRetryAfter)

    if (!result.success) {
      throw result.error
    }

    return result.data as T
  }
}
