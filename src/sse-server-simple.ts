/**
 * Simple SSE Server for Lodgify MCP - MCPO Compatible
 * Provides minimal SSE transport for MCPO integration
 */

import { randomUUID } from 'node:crypto'
import type { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js'
import cors from 'cors'
import express from 'express'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

const app = express()
const PORT = process.env.SSE_PORT || 8001

// Store active connections
const activeConnections = new Map<
  string,
  {
    server: MCPServer
    toolRegistry: any
    messages: any[]
    res: express.Response
  }
>()

// Helper function to handle JSON-RPC messages
async function handleJsonRpcMessage(
  message: any,
  connection: { server: MCPServer; toolRegistry: any; messages: any[]; res: express.Response },
  httpRes: express.Response,
) {
  // If this is a notification (no id field), just acknowledge it
  if (message.id === undefined) {
    safeLogger.info(`Received notification: ${message.method}`)
    httpRes.json({ status: 'ok' })
    return
  }

  // Handle the message based on JSON-RPC method
  if (message.method === 'initialize') {
    // Send initialization response with full capabilities
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
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
        serverInfo: {
          name: '@mikerob/lodgify-mcp',
          version: '1.0.0',
        },
      },
    }

    // Check if we have an SSE connection or are in POST-only mode
    if (connection.res) {
      // SSE mode - send via SSE stream
      connection.res.write(`event: message\n`)
      connection.res.write(`data: ${JSON.stringify(response)}\n\n`)
      httpRes.json({ status: 'ok' })
    } else {
      // POST-only mode - return directly
      httpRes.json(response)
    }
  } else if (message.method === 'tools/list') {
    // Get tools from the tool registry
    const toolList = connection.toolRegistry.getTools().map((tool: any) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    }))

    safeLogger.info(`Sending ${toolList.length} tools in response`)

    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: toolList,
      },
    }

    // Check if we have an SSE connection or are in POST-only mode
    if (connection.res) {
      // SSE mode - send via SSE stream
      connection.res.write(`event: message\n`)
      connection.res.write(`data: ${JSON.stringify(response)}\n\n`)
      httpRes.json({ status: 'ok' })
    } else {
      // POST-only mode - return directly
      httpRes.json(response)
    }
  } else if (message.method === 'tools/call') {
    // Call the tool
    try {
      const toolName = message.params.name
      const toolArgs = message.params.arguments || {}

      const tool = connection.toolRegistry.getTools().find((t: any) => t.name === toolName)

      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`)
      }

      const result = await tool.handler(toolArgs)

      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: result.content || [],
          isError: result.isError || false,
        },
      }

      // Check if we have an SSE connection or are in POST-only mode
      if (connection.res) {
        // SSE mode - send via SSE stream
        connection.res.write(`data: ${JSON.stringify(response)}\n\n`)
        httpRes.json({ status: 'ok' })
      } else {
        // POST-only mode - return directly
        httpRes.json(response)
      }
    } catch (error: any) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
        },
      }

      // Check if we have an SSE connection or are in POST-only mode
      if (connection.res) {
        // SSE mode - send via SSE stream
        connection.res.write(`event: message\n`)
        connection.res.write(`data: ${JSON.stringify(errorResponse)}\n\n`)
        httpRes.json({ status: 'ok' })
      } else {
        // POST-only mode - return directly
        httpRes.json(errorResponse)
      }
    }
  } else {
    // Unknown method
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`,
      },
    }

    // Check if we have an SSE connection or are in POST-only mode
    if (connection.res) {
      // SSE mode - send via SSE stream
      connection.res.write(`event: message\n`)
      connection.res.write(`data: ${JSON.stringify(response)}\n\n`)
      httpRes.json({ status: 'ok' })
    } else {
      // POST-only mode - return directly
      httpRes.json(response)
    }
  }
}

// Enable CORS for all origins
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Session-Id'],
    credentials: true,
  }),
)

// Parse JSON bodies
app.use(express.json())

// Log all requests for debugging
app.use((req, _res, next) => {
  safeLogger.info(`${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`)
  next()
})

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    connections: activeConnections.size,
    timestamp: new Date().toISOString(),
  })
})

