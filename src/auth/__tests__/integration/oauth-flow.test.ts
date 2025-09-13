/**
 * Integration tests for OAuth authentication flow
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import express from 'express'
import { AuthManager } from '../../auth-manager.js'
import { createAuthMiddleware } from '../../middleware/auth-middleware.js'
import { createOAuthRoutes } from '../../routes/oauth-routes.js'
import { OAuthStrategy } from '../../strategies/oauth-strategy.js'
import type { AuthConfig, AuthenticatedRequest } from '../../types/index.js'

describe.skip('OAuth Flow Integration', () => {
  let app: express.Application
  let authManager: AuthManager
  let server: ReturnType<typeof app.listen> | null
  const port = 3333

  const mockConfig: AuthConfig = {
    mode: 'oauth',
    oauth: {
      provider: 'google',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scopes: 'openid profile email',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      userInfoUrl: 'https://auth.example.com/userinfo',
    },
  }

  beforeEach(async () => {
    // Setup express app
    app = express()
    app.use(express.json())

    // Setup auth manager
    authManager = new AuthManager(mockConfig)
    const oauthStrategy = new OAuthStrategy(mockConfig)
    authManager.registerStrategy('oauth', oauthStrategy)
    await authManager.initialize()

    // Setup routes
    const oauthRoutes = createOAuthRoutes(authManager)
    app.use('/auth', oauthRoutes)

    // Protected route
    const authMiddleware = createAuthMiddleware(authManager)
    app.get('/protected', authMiddleware, (req, res) => {
      res.json({ user: (req as AuthenticatedRequest).user })
    })

    // Start server
    server = await new Promise((resolve) => {
      const s = app.listen(port, () => resolve(s))
    })
  })

  afterEach(async () => {
    await authManager.cleanup()
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  describe('Authorization Flow', () => {
    it('should redirect to OAuth provider for authorization', async () => {
      const response = await fetch(`http://localhost:${port}/auth/authorize?return_to=/dashboard`)

      expect(response.status).toBe(302)
      const location = response.headers.get('location')
      expect(location).toContain('https://auth.example.com/authorize')
      expect(location).toContain('response_type=code')
      expect(location).toContain('client_id=test-client-id')
      expect(location).toContain('code_challenge_method=S256')
    })

    it('should include return_to in authorization URL', async () => {
      const response = await fetch(`http://localhost:${port}/auth/authorize?return_to=/custom-page`)

      const location = response.headers.get('location')
      expect(location).toContain('return_to=%2Fcustom-page')
    })
  })

  describe('Callback Handling', () => {
    it('should handle successful callback with code', async () => {
      // Mock token exchange
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'test-access-token',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
        }),
      )
      global.fetch = mockFetch as typeof fetch

      // Mock user info
      const strategy = authManager.strategies.get('oauth') as OAuthStrategy
      strategy.validateToken = mock(() =>
        Promise.resolve({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'oauth' as const,
        }),
      )

      // Setup state
      const state = 'test-state-123'
      ;(strategy as unknown as { stateCache: Map<string, unknown> }).stateCache.set(state, {
        verifier: 'test-verifier-1234567890abcdefghijklmnopqrstuvwxyz',
        redirectUri: `http://localhost:${port}/auth/callback`,
        createdAt: Date.now(),
      })

      const response = await fetch(
        `http://localhost:${port}/auth/callback?code=test-code&state=${state}&return_to=/dashboard`,
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.access_token).toBe('test-access-token')
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe('user-123')
    })

    it('should handle callback error', async () => {
      const response = await fetch(
        `http://localhost:${port}/auth/callback?error=access_denied&error_description=User%20denied%20access`,
      )

      expect(response.status).toBe(302)
      const location = response.headers.get('location')
      expect(location).toContain('error=User%20denied%20access')
    })

    it('should handle missing code or state', async () => {
      const response = await fetch(`http://localhost:${port}/auth/callback?code=test-code`)

      expect(response.status).toBe(302)
      const location = response.headers.get('location')
      expect(location).toContain('error=')
    })
  })

  describe('Token Validation', () => {
    it('should validate valid token', async () => {
      // Mock token validation
      authManager.validateToken = mock(() =>
        Promise.resolve({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'oauth' as const,
          scopes: ['read', 'write'],
        }),
      )

      const response = await fetch(`http://localhost:${port}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.valid).toBe(true)
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe('user-123')
    })

    it('should reject invalid token', async () => {
      authManager.validateToken = mock(() => Promise.reject(new Error('Invalid token')))

      const response = await fetch(`http://localhost:${port}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.valid).toBe(false)
    })

    it('should require token parameter', async () => {
      const response = await fetch(`http://localhost:${port}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.valid).toBe(false)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh access token', async () => {
      // Mock refresh token validation and new token
      const strategy = authManager.strategies.get('oauth') as OAuthStrategy
      strategy.refreshToken = mock(() => Promise.resolve('new-access-token'))
      strategy.validateToken = mock(() =>
        Promise.resolve({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'oauth' as const,
        }),
      )

      const response = await fetch(`http://localhost:${port}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.access_token).toBe('new-access-token')
      expect(data.user).toBeDefined()
    })

    it('should require refresh token', async () => {
      const response = await fetch(`http://localhost:${port}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Protected Route Access', () => {
    it('should allow access with valid token', async () => {
      // Mock authentication
      authManager.authenticate = mock(() =>
        Promise.resolve({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'oauth' as const,
        }),
      )

      const response = await fetch(`http://localhost:${port}/protected`, {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.user).toBeDefined()
      expect(data.user.id).toBe('user-123')
    })

    it('should deny access without token', async () => {
      authManager.authenticate = mock(() => Promise.reject(new Error('No token')))

      const response = await fetch(`http://localhost:${port}/protected`)

      expect(response.status).toBe(401)
    })

    it('should deny access with invalid token', async () => {
      authManager.authenticate = mock(() => Promise.reject(new Error('Invalid token')))

      const response = await fetch(`http://localhost:${port}/protected`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Logout', () => {
    it('should handle logout successfully', async () => {
      const response = await fetch(`http://localhost:${port}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'some-token' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })

    it('should handle logout without refresh token', async () => {
      const response = await fetch(`http://localhost:${port}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('Discovery Endpoint', () => {
    it('should provide OAuth discovery information', async () => {
      const response = await fetch(
        `http://localhost:${port}/auth/.well-known/oauth-authorization-server`,
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.issuer).toBeDefined()
      expect(data.authorization_endpoint).toContain('/auth/authorize')
      expect(data.token_endpoint).toContain('/auth/refresh')
      expect(data.response_types_supported).toContain('code')
      expect(data.grant_types_supported).toContain('authorization_code')
      expect(data.code_challenge_methods_supported).toContain('S256')
    })
  })
})
