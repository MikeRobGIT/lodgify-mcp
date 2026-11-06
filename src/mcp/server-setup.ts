/**
 * MCP Server Setup Module
 * Configures and initializes the MCP server with all tools and resources
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import pkg from '../../package.json' with { type: 'json' }
import { loadEnvironment, normalizeBoolean } from '../env.js'
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
  const readOnly = injectedClient?.isReadOnly?.() ?? normalizeBoolean(process.env.LODGIFY_READ_ONLY)

  // Create the MCP server instance with proper configuration
  const server = new McpServer(
    {
      name: '@mikerob/lodgify-mcp',
      version: pkg.version,
      title: 'Lodgify',
      websiteUrl: 'https://github.com/MikeRobGIT/lodgify-mcp',
    },
    {
      instructions: [
        'Lodgify vacation-rental property management (API v1/v2).',
        'If you do not know a property ID, call lodgify_find_properties or lodgify_list_properties first.',
        'Dates are YYYY-MM-DD. lodgify_list_bookings defaults to stayFilter "Upcoming"; avoid "All" (very large).',
        'Messaging is read-only: use lodgify_get_thread with the thread_uid from a booking; sending messages is not supported by the Lodgify API.',
        readOnly
          ? 'Read-only mode is ON: create/update/delete tools are not available.'
          : 'Create/update/delete tools modify live data; confirm with the user first.',
      ].join('\n'),
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
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
      // Lazy initialization with proper environment configuration
      const config = loadEnvironment()
      client = new LodgifyOrchestrator({
        apiKey: config.LODGIFY_API_KEY,
        readOnly: config.LODGIFY_READ_ONLY,
        debugHttp: config.DEBUG_HTTP,
      })
    }
    return client
  }

  // Register all tools
  registerAllTools(toolRegistry, getClient)
  toolRegistry.registerAll(server, { readOnly })

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
