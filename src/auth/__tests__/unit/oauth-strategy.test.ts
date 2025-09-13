/**
 * Unit tests for OAuth Authentication Strategy
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Request, Response } from 'express'
import { AuthError } from '../../errors/auth-error.js'
import { OAuthStrategy } from '../../strategies/oauth-strategy.js'
import { AuthErrorType } from '../../types/index.js'

describe('OAuthStrategy', () => {
  let strategy: OAuthStrategy
  const mockConfig = {
    mode: 'oauth' as const,
    oauth: {
      provider: 'google' as const,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scopes: 'openid profile email',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      userInfoUrl: 'https://auth.example.com/userinfo',
    },
  }

  beforeEach(() => {
    strategy = new OAuthStrategy(mockConfig)
  })

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(strategy).toBeDefined()
    })

    it('should throw error without OAuth config', () => {
      expect(() => {
        new OAuthStrategy({ mode: 'oauth' } as AuthConfig)
      }).toThrow('OAuth configuration is required')
    })

    it('should throw error without client ID', () => {
      const badConfig = {
        mode: 'oauth' as const,
        oauth: {
          ...mockConfig.oauth,
          clientId: '',
        },
      }
      expect(() => {
        new OAuthStrategy(badConfig)
      }).toThrow('OAuth client ID required')
    })

    it('should throw error without client secret', () => {
      const badConfig = {
        mode: 'oauth' as const,
        oauth: {
          ...mockConfig.oauth,
          clientSecret: '',
        },
      }
      expect(() => {
        new OAuthStrategy(badConfig)
      }).toThrow('OAuth client secret required')
    })
  })

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE', async () => {
      const url = await strategy.getAuthorizationUrl('http://localhost:3000/callback')

      expect(url).toContain(mockConfig.oauth.authorizationUrl)
      expect(url).toContain('response_type=code')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('scope=openid+profile+email')
      expect(url).toContain('state=')
      expect(url).toContain('code_challenge=')
      expect(url).toContain('code_challenge_method=S256')
    })

    it('should include custom scopes', async () => {
      const customStrategy = new OAuthStrategy({
        ...mockConfig,
        oauth: {
          ...mockConfig.oauth,
          scopes: 'custom scope1 scope2',
        },
      })

      const url = await customStrategy.getAuthorizationUrl('http://localhost:3000/callback')
      expect(url).toContain('scope=custom+scope1+scope2')
    })
  })

  describe('authenticate', () => {
    it('should authenticate with valid bearer token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'oauth' as const,
      }

      // Mock validateToken
      strategy.validateToken = mock(() => Promise.resolve(mockUser))

      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      } as Request
      const res = {} as Response

      const user = await strategy.authenticate(req, res)
      expect(user).toEqual(mockUser)
    })

    it('should throw error without authorization header', async () => {
      const req = {
        headers: {},
      } as Request
      const res = {} as Response

      await expect(strategy.authenticate(req, res)).rejects.toThrow('No access token provided')
    })

    it('should throw error with invalid token', async () => {
      strategy.validateToken = mock(() =>
        Promise.reject(new AuthError('Invalid token', AuthErrorType.INVALID_TOKEN)),
      )

      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      } as Request
      const res = {} as Response

      await expect(strategy.authenticate(req, res)).rejects.toThrow('Invalid token')
    })
  })

  describe('handleCallback', () => {
    it('should handle callback with valid code and state', async () => {
      // Mock fetch for token exchange
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              expires_in: 3600,
              token_type: 'Bearer',
              scope: 'openid profile email',
            }),
        }),
      )

      global.fetch = mockFetch as typeof fetch

      // Generate state and code verifier
      const state = 'test-state'
      const codeVerifier = 'test-verifier-1234567890abcdefghijklmnopqrstuvwxyz'

      // Store in state cache (normally done in getAuthorizationUrl)
      ;(strategy as unknown as { sessions: Map<string, unknown> }).sessions.set(state, {
        state,
        pkce: { codeVerifier, codeChallenge: 'test-challenge' },
        redirectUri: 'http://localhost:3000/callback',
        createdAt: new Date(),
      })

      const tokens = await strategy.handleCallback(
        'test-code',
        state,
        'http://localhost:3000/callback',
      )

      expect(tokens).toBeDefined()
      expect(tokens.access_token).toBe('access-token')
      expect(tokens.refresh_token).toBe('refresh-token')
      expect(tokens.expires_in).toBe(3600)
    })

    it('should throw error with invalid state', async () => {
      await expect(
        strategy.handleCallback('code', 'invalid-state', 'http://localhost:3000/callback'),
      ).rejects.toThrow('Invalid or expired OAuth state')
    })

    it('should throw error with expired state', async () => {
      const state = 'expired-state'
      ;(strategy as unknown as { sessions: Map<string, unknown> }).sessions.set(state, {
        state,
        pkce: { codeVerifier: 'verifier', codeChallenge: 'challenge' },
        redirectUri: 'http://localhost:3000/callback',
        createdAt: new Date(Date.now() - 11 * 60 * 1000), // 11 minutes ago
      })

      await expect(
        strategy.handleCallback('code', state, 'http://localhost:3000/callback'),
      ).rejects.toThrow('Invalid or expired OAuth state')
    })

    it('should throw error with mismatched redirect URI', async () => {
      const state = 'test-state'
      ;(strategy as unknown as { sessions: Map<string, unknown> }).sessions.set(state, {
        state,
        pkce: { codeVerifier: 'verifier', codeChallenge: 'challenge' },
        redirectUri: 'http://localhost:3000/callback',
        createdAt: new Date(),
      })

      await expect(
        strategy.handleCallback('code', state, 'http://localhost:3000/different'),
      ).rejects.toThrow('Redirect URI mismatch')
    })
  })

  describe('validateToken', () => {
    it('should validate token with userinfo endpoint', async () => {
      // Create a mock JWT token (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url')
      const signature = 'mock-signature'
      const mockJWT = `${header}.${payload}.${signature}`

      const user = await strategy.validateToken(mockJWT)

      expect(user).toBeDefined()
      expect(user.id).toBe('user-123')
      expect(user.email).toBe('test@example.com')
      expect(user.name).toBe('Test User')
      expect(user.provider).toBe('oauth')
    })

    it('should throw error for invalid token', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        }),
      )

      global.fetch = mockFetch as typeof fetch

      await expect(strategy.validateToken('invalid-token')).rejects.toThrow(AuthError)
    })
  })

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600,
            }),
        }),
      )

      global.fetch = mockFetch as typeof fetch

      const newToken = await strategy.refreshToken('refresh-token')

      expect(newToken).toBe('new-access-token')
    })

    it('should throw error for invalid refresh token', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        }),
      )

      global.fetch = mockFetch as typeof fetch

      await expect(strategy.refreshToken('invalid-refresh')).rejects.toThrow(
        'Failed to exchange code for tokens',
      )
    })
  })

  describe('cleanup', () => {
    it('should clear state cache on cleanup', async () => {
      // Add some state
      ;(strategy as unknown as { sessions: Map<string, unknown> }).sessions.set('state1', {
        state: 'state1',
        pkce: { codeVerifier: 'v1', codeChallenge: 'c1' },
        redirectUri: 'r1',
        createdAt: new Date(),
      })
      ;(strategy as unknown as { sessions: Map<string, unknown> }).sessions.set('state2', {
        state: 'state2',
        pkce: { codeVerifier: 'v2', codeChallenge: 'c2' },
        redirectUri: 'r2',
        createdAt: new Date(),
      })

      expect((strategy as unknown as { sessions: Map<string, unknown> }).sessions.size).toBe(2)

      await strategy.cleanup()

      expect((strategy as unknown as { sessions: Map<string, unknown> }).sessions.size).toBe(0)
    })
  })
})
