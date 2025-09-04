#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server using Streamable HTTP transport
 */

import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { config } from 'dotenv'
import express from 'express'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

// Load environment variables without polluting stdout
const originalConsoleLog = console.log
console.log = () => {}
config()
console.log = originalConsoleLog

const PORT = Number(process.env.PORT) || 3000
const AUTH_TOKEN = process.env.MCP_TOKEN

async function main() {
  const { server } = setupServer()
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  const app = express()

  // Simple bearer token authentication
  app.use((req, res, next) => {
    if (!AUTH_TOKEN) {
      res.status(401).send('Unauthorized')
      return
    }
    const auth = req.header('authorization')
    if (auth !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).send('Unauthorized')
      return
    }
    next()
  })

  app.get('/health', (_req, res) => {
    res.status(200).send('ok')
  })

  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = req.header('mcp-session-id') || randomUUID()
      let transport = sessions.get(sessionId)
      if (!transport) {
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        transport.sessionId = sessionId
        sessions.set(sessionId, transport)
        transport.onclose = () => {
          sessions.delete(sessionId)
        }
        await server.connect(transport)
      }
      await transport.handleRequest(req, res)
    } catch (err) {
      safeLogger.error('Request handling failed', err)
      res.status(500).end()
    }
  })

  app.listen(PORT, () => {
    safeLogger.info(`HTTP MCP server listening on port ${PORT}`)
  })
}

main().catch((error) => {
  safeLogger.error('Failed to start HTTP server', error)
  process.exit(1)
})
