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
 * Create a test server instance using the actual McpServer
 */
export function createMcpTestServer(mockClient?: MockLodgifyClient): TestMcpServer {
  // For tests, always pass a mock client to avoid environment validation
  const testClient = mockClient || {
    listProperties: () => Promise.resolve([]),
    getProperty: () => Promise.resolve({}),
    // Add minimal mock methods to avoid initialization issues
  }

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

  expect(tool.description).toBeDefined()
  expect(typeof tool.description).toBe('string')
  expect(tool.description.length).toBeGreaterThan(10) // Meaningful description

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
