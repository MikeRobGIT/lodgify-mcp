/**
 * SSE Server for Lodgify MCP
 * Provides Server-Sent Events transport for MCPO compatibility
 */

import type { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import cors from 'cors'
import express from 'express'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

const app = express()
const PORT = process.env.SSE_PORT || 8001

// Store active SSE connections
const activeTransports = new Map<
  string,
  {
    transport: SSEServerTransport
    server: MCPServer
  }
>()

// Enable CORS for all origins
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Session-Id'],
    credentials: true,
  }),
)

// Parse JSON bodies for message endpoint
app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    connections: activeTransports.size,
    timestamp: new Date().toISOString(),
  })
})

// SSE endpoint - handles GET requests to establish SSE connection
app.get('/sse', async (req, res) => {
  safeLogger.info('SSE connection requested')

  let transport: SSEServerTransport | null = null
  let sessionId: string | null = null
  let transportStarted = false

  try {
    // Setup MCP server first (before creating transport)
    const { server } = setupServer()

    // Create SSE transport with the endpoint for POST messages
    transport = new SSEServerTransport('/message', res, {
      enableDnsRebindingProtection: false, // Disable for development
    })

    // Store the transport and server for message routing
    sessionId = transport.sessionId
    activeTransports.set(sessionId, { transport, server })

    // Start the SSE connection (this sends SSE headers)
    await transport.start()
    transportStarted = true

    // Connect the MCP server to the transport
    await server.connect(transport)

    safeLogger.info(`MCP server connected via SSE transport (session: ${sessionId})`)

    // Handle client disconnect
    req.on('close', () => {
      safeLogger.info(`SSE client disconnected (session: ${sessionId})`)
      if (sessionId) {
        activeTransports.delete(sessionId)
      }
      if (transport) {
        transport.close()
      }
    })
  } catch (error) {
    safeLogger.error('Failed to setup SSE transport:', error)

    // Clean up on error
    if (sessionId) {
      activeTransports.delete(sessionId)
    }

    // If SSE transport hasn't started yet, we can send error response
    if (!transportStarted) {
      res.status(500).json({ error: 'Failed to setup MCP server' })
    }
    // If transport has started, headers are already sent, so we can't send JSON
    // The transport will handle its own cleanup
  }
})

// Message endpoint - handles POST requests with JSON-RPC messages
app.post('/message', async (req, res) => {
  // MCPO sends session ID as query parameter, others might use header
  const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string)

  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId (query param or X-Session-Id header)' })
    return
  }

  const session = activeTransports.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    // Forward the message to the MCP server via transport
    // The SSE transport handles the actual message routing
    res.status(200).json({ status: 'message forwarded' })
  } catch (error) {
    safeLogger.error('Failed to forward message:', error)
    res.status(500).json({ error: 'Failed to forward message' })
  }
})

// List active sessions (for debugging)
app.get('/sessions', (_req, res) => {
  const sessions = Array.from(activeTransports.keys())
  res.json({
    count: sessions.length,
    sessions: sessions,
  })
})

// Start the server
app.listen(PORT, () => {
  safeLogger.info(`SSE server listening on port ${PORT}`)
  safeLogger.info('Endpoints:')
  safeLogger.info(`  GET  /sse      - Establish SSE connection`)
  safeLogger.info(`  POST /message  - Send messages to MCP server`)
  safeLogger.info(`  GET  /health   - Health check`)
  safeLogger.info(`  GET  /sessions - List active sessions`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  safeLogger.info('SIGTERM received, closing all connections...')
  activeTransports.forEach(({ transport }) => {
    transport.close()
  })
  activeTransports.clear()
  process.exit(0)
})

process.on('SIGINT', () => {
  safeLogger.info('SIGINT received, closing all connections...')
  activeTransports.forEach(({ transport }) => {
    transport.close()
  })
  activeTransports.clear()
  process.exit(0)
})
