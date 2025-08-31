#!/usr/bin/env node
/**
 * Lodgify MCP Server - Refactored Version
 *
 * This is a simplified version demonstrating the modular architecture.
 * The full implementation would import and register all tool modules.
 */

import { config } from 'dotenv'
import { safeLogger } from './logger.js'
import { setupServer, startServer } from './mcp/server-setup.js'

// Load environment variables
config()

/**
 * Main entry point for the refactored Lodgify MCP server
 */
async function main() {
  try {
    // Setup the server with all modules
    const { server, toolRegistry, resourceRegistry } = setupServer()

    // Log startup info
    safeLogger.info('Lodgify MCP server (refactored) starting...')
    safeLogger.info(`Tools registered: ${toolRegistry.getTools().length}`)
    safeLogger.info(`Resources registered: ${resourceRegistry.getResources().length}`)

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      safeLogger.info('Shutting down...')
      await server.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      safeLogger.info('Shutting down...')
      await server.close()
      process.exit(0)
    })

    // Start the server
    await startServer(server)
    safeLogger.info('Lodgify MCP server (refactored) started successfully')
  } catch (error) {
    safeLogger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Export for testing
export { setupServer }

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    safeLogger.error('Fatal error:', error)
    process.exit(1)
  })
}
