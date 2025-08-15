/**
 * Test server that wraps the actual McpServer implementation
 * For now, this is a simplified test helper until we can properly
 * test the MCP protocol integration
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
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
 * Create a test server instance using the actual McpServer
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
    Object.keys(mockClient).forEach(method => {
      if (typeof mockClient[method] === 'function') {
        (client as any)[method] = mockClient[method]
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
    }
  }
}

/**
 * Helper function to test tool schemas and metadata
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
 * Helper function to validate error responses
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