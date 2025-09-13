/**
 * Test setup and utilities for authentication tests
 */

import { afterAll, beforeAll } from 'bun:test'

// Mock environment variables for testing
export const TEST_ENV = {
  PORT: '3333',
  AUTH_MODE: 'dual',
  AUTH_BEARER_TOKEN: 'test-bearer-token-1234567890abcdefghijklmnop',
  OAUTH_PROVIDER: 'google',
  OAUTH_CLIENT_ID: 'test-client-id',
  OAUTH_CLIENT_SECRET: 'test-client-secret',
  OAUTH_SCOPES: 'openid profile email',
  SESSION_SECRET: 'test-session-secret-1234567890abcdefghijklmnop',
  BASE_URL: 'http://localhost:3333',
  LOG_LEVEL: 'error', // Reduce noise in tests
  NODE_ENV: 'test',
}

// Setup global test environment
beforeAll(() => {
  // Store original env
  global.__originalEnv = { ...process.env }

  // Apply test env
  Object.assign(process.env, TEST_ENV)
})

afterAll(() => {
  // Restore original env
  if (global.__originalEnv) {
    process.env = global.__originalEnv
  }
})

// Test utilities
export async function waitForServer(port: number, maxAttempts = 20): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`)
      if (response.ok) {
        return true
      }
    } catch (_e) {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

interface MockResponseData {
  ok?: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  json?: unknown
}

export function mockFetch(responses: Map<string, unknown>) {
  return async (url: string, options?: RequestInit) => {
    const key = `${options?.method || 'GET'} ${url}`
    const responseData = responses.get(key) as MockResponseData | undefined

    if (!responseData) {
      throw new Error(`No mock response for ${key}`)
    }

    return {
      ok: responseData.ok !== false,
      status: responseData.status || 200,
      statusText: responseData.statusText || 'OK',
      headers: new Headers(responseData.headers || {}),
      json: async () => responseData.json || responseData,
      text: async () => JSON.stringify(responseData.json || responseData),
    }
  }
}

export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: new Headers(),
    body: null,
    method: 'GET',
    url: '/',
    ...overrides,
  } as Partial<Request>
}

interface MockResponse {
  _json?: unknown
  _data?: unknown
  statusCode: number
  headers: Record<string, string>
  json: (data: unknown) => Promise<unknown>
  status: (code: number) => MockResponse
  setHeader: (name: string, value: string) => MockResponse
  send: (data: unknown) => MockResponse
  redirect: (url: string) => MockResponse
}

export function createMockResponse(): MockResponse {
  const res = {} as MockResponse
  res.statusCode = 200
  res.headers = {}

  res.json = (data: unknown): Promise<unknown> => {
    res._json = data
    return Promise.resolve(data)
  }

  res.status = (code: number): MockResponse => {
    res.statusCode = code
    return res
  }

  res.setHeader = (name: string, value: string): MockResponse => {
    res.headers[name] = value
    return res
  }

  res.send = (data: unknown): MockResponse => {
    res._data = data
    return res
  }

  res.redirect = (url: string): MockResponse => {
    res.statusCode = 302
    res.headers.location = url
    return res
  }

  return res
}

declare global {
  var __originalEnv: NodeJS.ProcessEnv
}
