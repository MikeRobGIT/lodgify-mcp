/**
 * Rate limiter types
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  limit: number // Maximum number of requests
  windowMs: number // Time window in milliseconds
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /**
   * Check if a request can be made within the rate limit
   */
  checkLimit(): boolean

  /**
   * Record that a request has been made
   */
  recordRequest(): void

  /**
   * Get the number of remaining requests in the current window
   */
  getRemaining(): number

  /**
   * Get the time until the window resets (in milliseconds)
   */
  getResetTime(): number

  /**
   * Reset the rate limiter
   */
  reset(): void
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  allowed: boolean
  remaining: number
  resetTime: number
  limit: number
  windowMs: number
}
