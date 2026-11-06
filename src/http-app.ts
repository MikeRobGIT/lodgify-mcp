/**
 * Express app for the stateless Streamable HTTP transport.
 *
 * A new McpServer + transport is created per request (SDK >= 1.26 refuses to
 * connect() a server that already has a transport, and a shared one risks
 * cross-client response leaks, GHSA-345p-7cg4-v4c7). The Lodgify client is
 * shared so rate-limiter and retry state survive across requests.
 */

import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import { loadEnvironment } from './env.js'
import { LodgifyOrchestrator } from './lodgify-orchestrator.js'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

function tokenMatches(header: string | undefined, token: string): boolean {
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(`Bearer ${token}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res
    .status(405)
    .set('Allow', 'POST')
    .json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed (stateless server: use POST).' },
      id: null,
    })
}

export function createApp(token: string, client?: LodgifyOrchestrator): express.Express {
  let shared = client
  const getShared = (): LodgifyOrchestrator => {
    if (!shared) {
      const config = loadEnvironment()
      shared = new LodgifyOrchestrator({
        apiKey: config.LODGIFY_API_KEY,
        readOnly: config.LODGIFY_READ_ONLY,
        debugHttp: config.DEBUG_HTTP,
      })
    }
    return shared
  }

  const app = express()

  // Health check endpoint (no authentication required)
  app.get('/health', (_req, res) => {
    res.status(200).send('ok')
  })

  // Bearer token authentication for /mcp only
  app.use('/mcp', (req, res, next) => {
    if (!tokenMatches(req.header('authorization'), token)) {
      res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  })

  app.post('/mcp', async (req, res) => {
    try {
      const { server } = setupServer(getShared())
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (err) {
      safeLogger.error('Request handling failed', err)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  })

  app.get('/mcp', methodNotAllowed)
  app.delete('/mcp', methodNotAllowed)

  return app
}
