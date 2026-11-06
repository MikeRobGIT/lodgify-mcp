#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server using Streamable HTTP transport
 */

import { config } from 'dotenv'
import { createApp } from './http-app.js'
import { safeLogger } from './logger.js'

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3000
const AUTH_TOKEN = process.env.MCP_TOKEN

// Fail fast if auth token is not configured
if (!AUTH_TOKEN) {
  try {
    safeLogger.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
  } catch (error) {
    // Fallback to console.error if logger fails during early startup
    console.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
    console.error('Logger initialization error:', error)
  }
  process.exit(1)
}

async function main() {
  const app = createApp(AUTH_TOKEN as string)
  app.listen(PORT, () => {
    safeLogger.info(`HTTP MCP server listening on port ${PORT}`)
  })
}

main().catch((error) => {
  try {
    safeLogger.error('Failed to start HTTP server', error)
  } catch (logError) {
    // Fallback to console.error if logger fails
    console.error('Failed to start HTTP server', error)
    console.error('Logger error:', logError)
  }
  process.exit(1)
})
