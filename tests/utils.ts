import { mock } from 'bun:test'
import type { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js'

/**
 * Create a mock Response object
 */
export function createMockResponse(
  status: number,
  data: unknown = {},
  headers: Record<string, string> = {},
): Response {
  const mockHeaders = new Headers({
    'content-type': 'application/json',
    ...headers,
  })

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: getStatusText(status),
    headers: mockHeaders,
    json: mock(() => Promise.resolve(data)),
    text: mock(() => Promise.resolve(JSON.stringify(data))),
    blob: mock(() => Promise.resolve(new Blob())),
    arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(0))),
    formData: mock(() => Promise.resolve(new FormData())),
    clone: mock(() => createMockResponse(status, data, headers)),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
  } as Response
}

/**
 * Create a mock fetch function with predefined responses
 */
export function createMockFetch(responses: Response[]) {
  let callIndex = 0
  return mock(async () => {
    if (callIndex < responses.length) {
      const response = responses[callIndex]
      callIndex++
      return Promise.resolve(response)
    }
    throw new Error('No more mock responses available')
  })
}

/**
 * Get status text for common HTTP status codes
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  }
  return statusTexts[status] || 'Unknown'
}

/**
 * Create test fixtures for common Lodgify API responses
 */
export const fixtures = {
  property: {
    id: 'prop-123',
    name: 'Test Property',
    address: '123 Test St',
    city: 'Test City',
    country: 'US',
    rooms: [],
  },

  booking: {
    id: 'book-456',
    propertyId: 'prop-123',
    checkIn: '2025-11-20',
    checkOut: '2025-11-25',
    guest: {
      name: 'Test Guest',
      email: 'guest@test.com',
    },
    totalAmount: 1000,
    currency: 'USD',
  },

  availability: {
    propertyId: 'prop-123',
    available: true,
    dates: [
      { date: '2025-11-20', available: true, price: 200 },
      { date: '2025-11-21', available: true, price: 200 },
      { date: '2025-11-22', available: true, price: 200 },
      { date: '2025-11-23', available: true, price: 200 },
      { date: '2025-11-24', available: true, price: 200 },
    ],
  },

  quote: {
    propertyId: 'prop-123',
    from: '2025-11-20',
    to: '2025-11-25',
    totalAmount: 1000,
    breakdown: {
      nights: 5,
      pricePerNight: 200,
      cleaningFee: 0,
      serviceFee: 0,
    },
  },

  thread: {
    guid: '550e8400-e29b-41d4-a716-446655440000',
    messages: [
      {
        id: 'msg-1',
        from: 'guest@test.com',
        to: 'host@test.com',
        message: 'Is the property available?',
        timestamp: '2025-11-01T10:00:00Z',
      },
    ],
  },

  // v1 API fixtures
  webhook: {
    id: 'webhook_123',
    event: 'booking_new_status_booked',
    target_url: 'https://example.com/webhook',
    status: 'active',
    created_at: '2024-01-15T10:00:00Z',
    last_triggered_at: '2024-03-20T14:30:00Z',
  },

  webhookList: {
    data: [
      {
        id: 'webhook_123',
        event: 'booking_new_status_booked',
        target_url: 'https://example.com/webhook',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
        last_triggered_at: '2024-03-20T14:30:00Z',
      },
      {
        id: 'webhook_456',
        event: 'booking_change',
        target_url: 'https://example.com/webhook2',
        status: 'active',
        created_at: '2024-02-01T10:00:00Z',
      },
    ],
    total: 2,
  },

  createBookingRequest: {
    property_id: 123,
    room_type_id: 456,
    arrival: '2024-06-15',
    departure: '2024-06-20',
    guest_name: 'John Smith',
    guest_email: 'john@example.com',
    guest_phone: '+1234567890',
    adults: 2,
    children: 0,
    status: 'booked',
    notes: 'Late arrival expected',
    source: 'Direct Website',
  },

  createBookingResponse: {
    id: 'booking_789',
    property_id: 123,
    room_type_id: 456,
    arrival: '2024-06-15',
    departure: '2024-06-20',
    guest_name: 'John Smith',
    guest_email: 'john@example.com',
    guest_phone: '+1234567890',
    adults: 2,
    children: 0,
    status: 'booked',
    notes: 'Late arrival expected',
    source: 'Direct Website',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },

  updateBookingRequest: {
    arrival: '2024-06-16',
    departure: '2024-06-21',
    adults: 3,
    status: 'tentative',
    notes: 'Room upgrade requested',
  },

  rateUpdateRequest: {
    property_id: 123,
    rates: [
      {
        room_type_id: 456,
        date_from: '2024-06-01',
        date_to: '2024-08-31',
        price: 150.0,
        min_stay: 3,
        currency: 'USD',
      },
      {
        room_type_id: 457,
        date_from: '2024-06-01',
        date_to: '2024-08-31',
        price: 200.0,
        min_stay: 2,
        currency: 'USD',
      },
    ],
  },

  // v2 missing endpoints fixtures
  availabilityAll: {
    data: [
      {
        property_id: 123,
        date: '2024-06-15',
        available: true,
        rooms_available: 5,
      },
      {
        property_id: 123,
        date: '2024-06-16',
        available: true,
        rooms_available: 3,
      },
    ],
    total: 2,
  },

  checkedInBooking: {
    id: 'booking_123',
    status: 'checked_in',
    checkin_date: '2024-06-15T15:00:00Z',
    guest_name: 'John Smith',
    property_id: 123,
  },

  checkedOutBooking: {
    id: 'booking_123',
    status: 'checked_out',
    checkout_date: '2024-06-20T11:00:00Z',
    guest_name: 'John Smith',
    property_id: 123,
  },

  externalBookings: {
    data: [
      {
        id: 'ext_booking_456',
        source: 'Booking.com',
        property_id: 123,
        arrival: '2024-06-15',
        departure: '2024-06-20',
        guest_name: 'Jane Doe',
        status: 'confirmed',
        commission: 15.0,
      },
      {
        id: 'ext_booking_789',
        source: 'Airbnb',
        property_id: 123,
        arrival: '2024-07-01',
        departure: '2024-07-05',
        guest_name: 'Bob Johnson',
        status: 'confirmed',
        commission: 12.0,
      },
    ],
    total: 2,
  },
}

