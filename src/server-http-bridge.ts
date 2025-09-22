#!/usr/bin/env bun

/**
 * HTTP to MCP Bridge Server
 * Creates a simple HTTP endpoint that proxies requests to a standard MCP server
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import express from 'express'

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3076
const AUTH_TOKEN = process.env.MCP_TOKEN

// Console logger for HTTP mode debugging
const consoleLogger = {
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[WARN] ${message}`, ...args),
  info: (message: string, ...args: unknown[]) => console.info(`[INFO] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  },
}

// Fail fast if auth token is not configured
if (!AUTH_TOKEN) {
  consoleLogger.error('MCP_TOKEN is not set. HTTP server requires an authentication token.')
  process.exit(1)
}

// Session management
interface Session {
  id: string
  mcpProcess: ChildProcess
  initialized: boolean
  createdAt: Date
}

const sessions = new Map<string, Session>()
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

async function main() {
  const app = express()

  // Parse JSON bodies
  app.use(express.json())

  // Health check endpoint
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
      consoleLogger.debug(`${req.method} request to /mcp`)
      consoleLogger.debug('Headers:', req.headers)
      consoleLogger.debug('Body:', req.body)

      // Check for session ID
      let sessionId = req.header('mcp-session-id')
      let session: Session | undefined

      if (sessionId) {
        session = sessions.get(sessionId)
        if (!session) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid session ID',
            },
            id: null,
          })
          return
        }
      }

      // Handle initialize request - create new session
      if (req.body?.method === 'initialize') {
        consoleLogger.info('Creating new session for initialize request')

        sessionId = randomUUID()

        // Spawn a new MCP server process using Bun
        const mcpProcess = spawn('bun', ['dist/server.js'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: process.env,
          cwd: '/app',
        })

        session = {
          id: sessionId,
          mcpProcess,
          initialized: false,
          createdAt: new Date(),
        }

        sessions.set(sessionId, session)

        // Set up cleanup timer
        setTimeout(() => {
          if (sessionId && sessions.has(sessionId)) {
            consoleLogger.debug(`Cleaning up session ${sessionId}`)
            const s = sessions.get(sessionId)
            if (s) {
              s.mcpProcess.kill()
              sessions.delete(sessionId)
            }
          }
        }, SESSION_TTL_MS)

        // Wait for MCP server to start and send initialize
        return new Promise<void>((resolve, reject) => {
          let response = ''
          const timeout = setTimeout(() => {
            consoleLogger.error('Initialize timeout')
            reject(new Error('Initialize timeout'))
          }, 10000)

          session?.mcpProcess.stdout?.on('data', (data: Buffer) => {
            response += data.toString()
            consoleLogger.debug('MCP stdout:', data.toString())

            // Look for complete JSON-RPC response
            const lines = response.split('\n')
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const jsonResponse = JSON.parse(line.trim())
                  if (jsonResponse.id === req.body.id && session && sessionId) {
                    clearTimeout(timeout)
                    session.initialized = true
                    res.setHeader('mcp-session-id', sessionId)
                    res.json(jsonResponse)
                    resolve()
                    return
                  }
                } catch (_e) {
                  // Ignore parsing errors, continue collecting data
                }
              }
            }
          })

          session?.mcpProcess.stderr?.on('data', (data: Buffer) => {
            consoleLogger.error('MCP Process Error:', data.toString())
          })

          session?.mcpProcess.on('error', (error: Error) => {
            clearTimeout(timeout)
            consoleLogger.error('MCP Process spawn error:', error)
            reject(error)
          })

          session?.mcpProcess.on('exit', (code: number | null) => {
            clearTimeout(timeout)
            if (code !== 0) {
              consoleLogger.error(`MCP Process exited with code ${code}`)
              reject(new Error(`Process exited with code ${code}`))
            }
          })

          // Send the initialize request to the MCP server
          const request = `${JSON.stringify(req.body)}\n`
          session?.mcpProcess.stdin?.write(request)
        })
      }

      // Handle notifications (don't need a response)
      if (req.body?.method === 'notifications/initialized') {
        consoleLogger.debug('Received notifications/initialized')
        if (session?.initialized) {
          // Forward to MCP process
          const request = `${JSON.stringify(req.body)}\n`
          session.mcpProcess.stdin?.write(request)
        }
        // Notifications don't expect a response
        res.status(200).end()
        return
      }

      // Handle GET requests (for SSE endpoints)
      if (req.method === 'GET') {
        consoleLogger.debug('Handling GET request')
        res.status(200).json({ status: 'ok', message: 'MCP Bridge Server' })
        return
      }

      // Handle DELETE requests (session cleanup)
      if (req.method === 'DELETE') {
        consoleLogger.debug('Handling DELETE request for session cleanup')
        if (session && sessionId) {
          consoleLogger.info(`Cleaning up session ${sessionId} via DELETE`)
          session.mcpProcess.kill()
          sessions.delete(sessionId)
        }
        res.status(200).json({ status: 'deleted' })
        return
      }

      // Handle other requests on existing session
      if (!session || !session.initialized) {
        consoleLogger.warn(
          `No initialized session found for ${req.method} ${req.body?.method}. Session ID: ${sessionId}`,
        )
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'No initialized session found. Call initialize first.',
          },
          id: req.body?.id || null,
        })
        return
      }

      // Forward request to MCP process
      return new Promise<void>((resolve) => {
        let response = ''
        const requestId = req.body?.id
        consoleLogger.debug(`Forwarding request: ${req.body?.method} (ID: ${requestId})`)

        const timeout = setTimeout(() => {
          consoleLogger.error(`Request timeout for ${req.body?.method} (ID: ${requestId})`)
          res.status(408).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Request timeout',
            },
            id: requestId,
          })
          resolve()
        }, 30000) // 30 second timeout

        const dataHandler = (data: Buffer) => {
          response += data.toString()
          consoleLogger.debug(`MCP response data: ${data.toString().trim()}`)

          // Look for complete JSON-RPC response
          const lines = response.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              try {
                const jsonResponse = JSON.parse(line.trim())
                // Match by ID or if it's a notification response
                if (jsonResponse.id === requestId || (jsonResponse.method && !requestId)) {
                  clearTimeout(timeout)
                  res.json(jsonResponse)
                  session?.mcpProcess.stdout?.removeListener('data', dataHandler)
                  resolve()
                  return
                }
              } catch (_e) {
                // Continue collecting data
              }
            }
          }
        }

        session.mcpProcess.stdout?.on('data', dataHandler)

        session.mcpProcess.on('error', (error: Error) => {
          clearTimeout(timeout)
          consoleLogger.error('MCP process error during request:', error)
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: `MCP process error: ${error.message}`,
            },
            id: requestId,
          })
          resolve()
        })

        // Send request
        try {
          const request = `${JSON.stringify(req.body)}\n`
          session.mcpProcess.stdin?.write(request)
          consoleLogger.debug(`Sent to MCP process: ${request.trim()}`)
        } catch (error) {
          clearTimeout(timeout)
          consoleLogger.error('Error sending request to MCP process:', error)
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Failed to send request to MCP process',
            },
            id: requestId,
          })
          resolve()
        }
      })
    } catch (err) {
      consoleLogger.error('Request handling failed', err)
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: req.body?.id || null,
      })
    }
  })

  app.listen(PORT, () => {
    consoleLogger.info(`HTTP to MCP Bridge server listening on port ${PORT}`)
  })
}

main().catch((error) => {
  consoleLogger.error('Failed to start HTTP bridge server', error)
  process.exit(1)
})
