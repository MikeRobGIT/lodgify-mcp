import { vi } from 'vitest'

/**
 * Create a mock Response object
 */
export function createMockResponse(
  status: number,
  data: unknown = {},
  headers: Record<string, string> = {},
): Response {
  const mockHeaders = new Headers(headers)
  
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: getStatusText(status),
    headers: mockHeaders,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    clone: vi.fn(),
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
  return vi.fn().mockImplementation(async () => {
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
}

/**
 * Helper to create a delay promise for testing retry logic
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock timer utilities for testing retry delays
 */
export const mockTimers = {
  setup() {
    vi.useFakeTimers()
    return {
      advance: (ms: number) => vi.advanceTimersByTime(ms),
      runAll: () => vi.runAllTimers(),
      restore: () => vi.useRealTimers(),
    }
  },
}