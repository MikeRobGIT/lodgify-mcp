/**
 * Test server that wraps the actual McpServer implementation
 * For now, this is a simplified test helper until we can properly
 * test the MCP protocol integration
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { setupServer } from '../src/server.js'

export interface TestMcpServer {
  server: McpServer
  client: any
  // For now, return server instance info
  getServerInstance(): McpServer
  getClientInstance(): any
  // Cleanup
  close(): Promise<void>
}

/**
 * Create a test wrapper around the real McpServer for use in tests.
 *
 * When called without `mockClient`, constructs a minimal default client with
 * `listProperties` and `getProperty` that return resolved promises and uses it
 * to initialize the real McpServer via `setupServer`. When `mockClient` is
 * provided, its function-valued properties replace the corresponding methods
 * on the server's client instance after setup.
 *
 * The returned object exposes the underlying `server` and `client`, accessor
 * helpers `getServerInstance()` and `getClientInstance()`, and an async `close()`
 * that calls `server.close()` if that function exists.
 *
 * @param mockClient - Optional partial client implementation whose function
 *   properties will override the server client's methods to customize behavior
 *   for tests.
 * @returns A TestMcpServer wrapper with `server`, `client`, accessors, and `close()`.
 */
export function createMcpTestServer(mockClient?: any): TestMcpServer {
  // For tests, always pass a mock client to avoid environment validation
  const testClient = mockClient || {
    listProperties: () => Promise.resolve([]),
    getProperty: () => Promise.resolve({}),
    // Add minimal mock methods to avoid initialization issues
  }

  const { server, client } = setupServer(testClient)

  // Replace the client methods with mock methods if provided
  if (mockClient) {
    // Replace all client methods with mock methods
    Object.keys(mockClient).forEach((method) => {
      if (typeof mockClient[method] === 'function') {
        ;(client as any)[method] = mockClient[method]
      }
    })
  }

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
      if (server && typeof (server as any).close === 'function') {
        await (server as any).close()
      }
    },
  }
}

/**
 * Asserts that a tool object contains valid metadata and an optional input schema.
 *
 * Validations performed:
 * - Required: `name` — defined, string, non-empty.
 * - Required: `description` — defined, string, length > 10.
 * - Optional: `title` — if present, must be a non-empty string.
 * - Optional: `inputSchema` — if present, must be an object (expected to be a Zod schema-like structure, not a plain JSON schema).
 *
 * This function performs assertions via the provided `expect` helper (e.g., Jest `expect`) and will fail the test when validations do not hold.
 *
 * @param tool - The tool metadata object to validate.
 * @param expect - Assertion helper used to make the checks (e.g., Jest `expect`).
 */
export function validateToolMetadata(tool: any, expect: any) {
  // Check required metadata fields
  expect(tool.name).toBeDefined()
  expect(typeof tool.name).toBe('string')
  expect(tool.name.length).toBeGreaterThan(0)

  expect(tool.description).toBeDefined()
  expect(typeof tool.description).toBe('string')
  expect(tool.description.length).toBeGreaterThan(10) // Meaningful description

  // Check for enhanced metadata
  if (tool.title) {
    expect(typeof tool.title).toBe('string')
    expect(tool.title.length).toBeGreaterThan(0)
  }

  // Check input schema structure
  if (tool.inputSchema) {
    expect(typeof tool.inputSchema).toBe('object')
    // Should have Zod schema structure, not plain JSON schema
  }
}

/**
 * Assert that an error object matches the expected error-response shape used in MCP/JSON-RPC tests.
 *
 * Validations performed:
 * - `error` is defined and has a `message` property that is a string.
 * - If `error.code` is present, it must be a number within the JSON-RPC reserved range -32999..-32000.
 *
 * @param error - The error object to validate (should contain at least a `message` string; may include a numeric `code`)
 */
export function validateErrorResponse(error: any, expect: any) {
  expect(error).toBeDefined()
  expect(error.message).toBeDefined()
  expect(typeof error.message).toBe('string')

  // Check for JSON-RPC error structure if it's an McpError
  if (error.code !== undefined) {
    expect(typeof error.code).toBe('number')
    expect(error.code).toBeGreaterThanOrEqual(-32999)
    expect(error.code).toBeLessThanOrEqual(-32000)
  }
}
