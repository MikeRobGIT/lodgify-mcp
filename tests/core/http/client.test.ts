/**
 * Tests for BaseHttpClient
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { BaseHttpClient } from '../../../src/core/http/client.js'
import type { HttpClientConfig, Logger, RequestOptions } from '../../../src/core/http/types.js'

// Create a concrete implementation for testing
class TestHttpClient extends BaseHttpClient {
  async request<T = unknown>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const response = await this.makeRequest<T>(method, path, options)
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.data
  }

  // Expose protected methods for testing
  public testFlattenParams(params: Record<string, unknown>, prefix = ''): Record<string, string> {
    return this.flattenParams(params, prefix)
  }

  public testBuildUrl(path: string, params?: Record<string, unknown>): string {
    return this.buildUrl(path, params)
  }

  public testSanitizeLogData(data: unknown): unknown {
    return this.sanitizeLogData(data)
  }
}

describe('BaseHttpClient', () => {
  let client: TestHttpClient
  let mockLogger: Logger
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    mockLogger = {
      error: mock(() => {}),
      warn: mock(() => {}),
      info: mock(() => {}),
      debug: mock(() => {}),
    }

    const config: HttpClientConfig = {
      baseUrl: 'https://api.example.com',
      defaultHeaders: {
        'X-API-Key': 'test-key',
      },
      logLevel: 'debug',
    }

    client = new TestHttpClient(config, mockLogger)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('flattenParams', () => {
    test('should handle simple parameters', () => {
      const params = {
        name: 'John',
        age: 30,
      }
      const result = client.testFlattenParams(params)
      expect(result).toEqual({
        name: 'John',
        age: '30',
      })
    })

    test('should handle nested objects', () => {
      const params = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      }
      const result = client.testFlattenParams(params)
      expect(result).toEqual({
        'user[name]': 'John',
        'user[email]': 'john@example.com',
      })
    })

    test('should handle arrays', () => {
      const params = {
        tags: ['javascript', 'typescript'],
      }
      const result = client.testFlattenParams(params)
      expect(result).toEqual({
        'tags[0]': 'javascript',
        'tags[1]': 'typescript',
      })
    })

    test('should handle complex nested structures', () => {
      const params = {
        roomTypes: [
          { id: 123, name: 'Deluxe' },
          { id: 456, name: 'Suite' },
        ],
        guest_breakdown: {
          adults: 2,
          children: 1,
        },
      }
      const result = client.testFlattenParams(params)
      expect(result).toEqual({
        'roomTypes[0][id]': '123',
        'roomTypes[0][name]': 'Deluxe',
        'roomTypes[1][id]': '456',
        'roomTypes[1][name]': 'Suite',
        'guest_breakdown[adults]': '2',
        'guest_breakdown[children]': '1',
      })
    })

    test('should skip null and undefined values', () => {
      const params = {
        name: 'John',
        age: null,
        email: undefined,
        active: true,
      }
      const result = client.testFlattenParams(params)
      expect(result).toEqual({
        name: 'John',
        active: 'true',
      })
    })
  })

  describe('buildUrl', () => {
    test('should build URL without parameters', () => {
      const url = client.testBuildUrl('/users')
      expect(url).toBe('https://api.example.com/users')
    })

    test('should build URL with simple parameters', () => {
      const url = client.testBuildUrl('/users', { page: 1, limit: 10 })
      expect(url).toBe('https://api.example.com/users?page=1&limit=10')
    })

    test('should build URL with complex parameters', () => {
      const url = client.testBuildUrl('/bookings', {
        'roomTypes[0].Id': 123,
        'guest_breakdown[adults]': 2,
      })
      expect(url).toContain('https://api.example.com/bookings?')
      expect(url).toContain('roomTypes%5B0%5D.Id=123')
      expect(url).toContain('guest_breakdown%5Badults%5D=2')
    })
  })

  describe('sanitizeLogData', () => {
    test('should redact sensitive keys', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        api_key: 'key-12345',
        token: 'jwt-token',
        secret: 'my-secret',
      }
      const result = client.testSanitizeLogData(data)
      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        api_key: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
      })
    })

    test('should handle nested sensitive data', () => {
      const data = {
        user: {
          name: 'John',
          auth: {
            password: 'secret',
            apiKey: 'key123',
          },
        },
      }
      const result = client.testSanitizeLogData(data)
      expect(result).toEqual({
        user: {
          name: 'John',
          auth: '[REDACTED]',
        },
      })
    })

    test('should handle arrays', () => {
      const data = [
        { name: 'John', password: 'secret1' },
        { name: 'Jane', password: 'secret2' },
      ]
      const result = client.testSanitizeLogData(data)
      expect(result).toEqual([
        { name: 'John', password: '[REDACTED]' },
        { name: 'Jane', password: '[REDACTED]' },
      ])
    })

    test('should handle non-object values', () => {
      expect(client.testSanitizeLogData('string')).toBe('string')
      expect(client.testSanitizeLogData(123)).toBe(123)
      expect(client.testSanitizeLogData(true)).toBe(true)
      expect(client.testSanitizeLogData(null)).toBe(null)
    })
  })

  describe('makeRequest', () => {
    test('should make successful JSON request', async () => {
      const mockResponse = {
        id: 1,
        name: 'Test Property',
      }

      global.fetch = mock(async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        })
      })

      const result = await client.request('GET', '/properties/1')
      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/properties/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
          }),
        }),
      )
    })

    test('should handle non-JSON responses', async () => {
      global.fetch = mock(async () => {
        return new Response('Plain text response', {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'text/plain',
          },
        })
      })

      const result = await client.request('GET', '/health')
      expect(result).toBe('Plain text response')
    })

    test('should include request body when provided', async () => {
      const requestBody = { name: 'New Property' }

      global.fetch = mock(async () => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        })
      })

      await client.request('POST', '/properties', { body: requestBody })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/properties',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        }),
      )
    })

    test('should add query parameters to URL', async () => {
      global.fetch = mock(async () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
        })
      })

      await client.request('GET', '/properties', {
        params: { page: 1, limit: 10 },
      })

      const calledUrl = (global.fetch as unknown as { mock: { calls: string[][] } }).mock
        .calls[0][0]
      expect(calledUrl).toContain('page=1')
      expect(calledUrl).toContain('limit=10')
    })

    test('should merge custom headers with default headers', async () => {
      global.fetch = mock(async () => {
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      await client.request('GET', '/test', {
        headers: { 'X-Custom-Header': 'custom-value' },
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key',
            'X-Custom-Header': 'custom-value',
          }),
        }),
      )
    })
  })

  describe('logging', () => {
    test('should log debug messages when DEBUG_HTTP is set', async () => {
      process.env.DEBUG_HTTP = '1'

      global.fetch = mock(async () => {
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      await client.request('GET', '/test')

      // Check that debug was called at least twice
      expect(mockLogger.debug).toHaveBeenCalledTimes(2)

      // Get the actual calls to check what was logged
      const calls = (mockLogger.debug as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls[0][0]).toBe('HTTP Request: GET /test')
      expect(calls[1][0]).toBe('HTTP Response: 200 ')

      delete process.env.DEBUG_HTTP
    })

    test('should not log debug messages when DEBUG_HTTP is not set', async () => {
      delete process.env.DEBUG_HTTP

      global.fetch = mock(async () => {
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      await client.request('GET', '/test')

      expect(mockLogger.debug).not.toHaveBeenCalled()
    })
  })
})
