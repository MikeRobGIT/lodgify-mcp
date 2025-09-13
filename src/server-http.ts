#!/usr/bin/env node

/**
 * HTTP entrypoint for Lodgify MCP server with dual authentication support
 */

import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { config } from 'dotenv'
import express from 'express'
// Authentication imports
import { AuthManager } from './auth/auth-manager.js'
import { loadAuthConfig, validateAuthConfig } from './auth/config/env-loader.js'
import {
  createAuthLoggingMiddleware,
  createAuthMiddleware,
} from './auth/middleware/auth-middleware.js'
import { createOAuthRoutes, oauthErrorHandler } from './auth/routes/oauth-routes.js'
import { applySecurityMiddleware } from './auth/security/index.js'
import { cleanupRateLimiter } from './auth/security/rate-limiter.js'
import { cleanupRefreshTokens } from './auth/security/token-rotation.js'
import { BearerTokenStrategy } from './auth/strategies/bearer-strategy.js'
import { OAuthStrategy } from './auth/strategies/oauth-strategy.js'
import type { AuthenticatedRequest } from './auth/types/index.js'
import { safeLogger } from './logger.js'
import { setupServer } from './mcp/server-setup.js'

// Load environment variables
config()

const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HTTP_HOST || '0.0.0.0'

// Session TTL configuration (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000

interface SessionInfo {
  transport: StreamableHTTPServerTransport
  timer: NodeJS.Timeout
}

async function main() {
  // Load authentication configuration
  let authConfig = loadAuthConfig()

  if (!authConfig) {
    // Fallback to legacy bearer token for backward compatibility
    const legacyToken = process.env.MCP_TOKEN
    if (!legacyToken) {
      safeLogger.error(
        'No authentication configured. Set AUTH_MODE and provide appropriate credentials.',
      )
      safeLogger.error(
        'For backward compatibility, you can set MCP_TOKEN for bearer authentication.',
      )
      process.exit(1)
    }

    // Create legacy bearer config
    authConfig = {
      mode: 'bearer',
      bearer: { token: legacyToken },
    }
    safeLogger.warn(
      'Using legacy MCP_TOKEN authentication. Consider migrating to AUTH_MODE configuration.',
    )
  }

  // Validate configuration
  try {
    validateAuthConfig(authConfig)
  } catch (error) {
    safeLogger.error('Invalid authentication configuration', error)
    process.exit(1)
  }

  // Initialize authentication manager
  const authManager = new AuthManager(authConfig)

  // Register authentication strategies based on mode
  if (authConfig.mode === 'none') {
    safeLogger.warn('⚠️  Authentication disabled (AUTH_MODE=none) - FOR DEVELOPMENT ONLY')
  } else {
    if (authConfig.mode === 'bearer' || authConfig.mode === 'dual') {
      if (authConfig.bearer) {
        const bearerStrategy = new BearerTokenStrategy(authConfig)
        authManager.registerStrategy('bearer', bearerStrategy)
        safeLogger.info('Bearer token authentication enabled')
      }
    }

    if (authConfig.mode === 'oauth' || authConfig.mode === 'dual') {
      if (authConfig.oauth) {
        const oauthStrategy = new OAuthStrategy(authConfig)
        authManager.registerStrategy('oauth', oauthStrategy)
        safeLogger.info('OAuth authentication enabled')
      }
    }
  }

  // Initialize strategies
  await authManager.initialize()

  // Setup MCP server
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

  // Create Express app
  const app = express()

  // Parse JSON bodies
  app.use(express.json())

  // Apply security middleware (CORS, headers, rate limiting)
  applySecurityMiddleware(app)

  // Authentication logging (optional, for debugging)
  if (process.env.LOG_LEVEL === 'debug') {
    app.use(createAuthLoggingMiddleware())
  }

  // Health check endpoint (no authentication required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      auth: {
        mode: authConfig.mode,
        strategies: authManager.getStrategyNames(),
      },
      timestamp: new Date().toISOString(),
    })
  })

  // OAuth routes (if OAuth is enabled)
  if (authConfig.mode === 'oauth' || authConfig.mode === 'dual') {
    const oauthRoutes = createOAuthRoutes(authManager)
    app.use('/auth', oauthRoutes)
    safeLogger.info('OAuth endpoints available at /auth/*')

    // Add well-known OAuth discovery endpoint for ChatGPT compatibility
    app.get(
      '/.well-known/oauth-authorization-server',
      (_req: express.Request, res: express.Response) => {
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`

        res.json({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/auth/authorize`,
          token_endpoint: `${baseUrl}/auth/token`,
          userinfo_endpoint: `${baseUrl}/auth/userinfo`,
          revocation_endpoint: `${baseUrl}/auth/revoke`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          scopes_supported: ['openid', 'profile', 'email'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
          claims_supported: ['sub', 'email', 'name', 'picture'],
          subject_types_supported: ['public'],
        })
      },
    )
  }

  // Create authentication middleware
  const authMiddleware = createAuthMiddleware(authManager)

  // Apply authentication to MCP endpoint
  app.use('/mcp', authMiddleware)

  // MCP endpoint handler
  app.all('/mcp', async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const sessionId = (req.header('mcp-session-id') || randomUUID()).trim()
      let sessionInfo = sessions.get(sessionId)

      if (!sessionInfo) {
        // Create new session with undefined sessionIdGenerator to run in stateless mode
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Use stateless mode
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
        safeLogger.debug(`New session created: ${sessionId} for user: ${req.user?.id}`)
      } else {
        // Reset TTL for existing session
        resetSessionTimer(sessionId)
        safeLogger.debug(`Session reused: ${sessionId} for user: ${req.user?.id}`)
      }

      await sessionInfo.transport.handleRequest(req, res)
    } catch (err) {
      safeLogger.error('Request handling failed', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // OAuth error handler
  app.use(oauthErrorHandler)

  // Global error handler
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      safeLogger.error('Unhandled error', err)
      res.status(500).json({ error: 'Internal server error' })
    },
  )

  // Start server
  const httpServer = app.listen(PORT, HOST, () => {
    safeLogger.info(`HTTP MCP server listening on http://${HOST}:${PORT}`)
    safeLogger.info(`Authentication mode: ${authConfig.mode}`)

    if (authConfig.mode === 'oauth' || authConfig.mode === 'dual') {
      safeLogger.info(`OAuth authorization: http://${HOST}:${PORT}/auth/authorize`)
      safeLogger.info(`OAuth callback: http://${HOST}:${PORT}/auth/callback`)
    }
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    safeLogger.info('SIGTERM received, shutting down gracefully')

    // Close server
    httpServer.close(() => {
      safeLogger.info('HTTP server closed')
    })

    // Cleanup sessions
    for (const sessionId of sessions.keys()) {
      cleanupSession(sessionId)
    }

    // Cleanup auth resources
    await authManager.cleanup()
    cleanupRateLimiter()
    cleanupRefreshTokens()

    process.exit(0)
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
