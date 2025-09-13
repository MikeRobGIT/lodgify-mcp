/**
 * Performance tests for rate limiting
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { NextFunction, Request, Response } from 'express'
import {
  cleanupRateLimiter,
  createRateLimiter,
  type RateLimitConfig,
} from '../../security/rate-limiter.js'

describe('Rate Limiting Performance', () => {
  let middleware: ReturnType<typeof createRateLimiter>
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    // Create rate limiter middleware
    const config: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
    }
    middleware = createRateLimiter(config)

    // Mock request
    mockReq = {
      ip: '127.0.0.1',
      get: mock((header: string) => {
        if (header === 'x-forwarded-for') return null
        if (header === 'x-real-ip') return null
        return null
      }),
    }

    // Mock response
    mockRes = {
      status: mock(() => mockRes),
      json: mock(() => mockRes),
      setHeader: mock(),
    }

    // Mock next function
    mockNext = mock()

    // Clean up before each test
    cleanupRateLimiter()
  })

  afterEach(() => {
    // Clean up
    cleanupRateLimiter()
  })

  describe('Request Rate Control', () => {
    it('should allow requests within limit', async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext)
      }

      // All requests should be allowed
      expect(mockNext).toHaveBeenCalledTimes(10)
      expect(mockRes.status).not.toHaveBeenCalled()
    })

    it('should block requests exceeding limit', async () => {
      // Make 10 allowed requests
      for (let i = 0; i < 10; i++) {
        await middleware(mockReq as Request, mockRes as Response, mockNext)
      }

      // Reset mocks
      mockNext.mockClear()
      ;(mockRes.status as ReturnType<typeof mock>).mockClear()

      // 11th request should be blocked
      await middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(429)
    })

    it('should track different clients separately', async () => {
      const req1 = { ...mockReq, ip: '127.0.0.1' }
      const req2 = { ...mockReq, ip: '127.0.0.2' }

      // Client 1 makes 10 requests
      for (let i = 0; i < 10; i++) {
        await middleware(req1 as Request, mockRes as Response, mockNext)
      }

      // Client 2 should still be able to make requests
      await middleware(req2 as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(11) // 10 from client1, 1 from client2
    })
  })

  describe('Performance Characteristics', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = performance.now()
      const promises: Promise<void>[] = []

      // Simulate 100 concurrent requests from different IPs
      for (let i = 0; i < 100; i++) {
        const req = { ...mockReq, ip: `127.0.0.${i}` }
        promises.push(middleware(req as Request, mockRes as Response, mockNext))
      }

      await Promise.all(promises)
      const endTime = performance.now()

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100) // 100ms for 100 requests
      expect(mockNext).toHaveBeenCalledTimes(100)
    })

    it('should handle burst traffic gracefully', async () => {
      const promises: Promise<void>[] = []

      // 15 requests from same IP (5 over limit)
      for (let i = 0; i < 15; i++) {
        promises.push(middleware(mockReq as Request, mockRes as Response, mockNext))
      }

      await Promise.all(promises)

      // First 10 should pass, last 5 should be blocked
      expect(mockNext).toHaveBeenCalledTimes(10)
      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.status).toHaveBeenCalledTimes(5)
    })
  })

  describe('Header Management', () => {
    it('should set rate limit headers', async () => {
      await middleware(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should update remaining count in headers', async () => {
      // First request
      await middleware(mockReq as Request, mockRes as Response, mockNext)
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')

      // Clear mocks
      ;(mockRes.setHeader as ReturnType<typeof mock>).mockClear()

      // Second request
      await middleware(mockReq as Request, mockRes as Response, mockNext)
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '8')
    })
  })
})
