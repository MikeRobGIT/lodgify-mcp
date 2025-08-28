import { setupServer } from '../src/server.js'
import type {
  ErrorResponse,
  ExpectFunction,
  MockLodgifyClient,
  TestMcpServer as TestMcpServerType,
  ToolMetadata,
} from './types.js'

// Using TestMcpServer from types.ts
export type TestMcpServer = TestMcpServerType

/**
 * Helper function to create a complete default mock client
 */
function createDefaultMockClient(): MockLodgifyClient {
  return {
    request: async () => undefined,
    listProperties: async () => [],
    getProperty: async () => ({}),
    listPropertyRooms: async () => [],
    listDeletedProperties: async () => [],
    dailyRates: async () => ({}),
    rateSettings: async () => ({}),
    listBookings: async () => [],
    getBooking: async () => ({}),
    getBookingPaymentLink: async () => ({}),
    createBookingPaymentLink: async () => ({}),
    updateKeyCodes: async () => undefined,
    availabilityRoom: async () => ({}),
    availabilityProperty: async () => ({}),
    getQuote: async () => ({}),
    getThread: async () => ({}),
    createBooking: async () => ({}),
    updateBooking: async () => ({}),
    deleteBooking: async () => undefined,
    updatePropertyAvailability: async () => undefined,
    subscribeWebhook: async () => ({}),
    listWebhooks: async () => [],
    unsubscribeWebhook: async () => undefined,
    updateRates: async () => undefined,
    availabilityAll: async () => ({}),
    checkinBooking: async () => undefined,
    checkoutBooking: async () => undefined,
    getExternalBookings: async () => [],
    getDailyRates: async () => ({}),
    getRateSettings: async () => ({}),
    // Optional methods with safe defaults
    getNextAvailableDate: async () => undefined,
    checkDateRangeAvailability: async () => ({}),
    getAvailabilityCalendar: async () => ({}),
    findProperties: async () => [],
  }
}

/**
 * Create a test server instance using the actual McpServer
 */
export function createMcpTestServer(mockClient?: MockLodgifyClient): TestMcpServer {
  // For tests, always pass a mock client to avoid environment validation
  const testClient = mockClient ?? createDefaultMockClient()

  const { server, getClient } = setupServer(testClient)

  // Get the client instance
  const client = mockClient || getClient()

  return {
    server,
    client,

    getServerInstance() {
      return server
    },

    getClientInstance() {
      return client
    },

    async close() {
      // Cleanup if needed
      if (
        server &&
        'close' in server &&
        typeof (server as { close?: () => Promise<void> }).close === 'function'
      ) {
        await (server as { close: () => Promise<void> }).close()
      }
    },
  }
}

/**
 * Helper function to test tool schemas and metadata
 */
export function validateToolMetadata(tool: ToolMetadata, expect: ExpectFunction) {
  // Check required metadata fields
  expect(tool.name).toBeDefined()
  expect(typeof tool.name).toBe('string')
  expect(tool.name.length).toBeGreaterThan(0)

  if (tool.description !== undefined) {
    expect(typeof tool.description).toBe('string')
    expect(tool.description.length).toBeGreaterThan(10) // Meaningful description
  }

  // (optional) Add richer metadata checks here if ToolMetadata is extended

  // Check input schema structure
  if (tool.inputSchema) {
    expect(typeof tool.inputSchema).toBe('object')
    // Should have Zod schema structure, not plain JSON schema
  }
}

/**
 * Helper function to validate error responses
 */
export function validateErrorResponse(error: ErrorResponse, expect: ExpectFunction) {
  expect(error).toBeDefined()
  expect(error.message).toBeDefined()
  expect(typeof error.message).toBe('string')

  // Check for JSON-RPC error structure if it's an McpError
  if (error.code !== undefined) {
    if (typeof error.code === 'number') {
      expect(error.code).toBeGreaterThan(-33000)
      expect(error.code).toBeLessThan(-31999)
    } else {
      expect(typeof error.code).toBe('string')
      expect((error.code as string).length).toBeGreaterThan(0)
    }
  }
}