/**
 * Helper to create a delay promise for testing retry logic
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock timer utilities for testing retry delays
 * Note: Bun doesn't have built-in fake timers like Vitest,
 * so we'll use a different approach for timer-based tests
 */
export const mockTimers = {
  setup() {
    // Store original setTimeout
    const originalSetTimeout = globalThis.setTimeout
    const timers: Array<{ callback: () => void | Promise<void>; delay: number; time: number }> = []
    let currentTime = 0

    // Mock setTimeout
    globalThis.setTimeout = ((callback: () => void | Promise<void>, delay: number = 0) => {
      timers.push({ callback, delay, time: currentTime + delay })
      return timers.length - 1
    }) as typeof setTimeout

    return {
      advance: async (ms: number) => {
        currentTime += ms
        const toRun = timers.filter((t) => t.time <= currentTime)
        for (const timer of toRun) {
          await timer.callback()
          const index = timers.indexOf(timer)
          if (index > -1) timers.splice(index, 1)
        }
      },
      runAll: async () => {
        while (timers.length > 0) {
          const timer = timers.shift()
          if (timer) {
            currentTime = timer.time
            await timer.callback()
          }
        }
      },
      restore: () => {
        globalThis.setTimeout = originalSetTimeout
      },
    }
  },
}

/**
 * HTTP test utilities for testing the HTTP transport server
 */
export const httpTestUtils = {
  /**
   * Create authentication headers for HTTP requests
   */
  createAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return headers
  },

  /**
   * Create a JSON-RPC request object
   */
  createJSONRPCRequest(
    method: string,
    params: Record<string, unknown> = {},
    id: number | string = 1,
  ): JSONRPCRequest {
    return {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }
  },

  /**
   * Create an initialization request
   */
  createInitRequest(
    protocolVersion: string = '2025-03-26',
    capabilities: Record<string, unknown> = {},
  ): JSONRPCRequest {
    return {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion,
        capabilities,
      },
      id: 1,
    }
  },

  /**
   * Create a tool call request
   */
  createToolCallRequest(
    name: string,
    args: Record<string, unknown> = {},
    id: number | string = 2,
  ): JSONRPCRequest {
    return {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
      id,
    }
  },

  /**
   * Create session headers
   */
  createSessionHeaders(sessionId: string): Record<string, string> {
    return {
      'Mcp-Session-Id': sessionId,
    }
  },

  /**
   * Helper to make HTTP requests in tests
   */
  async makeHTTPRequest(
    url: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: JSONRPCRequest | unknown
    } = {},
  ): Promise<{
    status: number
    body: JSONRPCResponse | string | unknown
    headers: Record<string, string>
  }> {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    let body: JSONRPCResponse | string | unknown
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      body = await response.json()
    } else {
      body = await response.text()
    }

    return {
      status: response.status,
      body,
      headers: responseHeaders,
    }
  },

  /**
   * Create a test HTTP server helper
   */
  async createTestHTTPServer(
    port: number = 0,
    _token?: string,
  ): Promise<{
    url: string
    port: number
    close: () => Promise<void>
  }> {
    // This would be implemented with actual server creation
    // For now, return a mock structure
    const actualPort = port || 3000 + Math.floor(Math.random() * 1000)

    return {
      url: `http://localhost:${actualPort}`,
      port: actualPort,
      close: async () => {
        // Server cleanup
      },
    }
  },

  /**
   * Wait for server to be ready
   */
  async waitForServer(url: string, maxAttempts: number = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${url}/health`)
        if (response.ok) {
          return true
        }
      } catch {
        // Server not ready yet
      }
      await delay(100)
    }
    return false
  },

  /**
   * Create mock StreamableHTTPServerTransport
   */
  createMockTransport(sessionId?: string) {
    return {
      sessionId,
      handleRequest: mock(
        async (_req: unknown, res: { json: (data: JSONRPCResponse) => void }, _body: unknown) => {
          res.json({ jsonrpc: '2.0', result: { success: true }, id: 1 })
        },
      ),
      close: mock(() => {}),
      onclose: undefined as (() => void) | undefined,
    }
  },
}
