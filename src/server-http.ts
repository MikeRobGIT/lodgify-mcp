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
import { loadEnvironment } from './env.js'
import { LodgifyOrchestrator } from './lodgify-orchestrator.js'
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
    try {
      const { server, cleanup } = setupServer(sharedClient)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      })

      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)

      res.on('close', async () => {
        await transport.close()
        await cleanup()
        await server.close()
      })
    } catch (err) {
      safeLogger.error('Request handling failed', err)
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
