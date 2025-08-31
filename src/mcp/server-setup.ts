/**
 * MCP Server Setup Module
 * Configures and initializes the MCP server with all tools and resources
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import pkg from '../../package.json' with { type: 'json' }
import { LodgifyOrchestrator } from '../lodgify-orchestrator.js'
import { safeLogger } from '../logger.js'
import { ResourceRegistry } from './resources/registry.js'
import { registerResources } from './resources/resources.js'
import { registerAllTools } from './tools/register-all.js'
import { ToolRegistry } from './tools/registry.js'

/**
 * Setup and configure the MCP server
 */
export function setupServer(injectedClient?: LodgifyOrchestrator): {
  server: McpServer
  getClient: () => LodgifyOrchestrator
  toolRegistry: ToolRegistry
  resourceRegistry: ResourceRegistry
} {
  // Create the MCP server instance with proper configuration
  const server = new McpServer(
    {
      name: '@mikerob/lodgify-mcp',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        },
        logging: {},
      },
      debouncedNotificationMethods: [
        'notifications/tools/list_changed',
        'notifications/resources/list_changed',
      ],
    },
  )

  // Create registries
  const toolRegistry = new ToolRegistry()
  const resourceRegistry = new ResourceRegistry()

  // Set up lazy client initialization
  let client: LodgifyOrchestrator | undefined = injectedClient

  const getClient = (): LodgifyOrchestrator => {
    if (!client) {
      // Lazy initialization with proper config
      const apiKey = process.env.LODGIFY_API_KEY
      if (!apiKey) {
        throw new Error('LODGIFY_API_KEY environment variable is required')
      }
      client = new LodgifyOrchestrator({ apiKey })
    }
    return client
  }

  // Register all tools
  registerAllTools(toolRegistry, getClient)
  toolRegistry.registerAll(server)

  // Register resources
  registerResources(resourceRegistry, getClient)
  resourceRegistry.registerAll(server)

  return {
    server,
    getClient,
    toolRegistry,
    resourceRegistry,
  }
}

/**
 * Start the MCP server with stdio transport
 */
export async function startServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport()

  // Handle transport errors
  transport.onerror = (error) => {
    // Use safeLogger instead of console.error to avoid MCP stdio interference
    safeLogger.error('Transport error:', error)
  }

  await server.connect(transport)
}
