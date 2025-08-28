/**
 * Rate limiter implementation with sliding window
 */

import type { RateLimiter, RateLimiterConfig, RateLimitStatus } from './types.js'

/**
 * Sliding window rate limiter
 * Tracks requests within a time window and enforces rate limits
 */
export class SlidingWindowRateLimiter implements RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private requestCount = 0
  private windowStart = Date.now()

  constructor(config: RateLimiterConfig) {
    this.limit = config.limit
    this.windowMs = config.windowMs
  }

  /**
   * Check if the current window has expired and reset if needed
   */
  private checkWindow(): void {
    const now = Date.now()
    if (now - this.windowStart >= this.windowMs) {
      this.requestCount = 0
      this.windowStart = now
    }
  }

  /**
   * Check if a request can be made within the rate limit
   */
  checkLimit(): boolean {
    this.checkWindow()
    return this.requestCount < this.limit
  }

  /**
   * Record that a request has been made
   */
  recordRequest(): void {
    this.checkWindow()
    this.requestCount++
  }

  /**
   * Get the number of remaining requests in the current window
   */
  getRemaining(): number {
    this.checkWindow()
    return Math.max(0, this.limit - this.requestCount)
  }

  /**
   * Get the time until the window resets (in milliseconds)
   */
  getResetTime(): number {
    const now = Date.now()
    const windowEnd = this.windowStart + this.windowMs
    return Math.max(0, windowEnd - now)
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestCount = 0
    this.windowStart = Date.now()
  }

  /**
   * Get the current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.checkWindow()
    return {
      allowed: this.requestCount < this.limit,
      remaining: this.getRemaining(),
      resetTime: this.getResetTime(),
      limit: this.limit,
      windowMs: this.windowMs,
    }
  }
}

/**
 * Factory function to create a rate limiter with default Lodgify settings
 */
export function createLodgifyRateLimiter(): RateLimiter {
  return new SlidingWindowRateLimiter({
    limit: 60, // 60 requests
    windowMs: 60000, // per minute
  })
}
