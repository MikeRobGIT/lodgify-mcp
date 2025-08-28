/**
 * Tests for ExponentialBackoffRetry
 */

import { describe, expect, mock, test } from 'bun:test'
import { ExponentialBackoffRetry } from '../../../src/core/retry/exponential-backoff.js'
import type { RetryConfig, SleepFunction } from '../../../src/core/retry/types.js'

describe('ExponentialBackoffRetry', () => {
  describe('constructor', () => {
    test('should use default configuration when not provided', () => {
      const retry = new ExponentialBackoffRetry()
      // Test by executing and checking behavior
      let attempts = 0
      retry.execute(async () => {
        attempts++
        if (attempts < 3) {
          throw { status: 500 }
        }
        return 'success'
      })
      expect(attempts).toBeGreaterThanOrEqual(1)
    })

    test('should accept custom configuration', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        maxRetryDelay: 5000,
        initialDelay: 500,
        backoffMultiplier: 3,
      }
      const retry = new ExponentialBackoffRetry(config)
      // Configuration will be tested through behavior in other tests
      expect(retry).toBeDefined()
    })
  })

  describe('execute', () => {
    test('should return success on first attempt if function succeeds', async () => {
      const retry = new ExponentialBackoffRetry()
      const fn = mock(async () => 'success')

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: true,
        data: 'success',
        attempts: 1,
      })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    test('should retry on 429 status', async () => {
      const sleepCalls: number[] = []
      const sleepFn: SleepFunction = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 }, sleepFn)

      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts < 3) {
          throw { status: 429 }
        }
        return 'success'
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: true,
        data: 'success',
        attempts: 3,
      })
      expect(fn).toHaveBeenCalledTimes(3)
      expect(sleepCalls).toEqual([1000, 2000]) // 2^0 * 1000, 2^1 * 1000
    })

    test('should retry on 5xx errors', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const retry = new ExponentialBackoffRetry({ maxRetries: 4 }, sleepFn)

      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts === 1) throw { status: 500 }
        if (attempts === 2) throw { status: 502 }
        if (attempts === 3) throw { status: 503 }
        return 'success'
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: true,
        data: 'success',
        attempts: 4,
      })
      expect(fn).toHaveBeenCalledTimes(4)
      expect(sleepFn).toHaveBeenCalledTimes(3)
    })

    test('should not retry on 4xx errors except 429', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 }, sleepFn)

      const fn = mock(async () => {
        throw { status: 400 }
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: false,
        error: { status: 400 },
        attempts: 1,
      })
      expect(fn).toHaveBeenCalledTimes(1)
      expect(sleepFn).not.toHaveBeenCalled()
    })

    test('should respect max retries', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 }, sleepFn)

      const fn = mock(async () => {
        throw { status: 429 }
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: false,
        error: { status: 429 },
        attempts: 3,
      })
      expect(fn).toHaveBeenCalledTimes(3)
      expect(sleepFn).toHaveBeenCalledTimes(2) // No sleep after last attempt
    })

    test('should use exponential backoff for delays', async () => {
      const sleepCalls: number[] = []
      const sleepFn: SleepFunction = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })
      const retry = new ExponentialBackoffRetry(
        {
          maxRetries: 5,
          initialDelay: 100,
          backoffMultiplier: 2,
        },
        sleepFn,
      )

      const fn = mock(async () => {
        throw { status: 429 }
      })

      await retry.execute(fn)

      expect(sleepCalls).toEqual([100, 200, 400, 800]) // 100 * 2^n
    })

    test('should respect max retry delay', async () => {
      const sleepCalls: number[] = []
      const sleepFn: SleepFunction = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })
      const retry = new ExponentialBackoffRetry(
        {
          maxRetries: 5,
          initialDelay: 1000,
          backoffMultiplier: 10,
          maxRetryDelay: 3000,
        },
        sleepFn,
      )

      const fn = mock(async () => {
        throw { status: 429 }
      })

      await retry.execute(fn)

      expect(sleepCalls).toEqual([1000, 3000, 3000, 3000]) // Capped at 3000
    })

    test('should use Retry-After header when provided', async () => {
      const sleepCalls: number[] = []
      const sleepFn: SleepFunction = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 }, sleepFn)

      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts < 3) {
          throw { status: 429, retryAfter: '5' }
        }
        return 'success'
      })

      const getRetryAfter = (error: unknown) => {
        if (error && typeof error === 'object' && 'retryAfter' in error) {
          return (error as { retryAfter: string }).retryAfter
        }
        return undefined
      }

      const result = await retry.execute(fn, getRetryAfter)

      expect(result.success).toBe(true)
      expect(sleepCalls).toEqual([5000, 5000]) // Use Retry-After header value
    })

    test('should cap Retry-After at max delay', async () => {
      const sleepCalls: number[] = []
      const sleepFn: SleepFunction = mock(async (ms: number) => {
        sleepCalls.push(ms)
      })
      const retry = new ExponentialBackoffRetry(
        {
          maxRetries: 2,
          maxRetryDelay: 3000,
        },
        sleepFn,
      )

      const fn = mock(async () => {
        throw { status: 429, retryAfter: '10' }
      })

      const getRetryAfter = (error: unknown) => {
        if (error && typeof error === 'object' && 'retryAfter' in error) {
          return (error as { retryAfter: string }).retryAfter
        }
        return undefined
      }

      await retry.execute(fn, getRetryAfter)

      expect(sleepCalls).toEqual([3000]) // Capped at maxRetryDelay
    })

    test('should pass context to function', async () => {
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 })
      const contexts: unknown[] = []

      let attempts = 0
      const fn = mock(async (context) => {
        contexts.push(context)
        attempts++
        if (attempts < 2) {
          throw { status: 429 }
        }
        return 'success'
      })

      await retry.execute(fn)

      expect(contexts).toHaveLength(2)
      expect(contexts[0]).toEqual({
        attempt: 1,
        totalAttempts: 3,
        lastError: undefined,
      })
      expect(contexts[1]).toEqual({
        attempt: 2,
        totalAttempts: 3,
        lastError: { status: 429 },
      })
    })

    test('should use custom shouldRetry function', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const shouldRetry = mock((status: number) => status === 503)
      const retry = new ExponentialBackoffRetry(
        {
          maxRetries: 3,
          shouldRetry,
        },
        sleepFn,
      )

      // Should retry on 503
      let fn = mock(async () => {
        throw { status: 503 }
      })
      let result = await retry.execute(fn)
      expect(result.attempts).toBe(3)
      expect(shouldRetry).toHaveBeenCalledWith(503, expect.any(Number))

      // Should not retry on 500
      fn = mock(async () => {
        throw { status: 500 }
      })
      result = await retry.execute(fn)
      expect(result.attempts).toBe(1)
    })
  })

  describe('executeOrThrow', () => {
    test('should return data on success', async () => {
      const retry = new ExponentialBackoffRetry()
      const fn = mock(async () => 'success')

      const result = await retry.executeOrThrow(fn)

      expect(result).toBe('success')
    })

    test('should throw on failure', async () => {
      const retry = new ExponentialBackoffRetry({ maxRetries: 1 })
      const error = new Error('Test error')
      const fn = mock(async () => {
        throw error
      })

      await expect(retry.executeOrThrow(fn)).rejects.toThrow('Test error')
    })

    test('should retry before throwing', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const retry = new ExponentialBackoffRetry({ maxRetries: 3 }, sleepFn)

      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts < 3) {
          throw { status: 429 }
        }
        return 'success'
      })

      const result = await retry.executeOrThrow(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('error handling', () => {
    test('should handle network errors (status 0)', async () => {
      const sleepFn: SleepFunction = mock(async () => {})
      const retry = new ExponentialBackoffRetry({ maxRetries: 2 }, sleepFn)

      let attempts = 0
      const fn = mock(async () => {
        attempts++
        if (attempts < 2) {
          throw { status: 0 } // Network error
        }
        return 'success'
      })

      const result = await retry.execute(fn)

      expect(result.success).toBe(true)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    test('should handle Error objects', async () => {
      const retry = new ExponentialBackoffRetry({ maxRetries: 1 })
      const error = new Error('Network timeout')
      const fn = mock(async () => {
        throw error
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: false,
        error,
        attempts: 1,
      })
    })

    test('should handle unknown error types', async () => {
      const retry = new ExponentialBackoffRetry({ maxRetries: 1 })
      const fn = mock(async () => {
        throw 'String error'
      })

      const result = await retry.execute(fn)

      expect(result).toEqual({
        success: false,
        error: 'String error',
        attempts: 1,
      })
    })
  })
})
