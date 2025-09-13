/**
 * Rate limiting for authentication endpoints
 */

import type { NextFunction, Request, Response } from 'express'

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean // Don't count successful requests
  keyGenerator?: (req: Request) => string // Custom key generator
  message?: string // Error message
}

/**
 * Default rate limit configurations
 */
export const DEFAULT_RATE_LIMITS = {
  // Strict limit for login attempts
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
    message: 'Too many login attempts, please try again later',
  },
  // Moderate limit for token validation
  tokenValidation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Too many validation requests, please slow down',
  },
  // Lenient limit for general API access
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests, please slow down',
  },
  // Very strict limit for token refresh
  refresh: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 refreshes per hour
    skipSuccessfulRequests: false,
    message: 'Too many token refresh attempts',
  },
}

/**
 * In-memory store for rate limit tracking
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  /**
   * Increment counter for a key
   */
  increment(key: string, windowMs: number): number {
    const now = Date.now()
    const resetTime = now + windowMs

    const entry = this.store.get(key)

    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired one
      this.store.set(key, { count: 1, resetTime })
      return 1
    }

    // Increment existing counter
    entry.count++
    return entry.count
  }

  /**
   * Get current count for a key
   */
  get(key: string): number {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || entry.resetTime <= now) {
      return 0
    }

    return entry.count
  }

  /**
   * Reset counter for a key
   */
  reset(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Destroy the store and clear cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore()

/**
 * Create a rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | undefined> => {
    try {
      // Generate key for this request
      const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req)

      // Check if we should skip this request
      if (config.skipSuccessfulRequests) {
        // Store original next to check if request was successful
        const originalNext = next
        next = (error?: unknown) => {
          if (!error) {
            // Successful request, don't count it
            rateLimitStore.reset(key)
          }
          originalNext(error)
        }
      }

      // Increment counter
      const count = rateLimitStore.increment(key, config.windowMs)

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count).toString())
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString())

      // Check if limit exceeded
      if (count > config.maxRequests) {
        res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000).toString())

        return res.status(429).json({
          error: config.message || 'Too many requests',
          retryAfter: Math.ceil(config.windowMs / 1000),
        })
      }

      next()
      return undefined
    } catch (_error) {
      // Handle unexpected errors
      return res.status(500).json({
        error: 'Internal server error',
      })
    }
  }
}

/**
 * Generate default rate limit key
 */
function getDefaultKey(req: Request): string {
  // Use IP address as key
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'

  // Include path to separate limits for different endpoints
  return `${ip}:${req.path}`
}

/**
 * Rate limiter specifically for authentication endpoints
 */
export const authRateLimiter = {
  login: createRateLimiter(DEFAULT_RATE_LIMITS.login),
  tokenValidation: createRateLimiter(DEFAULT_RATE_LIMITS.tokenValidation),
  refresh: createRateLimiter(DEFAULT_RATE_LIMITS.refresh),
  general: createRateLimiter(DEFAULT_RATE_LIMITS.general),
}

/**
 * Clean up rate limit store (call on server shutdown)
 */
export function cleanupRateLimiter(): void {
  rateLimitStore.destroy()
}
