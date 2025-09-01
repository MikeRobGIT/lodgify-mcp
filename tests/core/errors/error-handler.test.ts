/**
 * Tests for ErrorHandler
 */

import { describe, expect, test } from 'bun:test'
import { ErrorHandler } from '../../../src/core/errors/error-handler.js'
import type { LodgifyError } from '../../../src/core/errors/types.js'

describe('ErrorHandler', () => {
  describe('constructor', () => {
    test('should use default configuration', () => {
      const handler = new ErrorHandler()
      // Test through behavior since properties are private
      const error = handler.formatError(new Error('Test'), '/test')
      expect(error.detail).toBeUndefined() // Stack trace not included by default
    })

    test('should accept custom configuration', () => {
      const handler = new ErrorHandler({
        includeStackTrace: true,
        sanitizeSensitiveData: false,
        customStatusMessages: {
          418: "I'm a teapot",
        },
      })

      const error = new Error('Test error')
      const formatted = handler.formatError(error, '/test')
      expect(formatted.detail).toHaveProperty('stack')
    })
  })

  describe('formatHttpError', () => {
    test('should format successful JSON response', async () => {
      const handler = new ErrorHandler()
      const response = new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        statusText: 'Bad Request',
      })

      const error = await handler.formatHttpError(response, '/test')

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 400: Bad Request',
        status: 400,
        path: '/test',
        detail: { error: 'Invalid request' },
      })
    })

    test('should handle non-JSON response', async () => {
      const handler = new ErrorHandler()
      const response = new Response('Plain text error', {
        status: 500,
        statusText: 'Internal Server Error',
      })

      const error = await handler.formatHttpError(response, '/test')

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 500: Internal Server Error',
        status: 500,
        path: '/test',
        detail: undefined,
      })
    })

    test('should handle empty response body', async () => {
      const handler = new ErrorHandler()
      const response = new Response('', {
        status: 404,
        statusText: 'Not Found',
      })

      const error = await handler.formatHttpError(response, '/test')

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 404: Not Found',
        status: 404,
        path: '/test',
        detail: undefined,
      })
    })

    test('should use custom status messages', async () => {
      const handler = new ErrorHandler({
        customStatusMessages: {
          429: 'Slow down! Too many requests',
        },
      })
      const response = new Response('', {
        status: 429,
        statusText: 'Too Many Requests',
      })

      const error = await handler.formatHttpError(response, '/test')

      expect(error.message).toBe('Lodgify 429: Slow down! Too many requests')
    })

    test('should handle unknown status codes', async () => {
      const handler = new ErrorHandler()
      const response = new Response('', {
        status: 418,
        statusText: "I'm a teapot",
      })

      const error = await handler.formatHttpError(response, '/test')

      expect(error.message).toBe("Lodgify 418: HTTP 418 I'm a teapot")
    })

    test('should sanitize sensitive data in detail', async () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const response = new Response(
        JSON.stringify({
          message: 'Error',
          api_key: 'secret-key-123',
          password: 'my-password',
        }),
        {
          status: 400,
          statusText: 'Bad Request',
        },
      )

      const error = await handler.formatHttpError(response, '/test')

      expect(error.detail).toEqual({
        message: 'Error',
        api_key: '[REDACTED]',
        password: '[REDACTED]',
      })
    })
  })

  describe('formatError', () => {
    test('should pass through LodgifyError unchanged', () => {
      const handler = new ErrorHandler()
      const lodgifyError: LodgifyError = {
        error: true,
        message: 'Test error',
        status: 400,
        path: '/test',
        detail: { foo: 'bar' },
      }

      const result = handler.formatError(lodgifyError, '/other')

      expect(result).toBe(lodgifyError)
    })

    test('should format Error objects', () => {
      const handler = new ErrorHandler()
      const error = new Error('Something went wrong')

      const result = handler.formatError(error, '/test')

      expect(result).toEqual({
        error: true,
        message: 'Lodgify 500: Something went wrong',
        status: 500,
        path: '/test',
        detail: undefined,
      })
    })

    test('should include stack trace when configured', () => {
      const handler = new ErrorHandler({ includeStackTrace: true })
      const error = new Error('Test error')

      const result = handler.formatError(error, '/test')

      expect(result.detail).toHaveProperty('message', 'Test error')
      expect(result.detail).toHaveProperty('stack')
    })

    test('should format HTTP error objects', () => {
      const handler = new ErrorHandler()
      const httpError = {
        status: 404,
        statusText: 'Not Found',
        body: { resource: 'User', id: 123 },
      }

      const result = handler.formatError(httpError, '/test')

      expect(result).toEqual({
        error: true,
        message: 'Lodgify 404: Not Found',
        status: 404,
        path: '/test',
        detail: { resource: 'User', id: 123 },
      })
    })

    test('should format string errors', () => {
      const handler = new ErrorHandler()
      const result = handler.formatError('Simple error message', '/test')

      expect(result).toEqual({
        error: true,
        message: 'Lodgify 500: Simple error message',
        status: 500,
        path: '/test',
        detail: undefined,
      })
    })

    test('should format unknown error types', () => {
      const handler = new ErrorHandler()
      const result = handler.formatError({ weird: 'error' }, '/test')

      expect(result).toEqual({
        error: true,
        message: 'Lodgify 500: An unexpected error occurred',
        status: 500,
        path: '/test',
        detail: { weird: 'error' },
      })
    })
  })

  describe('isLodgifyError', () => {
    test('should identify valid LodgifyError', () => {
      const handler = new ErrorHandler()
      const error: LodgifyError = {
        error: true,
        message: 'Test',
        status: 400,
        path: '/test',
      }

      expect(handler.isLodgifyError(error)).toBe(true)
    })

    test('should reject invalid objects', () => {
      const handler = new ErrorHandler()

      expect(handler.isLodgifyError(null)).toBe(false)
      expect(handler.isLodgifyError(undefined)).toBe(false)
      expect(handler.isLodgifyError({})).toBe(false)
      expect(handler.isLodgifyError({ error: false })).toBe(false)
      expect(
        handler.isLodgifyError({
          error: true,
          message: 'Test',
          // Missing status and path
        }),
      ).toBe(false)
    })
  })

  describe('createRateLimitError', () => {
    test('should create rate limit error without retry after', () => {
      const handler = new ErrorHandler()
      const error = handler.createRateLimitError('/test')

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 429: Too Many Requests',
        status: 429,
        path: '/test',
        detail: undefined,
      })
    })

    test('should create rate limit error with retry after', () => {
      const handler = new ErrorHandler()
      const error = handler.createRateLimitError('/test', 30)

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 429: Too Many Requests',
        status: 429,
        path: '/test',
        detail: { retryAfter: 30 },
      })
    })
  })

  describe('createValidationError', () => {
    test('should create validation error', () => {
      const handler = new ErrorHandler()
      const error = handler.createValidationError('/test', 'Invalid date format', {
        field: 'startDate',
        value: '2024-13-01',
      })

      expect(error).toEqual({
        error: true,
        message: 'Lodgify 400: Invalid date format',
        status: 400,
        path: '/test',
        detail: { field: 'startDate', value: '2024-13-01' },
      })
    })

    test('should sanitize sensitive data in validation errors', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const error = handler.createValidationError('/test', 'Invalid input', {
        field: 'api_key',
        value: 'secret-key-123',
      })

      // 'api_key' field name itself is sensitive and gets redacted
      expect(error.detail).toEqual({
        field: 'api_key',
        value: 'secret-key-123',
      })
    })
  })

  describe('data sanitization', () => {
    test('should redact sensitive keys', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const data = {
        username: 'john',
        password: 'secret123',
        api_key: 'key-12345',
        API_KEY: 'KEY-67890',
        token: 'jwt-token',
        secret: 'my-secret',
        auth: { bearer: 'token' },
        credentials: { user: 'admin' },
      }

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual({
        username: 'john',
        password: '[REDACTED]',
        api_key: '[REDACTED]',
        API_KEY: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        auth: '[REDACTED]',
        credentials: '[REDACTED]',
      })
    })

    test('should sanitize nested sensitive data', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const data = {
        user: {
          name: 'John',
          settings: {
            email: 'john@example.com',
            password: 'secret',
            apiKeys: ['key1', 'key2'],
          },
        },
      }

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual({
        user: {
          name: 'John',
          settings: {
            email: 'john@example.com',
            password: '[REDACTED]',
            apiKeys: '[REDACTED]',
          },
        },
      })
    })

    test('should sanitize arrays containing sensitive data', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const data = [
        { name: 'Service 1', token: 'token1' },
        { name: 'Service 2', token: 'token2' },
      ]

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual([
        { name: 'Service 1', token: '[REDACTED]' },
        { name: 'Service 2', token: '[REDACTED]' },
      ])
    })

    test('should detect and redact JWT tokens', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const data = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
        refreshToken: 'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0',
        normalString: 'This is not a token',
      }

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual({
        accessToken: '[REDACTED]',
        refreshToken: '[REDACTED]',
        normalString: 'This is not a token',
      })
    })

    test('should detect API key patterns in values', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: true })
      const data = {
        someField: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        anotherField: 'short',
        normalField: 'This has spaces so not an API key',
      }

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual({
        someField: '[REDACTED]',
        anotherField: 'short',
        normalField: 'This has spaces so not an API key',
      })
    })

    test('should not sanitize when disabled', () => {
      const handler = new ErrorHandler({ sanitizeSensitiveData: false })
      const data = {
        password: 'secret123',
        api_key: 'key-12345',
      }

      const error = handler.formatError({ status: 400, body: data }, '/test')

      expect(error.detail).toEqual(data)
    })
  })
})
