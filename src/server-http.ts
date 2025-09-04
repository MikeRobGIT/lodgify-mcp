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

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3000
const AUTH_TOKEN = process.env.MCP_TOKEN

// Fail fast if auth token is not configured
if (!AUTH_TOKEN) {
  safeLogger.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
  process.exit(1)
}

// Session TTL configuration (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000

interface SessionInfo {
  transport: StreamableHTTPServerTransport
  timer: NodeJS.Timeout
}

async function main() {
  const { server } = setupServer()
  const sessions = new Map<string, SessionInfo>()

  // Helper function to clean up a session
  const cleanupSession = (sessionId: string) => {
    const session = sessions.get(sessionId)
    if (session) {
      clearTimeout(session.timer)
      session.transport.close?.()
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

  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = (req.header('mcp-session-id') || randomUUID()).trim()
      let sessionInfo = sessions.get(sessionId)

      if (!sessionInfo) {
        // Create new session with proper sessionId configuration
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
        })

        // Set up cleanup timer
        const timer = setTimeout(() => cleanupSession(sessionId), SESSION_TTL_MS)

        sessionInfo = { transport, timer }
        sessions.set(sessionId, sessionInfo)

        // Set up onclose handler
        transport.onclose = () => {
          cleanupSession(sessionId)
        }

        await server.connect(transport)
        safeLogger.debug(`New session created: ${sessionId}`)
      } else {
        // Reset TTL for existing session
        resetSessionTimer(sessionId)
        safeLogger.debug(`Session reused: ${sessionId}`)
      }

      await sessionInfo.transport.handleRequest(req, res)
    } catch (err) {
      safeLogger.error('Request handling failed', err)
      res.status(500).json({ error: 'Internal server error' })
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
