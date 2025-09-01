/**
 * Type definitions for test utilities
 */

import type { McpServer } from '../src/server.js'

/**
 * Mock LodgifyClient type
 */
export interface MockLodgifyClient {
  request: (method: string, path: string, options?: unknown) => Promise<unknown>
  listProperties: () => Promise<unknown>
  getProperty: (id: string) => Promise<unknown>
  listPropertyRooms: (id: string) => Promise<unknown>
  listDeletedProperties: () => Promise<unknown>
  dailyRates: (params?: Record<string, unknown>) => Promise<unknown>
  rateSettings: (params?: Record<string, unknown>) => Promise<unknown>
  listBookings: (params?: Record<string, unknown>) => Promise<unknown>
  getBooking: (id: string) => Promise<unknown>
  getBookingPaymentLink: (id: string) => Promise<unknown>
  createBookingPaymentLink: (id: string, payload: unknown) => Promise<unknown>
  updateKeyCodes: (id: string, payload: unknown) => Promise<unknown>
  availabilityRoom: (
    propertyId: string,
    roomTypeId: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>
  availabilityProperty: (propertyId: string, params?: Record<string, unknown>) => Promise<unknown>
  getQuote: (propertyId: string, params?: Record<string, unknown>) => Promise<unknown>
  getThread: (threadGuid: string) => Promise<unknown>
  createBooking: (payload: unknown) => Promise<unknown>
  updateBooking: (id: string, payload: unknown) => Promise<unknown>
  deleteBooking: (id: string) => Promise<unknown>
  updatePropertyAvailability: (propertyId: string, payload: unknown) => Promise<unknown>
  subscribeWebhook: (payload: unknown) => Promise<unknown>
  listWebhooks: (params?: Record<string, unknown>) => Promise<unknown>
  unsubscribeWebhook: (payload: unknown) => Promise<unknown>
  updateRates: (payload: unknown) => Promise<unknown>
  availabilityAll: (params?: Record<string, unknown>) => Promise<unknown>
  checkinBooking: (id: string) => Promise<unknown>
  checkoutBooking: (id: string) => Promise<unknown>
  getExternalBookings: (id: string) => Promise<unknown>
  getDailyRates: (params: Record<string, unknown>) => Promise<unknown>
  getRateSettings: (params: Record<string, unknown>) => Promise<unknown>
  getNextAvailableDate?: (
    propertyId: string,
    fromDate?: string,
    daysToCheck?: number,
  ) => Promise<unknown>
  checkDateRangeAvailability?: (
    propertyId: string,
    checkInDate: string,
    checkOutDate: string,
  ) => Promise<unknown>
  getAvailabilityCalendar?: (
    propertyId: string,
    fromDate?: string,
    daysToShow?: number,
  ) => Promise<unknown>
  findProperties?: (
    searchTerm?: string,
    limit?: number,
    includePropertyIds?: boolean,
  ) => Promise<unknown>
}

/**
 * Test server interface
 */
export interface TestMcpServer {
  server: McpServer
  client: MockLodgifyClient
  getServerInstance(): McpServer
  getClientInstance(): MockLodgifyClient
  close(): Promise<void>
}

/**
 * Error with additional properties for testing
 */
export interface TestError extends Error {
  status?: number
  retryAfter?: number
  code?: string
}

/**
 * Timer interface for mock setTimeout
 */
export interface Timer {
  callback: () => void | Promise<void>
  delay: number
  time: number
}

/**
 * Tool metadata for validation
 */
export interface ToolMetadata {
  name: string
  description?: string
  inputSchema?: unknown
  category?: string
  subcategory?: string
  requiresConfirmation?: boolean
  dangerous?: boolean
  deprecated?: {
    since?: string
    message?: string
    alternative?: string
  }
}

/**
 * Error response for validation
 */
export interface ErrorResponse {
  message: string
  code?: string | number
  details?: unknown
}

/**
 * Test tool handler arguments
 */
export type ToolHandlerArgs = Record<string, unknown>

/**
 * Expect function type from Bun test
 */
export interface ExpectFunction {
  (
    value: unknown,
  ): {
    toBeDefined(): void
    toBeUndefined(): void
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toBeInstanceOf(expected: unknown): void
    toBeGreaterThan(expected: number): void
    toBeLessThan(expected: number): void
    toHaveProperty(property: string, value?: unknown): void
    [key: string]: unknown
  }
  [key: string]: unknown
}
