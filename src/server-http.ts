#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server using Streamable HTTP transport
 * Runs in stateless mode — new server+transport per request (SDK pattern)
 */

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import cors from 'cors'
import { config } from 'dotenv'
import type { Request, Response } from 'express'
import express from 'express'
// Signal HTTP transport BEFORE any other imports so logger initializes
// for stdout output. ESM hoists imports above top-level statements, so this
// must be done in a bootstrap module imported first.
import './http-bootstrap.js'

import { loadEnvironment } from './env.js'
import { LodgifyOrchestrator } from './lodgify-orchestrator.js'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3000
const AUTH_TOKEN = process.env.MCP_TOKEN

// JSON-RPC 2.0 spec: id may be string, number, or null
function isJsonRpcId(value: unknown): value is string | number | null {
  return typeof value === 'string' || typeof value === 'number' || value === null
}

// Fail fast if auth token is not configured
if (!AUTH_TOKEN) {
  try {
    safeLogger.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
  } catch (error) {
    console.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
    console.error('Logger initialization error:', error)
  }
  process.exit(1)
}

async function main() {
  const app = express()

  // JSON body parsing (required for stateless mode — transport reads req.body)
  app.use(express.json())

  // CORS middleware
  app.use(
    cors({
      origin: '*',
      methods: 'GET,POST,DELETE',
      preflightContinue: false,
      optionsSuccessStatus: 204,
      allowedHeaders: ['Content-Type', 'authorization'],
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

  // Shared API client — stateless across requests
  const envConfig = loadEnvironment()
  const sharedClient = new LodgifyOrchestrator({
    apiKey: envConfig.LODGIFY_API_KEY,
    readOnly: envConfig.LODGIFY_READ_ONLY,
    debugHttp: envConfig.DEBUG_HTTP,
  })

  // POST /mcp - Handle all MCP requests (new server+transport per request)
  app.post('/mcp', async (req: Request, res: Response) => {
    const { server, cleanup } = setupServer(sharedClient)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    })

    // Idempotent teardown — registered before handleRequest to avoid the race
    // where a fast response closes before the listener attaches, leaking the
    // per-request server/transport pair under load.
    let torndown = false
    const teardown = async () => {
      if (torndown) return
      torndown = true
      try {
        await transport.close()
      } catch {
        // ignore
      }
      try {
        await cleanup()
      } catch {
        // ignore
      }
      try {
        await server.close()
      } catch {
        // ignore
      }
    }
    res.on('close', () => {
      void teardown()
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      // Pass error details as a serializable shape so JSON.stringify in the
      // logger preserves message/stack (Error fields are non-enumerable).
      safeLogger.error('Request handling failed', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      })
      if (!res.headersSent) {
        // JSON-RPC 2.0: echo request id when parseable, otherwise null
        const requestId = isJsonRpcId(req.body?.id) ? req.body.id : null
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: requestId,
        })
      }
      await teardown()
    }
  })

  // GET /mcp - Not applicable in stateless mode
  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    })
  })

  // DELETE /mcp - Not applicable in stateless mode
  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    })
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    safeLogger.info('Shutting down server...')
    process.exit(0)
  })

  app.listen(PORT, () => {
    safeLogger.info(`HTTP MCP server listening on port ${PORT} (stateless mode)`)
  })
}

main().catch((error) => {
  try {
    safeLogger.error('Failed to start HTTP server', error)
  } catch (logError) {
    console.error('Failed to start HTTP server', error)
    console.error('Logger error:', logError)
  }
  process.exit(1)
})