// Hybrid SSE/Streamable HTTP endpoint
// Handles both GET (for SSE stream) and POST (for JSON-RPC messages)
app.get('/sse', async (req, res) => {
  // Always generate a new session ID for GET requests (SSE establishment)
  const sessionId = randomUUID()
  safeLogger.info(`SSE connection requested, new session: ${sessionId}`)

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Session-Id': sessionId,
  })

  try {
    // Setup MCP server
    const { server, toolRegistry } = setupServer()

    // Store connection
    activeConnections.set(sessionId, {
      server,
      toolRegistry,
      messages: [],
      res,
    })

    // Send the endpoint event - this is what the SSE client expects first
    // The endpoint URL should be where the client sends POST requests
    // Use localhost for local development, host.docker.internal for Docker
    const endpointUrl = `http://localhost:8001/sse?sessionId=${sessionId}`
    res.write(`event: endpoint\n`)
    res.write(`data: ${endpointUrl}\n\n`)

    safeLogger.info(`Sent endpoint event with URL: ${endpointUrl}, session: ${sessionId}`)

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n')
    }, 30000)

    // Handle client disconnect
    req.on('close', () => {
      safeLogger.info(`SSE client disconnected, session: ${sessionId}`)
      clearInterval(keepAlive)
      activeConnections.delete(sessionId)
    })

    safeLogger.info(`SSE connection established, session: ${sessionId}`)
  } catch (error) {
    safeLogger.error('Failed to setup SSE connection:', error)
    res.end()
  }
})

// POST handler for hybrid SSE/Streamable HTTP endpoint
// This allows the same /sse endpoint to handle both GET (SSE) and POST (JSON-RPC)
app.post('/sse', async (req, res) => {
  // For Streamable HTTP, session ID must come from query param or header
  let sessionId =
    (req.query.sessionId as string) ||
    (req.headers['x-session-id'] as string) ||
    (req.headers['mcp-session-id'] as string)

  // If no session ID, this might be MCPO's initial connection attempt
  // Log what was sent and check if it's a JSON-RPC message
  if (!sessionId) {
    const message = req.body
    safeLogger.info('POST to /sse without sessionId, body:', JSON.stringify(message))

    // If it's a JSON-RPC message, handle it differently
    if (message?.jsonrpc && message.method) {
      // This is an initialization request from MCPO
      // Create a new session for it
      sessionId = randomUUID()
      const { server, toolRegistry } = setupServer()

      // Store connection (but without SSE response object since this is POST)
      activeConnections.set(sessionId, {
        server,
        toolRegistry,
        messages: [],
        res: null as any, // We'll handle responses differently for POST-only mode
      })

      safeLogger.info(`Created session ${sessionId} for POST-only client`)

      // Handle the message and return JSON-RPC response directly
      const connection = activeConnections.get(sessionId)!
      await handleJsonRpcMessage(message, connection, res)
      return
    }

    // Not a JSON-RPC message, return error
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const connection = activeConnections.get(sessionId)
  if (!connection) {
    safeLogger.warn(`Session not found: ${sessionId}`)
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const message = req.body
    safeLogger.info(`Received POST to /sse for session ${sessionId}:`, JSON.stringify(message))

    // Process the message and send response via SSE stream
    await handleJsonRpcMessage(message, connection, res)
  } catch (error: any) {
    safeLogger.error('Failed to process message:', error.message || error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// Legacy message endpoint - kept for backward compatibility
app.post('/message', async (req, res) => {
  const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string)

  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId' })
    return
  }

  const connection = activeConnections.get(sessionId)
  if (!connection) {
    safeLogger.warn(`Session not found: ${sessionId}`)
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const message = req.body
    safeLogger.debug(`Received message for session ${sessionId}:`, message)

    // Use the centralized message handler
    await handleJsonRpcMessage(message, connection, res)
  } catch (error: any) {
    safeLogger.error('Failed to process message:', error.message || error)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

// List active sessions
app.get('/sessions', (_req, res) => {
  const sessions = Array.from(activeConnections.keys())
  res.json({
    count: sessions.length,
    sessions,
  })
})

// Start the server
app.listen(PORT, () => {
  safeLogger.info(`SSE/Streamable HTTP server listening on port ${PORT}`)
  safeLogger.info('Endpoints:')
  safeLogger.info(`  GET  /sse      - Establish SSE connection (Streamable HTTP)`)
  safeLogger.info(`  POST /sse      - Send JSON-RPC messages (Streamable HTTP)`)
  safeLogger.info(`  POST /message  - Send JSON-RPC messages (Legacy)`)
  safeLogger.info(`  GET  /health   - Health check`)
  safeLogger.info(`  GET  /sessions - List active sessions`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  safeLogger.info('SIGTERM received, closing all connections...')
  activeConnections.forEach(({ res }) => {
    res.end()
  })
  activeConnections.clear()
  process.exit(0)
})

process.on('SIGINT', () => {
  safeLogger.info('SIGINT received, closing all connections...')
  activeConnections.forEach(({ res }) => {
    res.end()
  })
  activeConnections.clear()
  process.exit(0)
})
