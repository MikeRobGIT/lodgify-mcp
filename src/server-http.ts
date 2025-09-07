#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server using Streamable HTTP transport with SSE support
 */

import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { config } from 'dotenv'
import express from 'express'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3000
const AUTH_TOKEN = process.env.MCP_TOKEN
const ENABLE_CORS = process.env.ENABLE_CORS === 'true'

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

// Session TTL configuration (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

async function main() {
  const app = express()
  app.use(express.json())

  // Optional CORS support for browser clients
  if (ENABLE_CORS) {
    const cors = (await import('cors')).default
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id', 'authorization'],
      }),
    )
    safeLogger.info('CORS enabled')
  }

  // Health check endpoint (no authentication required)
  app.get('/health', (_req, res) => {
    res.status(200).send('ok')
  })

  // Bearer token authentication middleware for /mcp endpoint only
  const authenticateRequest = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const auth = req.header('authorization')
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }

  // Handle POST requests for client-to-server communication
  app.post('/mcp', authenticateRequest, async (req, res) => {
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport: StreamableHTTPServerTransport

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId]
        safeLogger.debug(`Session reused: ${sessionId}`)
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request - create stateful transport with session management
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            // Store the transport by session ID
            transports[newSessionId] = transport
            safeLogger.info(`New SSE-enabled session created: ${newSessionId}`)

            // Set up session cleanup timer
            setTimeout(() => {
              if (transports[newSessionId]) {
                delete transports[newSessionId]
                safeLogger.debug(`Session ${newSessionId} timed out and was cleaned up`)
              }
            }, SESSION_TTL_MS)
          },
          // DNS rebinding protection disabled for local development
          // Enable this in production with proper allowedHosts configuration
          enableDnsRebindingProtection: false,
        })

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId]
            safeLogger.debug(`Session ${transport.sessionId} closed and cleaned up`)
          }
        }

        // Create and connect a new MCP server instance for this session
        const { server } = setupServer()
        await server.connect(transport)
      } else {
        // Invalid request - no session ID for non-initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        })
        return
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      safeLogger.error('POST request handling failed', err)
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

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', authenticateRequest, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = transports[sessionId]
      safeLogger.debug(`SSE stream established for session: ${sessionId}`)

      // Handle the SSE request
      await transport.handleRequest(req, res)
    } catch (err) {
      safeLogger.error('GET request (SSE) handling failed', err)
      if (!res.headersSent) {
        res.status(500).send('Internal server error')
      }
    }
  })

  // Handle DELETE requests for session termination
  app.delete('/mcp', authenticateRequest, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = transports[sessionId]
      safeLogger.info(`Session termination requested: ${sessionId}`)

      // Handle the termination request
      await transport.handleRequest(req, res)

      // Clean up the session
      delete transports[sessionId]
    } catch (err) {
      safeLogger.error('DELETE request handling failed', err)
      if (!res.headersSent) {
        res.status(500).send('Internal server error')
      }
    }
  })

  app.listen(PORT, () => {
    safeLogger.info(`SSE-enabled HTTP MCP server listening on port ${PORT}`)
    safeLogger.info('Endpoints:')
    safeLogger.info(`  POST   /mcp - Client-to-server messages`)
    safeLogger.info(`  GET    /mcp - SSE stream for server-to-client notifications`)
    safeLogger.info(`  DELETE /mcp - Session termination`)
    safeLogger.info(`  GET    /health - Health check`)
  })
}

main().catch((error) => {
  try {
    safeLogger.error('Failed to start SSE-enabled HTTP server', error)
  } catch (logError) {
    // Fallback to console.error if logger fails
    console.error('Failed to start SSE-enabled HTTP server', error)
    console.error('Logger error:', logError)
  }
  process.exit(1)
})
