#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server using Streamable HTTP transport
 * Implements official MCP stateful session pattern with proper session management
 */

import { randomUUID } from 'node:crypto'
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import cors from 'cors'
import { config } from 'dotenv'
import type { Request, Response } from 'express'
import express from 'express'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

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

// Session TTL configuration (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000

interface SessionInfo {
  transport: StreamableHTTPServerTransport
  server: McpServer
  cleanup: () => Promise<void>
  timer: NodeJS.Timeout
  eventStore: InMemoryEventStore
}

async function main() {
  const sessions = new Map<string, SessionInfo>()

  // Helper function to clean up a session
  const cleanupSession = async (sessionId: string) => {
    const session = sessions.get(sessionId)
    if (session) {
      clearTimeout(session.timer)
      try {
        await session.transport.close()
        await session.cleanup()
      } catch (error) {
        safeLogger.error(`Error cleaning up session ${sessionId}:`, error)
      }
      sessions.delete(sessionId)
      safeLogger.debug(`Session ${sessionId} cleaned up`)
    }
  }

  // Helper function to reset session timer
  const resetSessionTimer = (sessionId: string) => {
    const session = sessions.get(sessionId)
    if (session) {
      clearTimeout(session.timer)
      session.timer = setTimeout(() => cleanupSession(sessionId), SESSION_TTL_MS)
    }
  }

  const app = express()

  // CORS middleware - CRITICAL for browser clients to access mcp-session-id header
  app.use(
    cors({
      origin: '*',
      methods: 'GET,POST,DELETE',
      preflightContinue: false,
      optionsSuccessStatus: 204,
      exposedHeaders: ['mcp-session-id', 'last-event-id', 'mcp-protocol-version'],
      allowedHeaders: ['Content-Type', 'mcp-session-id', 'last-event-id', 'authorization'],
    }),
  )

  // Health check endpoint (no authentication required)
  app.get('/health', (_req, res) => {
    res.status(200).send('ok')
  })

  // Bearer token authentication middleware for /mcp endpoint only
  app.use('/mcp', (req, res, next) => {
    const auth = req.header('authorization')
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  })

  // POST /mcp - Initialize new sessions or send requests to existing sessions
  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.header('mcp-session-id')?.trim()
      let sessionInfo: SessionInfo | undefined

      if (sessionId && sessions.has(sessionId)) {
        // Reuse existing session
        sessionInfo = sessions.get(sessionId)
        if (sessionInfo) {
          resetSessionTimer(sessionId)
          safeLogger.debug(`Session reused: ${sessionId}`)
          await sessionInfo.transport.handleRequest(req, res)
        }
      } else if (!sessionId) {
        // Initialize new session (no session ID header means initialization request)
        safeLogger.debug('Initializing new session')

        // Create per-session server instance (official pattern)
        const { server, cleanup } = setupServer()

        // Create event store for session resumability (reconnection support)
        const eventStore = new InMemoryEventStore()

        // Create transport with sessionIdGenerator for stateful mode
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable session resumability for reconnections
          onsessioninitialized: (newSessionId: string) => {
            safeLogger.debug(`Session initialized with ID: ${newSessionId}`)

            // Set up session timer
            const timer = setTimeout(() => cleanupSession(newSessionId), SESSION_TTL_MS)

            // Store session info
            sessions.set(newSessionId, {
              transport,
              server,
              cleanup,
              timer,
              eventStore,
            })
          },
        })

        // Set up cleanup on transport close
        transport.onclose = async () => {
          const sid = transport.sessionId
          if (sid && sessions.has(sid)) {
            safeLogger.debug(`Transport closed for session ${sid}`)
            await cleanupSession(sid)
          }
        }

        // Connect server to transport
        await server.connect(transport)

        // Handle the initialization request
        await transport.handleRequest(req, res)
      } else {
        // Session ID provided but not found
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Invalid or expired session ID',
          },
          id: req?.body?.id,
        })
      }
    } catch (err) {
      safeLogger.error('Request handling failed', err)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: req?.body?.id,
        })
      }
    }
  })

  // GET /mcp - Establish SSE stream for existing sessions
  app.get('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.header('mcp-session-id')?.trim()
      const lastEventId = req.header('last-event-id')

      // Enhanced debug logging
      safeLogger.debug(`GET /mcp - Session ID: ${sessionId || 'NONE'}`)
      safeLogger.debug(`GET /mcp - Last-Event-ID: ${lastEventId || 'NONE'}`)
      safeLogger.debug(`GET /mcp - Active sessions: [${Array.from(sessions.keys()).join(', ')}]`)

      if (!sessionId || !sessions.has(sessionId)) {
        safeLogger.warn(
          `GET /mcp - Session ${sessionId} not found. Active sessions: ${sessions.size}`,
        )
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: req?.body?.id,
        })
        return
      }

      if (lastEventId) {
        safeLogger.info(
          `Client reconnecting to session ${sessionId} with Last-Event-ID: ${lastEventId}`,
        )
      } else {
        safeLogger.info(`Establishing new SSE stream for session ${sessionId}`)
      }

      const sessionInfo = sessions.get(sessionId)
      if (sessionInfo) {
        resetSessionTimer(sessionId)
        safeLogger.debug(`Handling SSE request for session ${sessionId}`)
        await sessionInfo.transport.handleRequest(req, res)
      }
    } catch (err) {
      safeLogger.error('SSE stream handling failed', err)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: req?.body?.id,
        })
      }
    }
  })

  // DELETE /mcp - Terminate session
  app.delete('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionId = req.header('mcp-session-id')?.trim()

      if (!sessionId || !sessions.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: req?.body?.id,
        })
        return
      }

      safeLogger.debug(`Received session termination request for session ${sessionId}`)

      const sessionInfo = sessions.get(sessionId)
      if (sessionInfo) {
        await sessionInfo.transport.handleRequest(req, res)
        // Cleanup will be handled by transport.onclose
      }
    } catch (err) {
      safeLogger.error('Session termination failed', err)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Error handling session termination',
          },
          id: req?.body?.id,
        })
      }
    }
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    safeLogger.info('Shutting down server...')
    for (const [sessionId, sessionInfo] of sessions.entries()) {
      try {
        safeLogger.debug(`Closing session ${sessionId}`)
        await sessionInfo.transport.close()
        await sessionInfo.cleanup()
      } catch (error) {
        safeLogger.error(`Error closing session ${sessionId}:`, error)
      }
    }
    sessions.clear()
    safeLogger.info('Server shutdown complete')
    process.exit(0)
  })

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
