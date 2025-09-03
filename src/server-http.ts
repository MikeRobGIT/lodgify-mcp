#!/usr/bin/env node

/**
 * Lodgify MCP Server - HTTP Transport Mode
 *
 * This server exposes the MCP server over HTTP using Streamable transport
 * (the modern replacement for SSE). Supports session management and Bearer token authentication.
 */

import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { config } from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import { loadEnvironment } from './env.js'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

// Load environment variables (suppress console output for MCP compatibility)
const originalConsoleLog = console.log
console.log = () => {} // Suppress output
config()
console.log = originalConsoleLog // Restore console.log

// Store transports by session ID
const transports = new Map<string, StreamableHTTPServerTransport>()

/**
 * Authentication middleware for Bearer token validation
 */
function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const config = loadEnvironment()

  // If no MCP_TOKEN is configured, allow all requests (development mode)
  if (!config.MCP_TOKEN) {
    safeLogger.warn('HTTP server running without authentication (MCP_TOKEN not configured)')
    next()
    return
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1] // Bearer <token>

  if (!token || token !== config.MCP_TOKEN) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing authentication token',
      },
      id: null,
    })
    return
  }

  next()
}

/**
 * Main entry point for the HTTP MCP server
 */
async function main() {
  try {
    // Load environment configuration
    const envConfig = loadEnvironment()
    const port = envConfig.MCP_PORT

    // Create Express application
    const app = express()
    app.use(express.json({ limit: '10mb' }))

    // Setup the MCP server with all modules
    const { server, toolRegistry, resourceRegistry } = setupServer()

    // Log startup info
    safeLogger.info('Lodgify MCP HTTP server starting...')
    safeLogger.info(`Tools registered: ${toolRegistry.getTools().length}`)
    safeLogger.info(`Resources registered: ${resourceRegistry.getResources().length}`)
    safeLogger.info(
      `Authentication: ${envConfig.MCP_TOKEN ? 'Enabled' : 'Disabled (development mode)'}`,
    )

    // Health check endpoint (no authentication required)
    app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        transport: 'streamableHttp',
        tools: toolRegistry.getTools().length,
        resources: resourceRegistry.getResources().length,
        sessions: transports.size,
      })
    })

    // Main MCP endpoint - handles GET, POST, DELETE with Streamable transport
    app.all('/mcp', authenticateToken, async (req, res) => {
      safeLogger.debug(`Received ${req.method} request to /mcp`, {
        headers: req.headers,
        sessionId: req.headers['mcp-session-id'],
      })

      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined
        let transport: StreamableHTTPServerTransport | undefined

        if (sessionId && transports.has(sessionId)) {
          // Reuse existing transport for this session
          transport = transports.get(sessionId)
          safeLogger.debug(`Reusing existing transport for session ${sessionId}`)
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport for initialization request
          const newTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              // Store the transport by session ID when session is initialized
              safeLogger.info(`StreamableHTTP session initialized with ID: ${newSessionId}`)
              if (newTransport) {
                transports.set(newSessionId, newTransport)
              }
            },
          })
          transport = newTransport

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport?.sessionId
            if (sid && transports.has(sid)) {
              safeLogger.info(`Transport closed for session ${sid}, removing from transports map`)
              transports.delete(sid)
            }
          }

          // Connect the transport to the MCP server
          await server.connect(transport)
        } else if (!sessionId) {
          // Invalid request - no session ID and not an initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message:
                'Bad Request: No session ID provided. Initialize a session first with POST /mcp and an initialize request.',
            },
            id: null,
          })
          return
        } else {
          // Session ID provided but not found
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32002,
              message: `Session not found: ${sessionId}`,
            },
            id: null,
          })
          return
        }

        // Handle the request with the transport
        await transport?.handleRequest(req, res, req.body)
      } catch (error) {
        safeLogger.error('Error handling MCP request:', error)
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          })
        }
      }
    })

    // Session cleanup endpoint (optional, for administrative purposes)
    app.delete('/sessions/:sessionId', authenticateToken, (req, res) => {
      const { sessionId } = req.params

      if (transports.has(sessionId)) {
        const transport = transports.get(sessionId)
        transport?.close()
        transports.delete(sessionId)
        res.json({ message: `Session ${sessionId} terminated` })
      } else {
        res.status(404).json({ error: `Session ${sessionId} not found` })
      }
    })

    // List active sessions (optional, for administrative purposes)
    app.get('/sessions', authenticateToken, (_req, res) => {
      const sessions = Array.from(transports.keys())
      res.json({
        count: sessions.length,
        sessions,
      })
    })

    // Handle shutdown gracefully
    const shutdown = async () => {
      safeLogger.info('Shutting down HTTP server...')

      // Close all active transports
      for (const [sessionId, transport] of transports.entries()) {
        safeLogger.info(`Closing transport for session ${sessionId}`)
        transport.close()
      }
      transports.clear()

      await server.close()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Start the HTTP server
    app.listen(port, () => {
      safeLogger.info(`Lodgify MCP HTTP server listening on port ${port}`)
      safeLogger.info('Endpoint: POST /mcp for MCP requests')
      safeLogger.info('Endpoint: GET /health for health checks')
      if (envConfig.MCP_TOKEN) {
        safeLogger.info('Authentication required: Authorization: Bearer <token>')
      }
    })
  } catch (error) {
    safeLogger.error('Failed to start HTTP server:', error)
    process.exit(1)
  }
}

// Export for testing
export { main, transports }

// Run when used as script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    safeLogger.error('Fatal error:', error)
    process.exit(1)
  })
}
