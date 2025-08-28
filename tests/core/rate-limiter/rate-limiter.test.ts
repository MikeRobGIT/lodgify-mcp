/**
 * Tests for SlidingWindowRateLimiter
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createLodgifyRateLimiter,
  SlidingWindowRateLimiter,
} from '../../../src/core/rate-limiter/rate-limiter.js'

describe('SlidingWindowRateLimiter', () => {
  let originalDateNow: typeof Date.now
  let currentTime: number

  beforeEach(() => {
    // Mock Date.now for consistent testing
    originalDateNow = Date.now
    currentTime = 1000000
    Date.now = () => currentTime
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('constructor', () => {
    test('should initialize with provided configuration', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 10,
        windowMs: 5000,
      })

      expect(limiter.checkLimit()).toBe(true)
      expect(limiter.getRemaining()).toBe(10)
    })
  })

  describe('checkLimit', () => {
    test('should allow requests within limit', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 3,
        windowMs: 1000,
      })

      expect(limiter.checkLimit()).toBe(true)
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(true)
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(true)
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(false)
    })

    test('should reset window after time expires', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 2,
        windowMs: 1000,
      })

      // Use up the limit
      limiter.recordRequest()
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(false)

      // Advance time past window
      currentTime += 1001
      expect(limiter.checkLimit()).toBe(true)
      expect(limiter.getRemaining()).toBe(2)
    })

    test('should handle multiple windows', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 2,
        windowMs: 1000,
      })

      // First window
      limiter.recordRequest()
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(false)

      // Second window
      currentTime += 1000
      expect(limiter.checkLimit()).toBe(true)
      limiter.recordRequest()
      limiter.recordRequest()
      expect(limiter.checkLimit()).toBe(false)

      // Third window
      currentTime += 1000
      expect(limiter.checkLimit()).toBe(true)
    })
  })

  describe('recordRequest', () => {
    test('should increment request count', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 5,
        windowMs: 1000,
      })

      expect(limiter.getRemaining()).toBe(5)
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(4)
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(3)
    })

    test('should reset count when window expires', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 3,
        windowMs: 1000,
      })

      limiter.recordRequest()
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(1)

      currentTime += 1000
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(2) // Reset to new window
    })
  })

  describe('getRemaining', () => {
    test('should return correct remaining requests', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 10,
        windowMs: 1000,
      })

      expect(limiter.getRemaining()).toBe(10)

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest()
      }
      expect(limiter.getRemaining()).toBe(5)

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest()
      }
      expect(limiter.getRemaining()).toBe(0)

      // Should not go negative
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(0)
    })

    test('should reset remaining when window expires', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 5,
        windowMs: 2000,
      })

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest()
      }
      expect(limiter.getRemaining()).toBe(0)

      currentTime += 2001
      expect(limiter.getRemaining()).toBe(5)
    })
  })

  describe('getResetTime', () => {
    test('should return time until window reset', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 10,
        windowMs: 5000,
      })

      expect(limiter.getResetTime()).toBe(5000)

      currentTime += 1000
      expect(limiter.getResetTime()).toBe(4000)

      currentTime += 2000
      expect(limiter.getResetTime()).toBe(2000)

      currentTime += 2000
      expect(limiter.getResetTime()).toBe(0)

      currentTime += 1
      limiter.checkLimit() // Trigger window check to reset
      expect(limiter.getResetTime()).toBe(5000) // New window
    })

    test('should not return negative reset time', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 10,
        windowMs: 1000,
      })

      currentTime += 2000 // Well past window
      expect(limiter.getResetTime()).toBeGreaterThanOrEqual(0)
    })
  })

  describe('reset', () => {
    test('should reset counter and window', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 5,
        windowMs: 1000,
      })

      limiter.recordRequest()
      limiter.recordRequest()
      limiter.recordRequest()
      expect(limiter.getRemaining()).toBe(2)

      limiter.reset()
      expect(limiter.getRemaining()).toBe(5)
      expect(limiter.getResetTime()).toBe(1000)
    })

    test('should start new window from current time', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 5,
        windowMs: 1000,
      })

      currentTime += 500
      limiter.reset()

      const resetTime = limiter.getResetTime()
      expect(resetTime).toBe(1000)

      currentTime += 500
      expect(limiter.getResetTime()).toBe(500)
    })
  })

  describe('getStatus', () => {
    test('should return complete status information', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 10,
        windowMs: 5000,
      })

      let status = limiter.getStatus()
      expect(status).toEqual({
        allowed: true,
        remaining: 10,
        resetTime: 5000,
        limit: 10,
        windowMs: 5000,
      })

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest()
      }

      currentTime += 2000
      status = limiter.getStatus()
      expect(status).toEqual({
        allowed: true,
        remaining: 5,
        resetTime: 3000,
        limit: 10,
        windowMs: 5000,
      })

      for (let i = 0; i < 5; i++) {
        limiter.recordRequest()
      }

      status = limiter.getStatus()
      expect(status).toEqual({
        allowed: false,
        remaining: 0,
        resetTime: 3000,
        limit: 10,
        windowMs: 5000,
      })
    })

    test('should auto-reset window in status check', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 3,
        windowMs: 1000,
      })

      for (let i = 0; i < 3; i++) {
        limiter.recordRequest()
      }

      let status = limiter.getStatus()
      expect(status.allowed).toBe(false)
      expect(status.remaining).toBe(0)

      currentTime += 1001
      status = limiter.getStatus()
      expect(status.allowed).toBe(true)
      expect(status.remaining).toBe(3)
      expect(status.resetTime).toBe(1000)
    })
  })

  describe('concurrent requests', () => {
    test('should handle rapid concurrent requests', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 100,
        windowMs: 1000,
      })

      // Simulate rapid requests
      for (let i = 0; i < 100; i++) {
        expect(limiter.checkLimit()).toBe(true)
        limiter.recordRequest()
      }

      expect(limiter.checkLimit()).toBe(false)
      expect(limiter.getRemaining()).toBe(0)
    })

    test('should maintain consistency across operations', () => {
      const limiter = new SlidingWindowRateLimiter({
        limit: 50,
        windowMs: 1000,
      })

      for (let i = 0; i < 25; i++) {
        limiter.recordRequest()
      }

      const status1 = limiter.getStatus()
      const remaining1 = limiter.getRemaining()
      const resetTime1 = limiter.getResetTime()

      expect(status1.remaining).toBe(remaining1)
      expect(status1.resetTime).toBe(resetTime1)
      expect(status1.remaining).toBe(25)

      for (let i = 0; i < 25; i++) {
        limiter.recordRequest()
      }

      const status2 = limiter.getStatus()
      expect(status2.allowed).toBe(false)
      expect(status2.remaining).toBe(0)
    })
  })
})

describe('createLodgifyRateLimiter', () => {
  test('should create rate limiter with Lodgify defaults', () => {
    const limiter = createLodgifyRateLimiter()

    // Should allow 60 requests
    for (let i = 0; i < 60; i++) {
      expect(limiter.checkLimit()).toBe(true)
      limiter.recordRequest()
    }

    // 61st request should be blocked
    expect(limiter.checkLimit()).toBe(false)
  })

  test('should use 60 second window', () => {
    const originalDateNow = Date.now
    let currentTime = 1000000
    Date.now = () => currentTime

    const limiter = createLodgifyRateLimiter()

    // Use up limit
    for (let i = 0; i < 60; i++) {
      limiter.recordRequest()
    }
    expect(limiter.checkLimit()).toBe(false)

    // Should not reset before 60 seconds
    currentTime += 59999
    expect(limiter.checkLimit()).toBe(false)

    // Should reset after 60 seconds
    currentTime += 2
    expect(limiter.checkLimit()).toBe(true)

    Date.now = originalDateNow
  })
})
