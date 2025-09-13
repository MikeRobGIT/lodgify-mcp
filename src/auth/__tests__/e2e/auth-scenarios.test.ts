/**
 * End-to-end tests for authentication scenarios
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { type Subprocess, spawn } from 'bun'

describe.skip('E2E Authentication Scenarios', () => {
  let serverProcess: Subprocess | null = null
  const serverPort = 3334
  const serverUrl = `http://localhost:${serverPort}`

  // Helper to start server with specific config
  async function startServer(authMode: string, additionalEnv: Record<string, string> = {}) {
    // Stop existing server if running
    if (serverProcess) {
      serverProcess.kill()
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Start new server
    serverProcess = spawn({
      cmd: ['bun', 'src/server-http.ts'],
      env: {
        ...process.env,
        PORT: serverPort.toString(),
        AUTH_MODE: authMode,
        ...additionalEnv,
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill()
    }
  })

  describe('Bearer Token Mode', () => {
    beforeAll(async () => {
      await startServer('bearer', {
        AUTH_BEARER_TOKEN: 'test-bearer-token-1234567890abcdefghijklmnop',
      })
    })

    it('should accept valid bearer token', async () => {
      const response = await fetch(`${serverUrl}/health`, {
        headers: {
          Authorization: 'Bearer test-bearer-token-1234567890abcdefghijklmnop',
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('ok')
      expect(data.auth.mode).toBe('bearer')
    })

    it('should reject invalid bearer token', async () => {
      const response = await fetch(`${serverUrl}/mcp`, {
        headers: {
          Authorization: 'Bearer invalid-token-1234567890abcdefghijklmnop',
        },
      })

      expect(response.status).toBe(401)
    })

    it('should reject missing authorization header', async () => {
      const response = await fetch(`${serverUrl}/mcp`)
      expect(response.status).toBe(401)
    })
  })

  describe('OAuth Mode', () => {
    beforeAll(async () => {
      await startServer('oauth', {
        OAUTH_PROVIDER: 'google',
        OAUTH_CLIENT_ID: 'test-client-id',
        OAUTH_CLIENT_SECRET: 'test-client-secret',
        OAUTH_SCOPES: 'openid profile email',
        SESSION_SECRET: 'test-session-secret-1234567890abcdefghijklmnop',
        BASE_URL: serverUrl,
      })
    })

    it('should provide OAuth discovery endpoint', async () => {
      const response = await fetch(`${serverUrl}/auth/.well-known/oauth-authorization-server`)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.authorization_endpoint).toBeDefined()
      expect(data.token_endpoint).toBeDefined()
    })

    it('should redirect to authorization endpoint', async () => {
      const response = await fetch(`${serverUrl}/auth/authorize`, {
        redirect: 'manual',
      })

      expect(response.status).toBe(302)
      const location = response.headers.get('location')
      expect(location).toContain('accounts.google.com')
    })

    it('should reject access without token', async () => {
      const response = await fetch(`${serverUrl}/mcp`)
      expect(response.status).toBe(401)
    })

    it('should validate token endpoint', async () => {
      const response = await fetch(`${serverUrl}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'test-token' }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.valid).toBe(false)
    })
  })

  describe('Dual Mode', () => {
    beforeAll(async () => {
      await startServer('dual', {
        AUTH_BEARER_TOKEN: 'test-bearer-token-1234567890abcdefghijklmnop',
        OAUTH_PROVIDER: 'google',
        OAUTH_CLIENT_ID: 'test-client-id',
        OAUTH_CLIENT_SECRET: 'test-client-secret',
        OAUTH_SCOPES: 'openid profile email',
        SESSION_SECRET: 'test-session-secret-1234567890abcdefghijklmnop',
        BASE_URL: serverUrl,
      })
    })

    it('should accept bearer token', async () => {
      const response = await fetch(`${serverUrl}/health`, {
        headers: {
          Authorization: 'Bearer test-bearer-token-1234567890abcdefghijklmnop',
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.auth.mode).toBe('dual')
      expect(data.auth.strategies).toContain('bearer')
      expect(data.auth.strategies).toContain('oauth')
    })

    it('should provide OAuth endpoints', async () => {
      const response = await fetch(`${serverUrl}/auth/.well-known/oauth-authorization-server`)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.authorization_endpoint).toBeDefined()
    })

    it('should reject invalid bearer token', async () => {
      const response = await fetch(`${serverUrl}/mcp`, {
        headers: {
          Authorization: 'Bearer wrong-token',
        },
      })

      expect(response.status).toBe(401)
    })

    it('should support both auth methods simultaneously', async () => {
      // Bearer token should work
      const bearerResponse = await fetch(`${serverUrl}/health`, {
        headers: {
          Authorization: 'Bearer test-bearer-token-1234567890abcdefghijklmnop',
        },
      })
      expect(bearerResponse.status).toBe(200)

      // OAuth endpoints should also work
      const oauthResponse = await fetch(`${serverUrl}/auth/authorize`, {
        redirect: 'manual',
      })
      expect(oauthResponse.status).toBe(302)
    })
  })

  describe('Migration Scenarios', () => {
    it('should support legacy MCP_TOKEN', async () => {
      await startServer('', {
        MCP_TOKEN: 'legacy-token-1234567890abcdefghijklmnop',
      })

      const response = await fetch(`${serverUrl}/health`, {
        headers: {
          Authorization: 'Bearer legacy-token-1234567890abcdefghijklmnop',
        },
      })

      expect(response.status).toBe(200)
    })

    it('should prefer AUTH_MODE over MCP_TOKEN', async () => {
      await startServer('oauth', {
        MCP_TOKEN: 'legacy-token-1234567890abcdefghijklmnop',
        OAUTH_PROVIDER: 'google',
        OAUTH_CLIENT_ID: 'test-client-id',
        OAUTH_CLIENT_SECRET: 'test-client-secret',
        SESSION_SECRET: 'test-session-secret-1234567890abcdefghijklmnop',
        BASE_URL: serverUrl,
      })

      // Should be in OAuth mode, not bearer
      const response = await fetch(`${serverUrl}/health`)
      const data = await response.json()
      expect(data.auth.mode).toBe('oauth')
      expect(data.auth.strategies).not.toContain('bearer')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const testProcess = spawn({
        cmd: ['bun', 'src/server-http.ts'],
        env: {
          ...process.env,
          PORT: '3335',
          AUTH_MODE: 'oauth',
          // Missing OAuth config
        },
        stdio: ['inherit', 'pipe', 'pipe'],
      })

      // Wait for process to exit
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Process should have exited with error
      expect(testProcess.exitCode).toBe(1)
    })
  })

  describe('Security Headers', () => {
    beforeAll(async () => {
      await startServer('bearer', {
        AUTH_BEARER_TOKEN: 'test-bearer-token-1234567890abcdefghijklmnop',
      })
    })

    it('should include security headers', async () => {
      const response = await fetch(`${serverUrl}/health`)

      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should handle CORS properly', async () => {
      const response = await fetch(`${serverUrl}/health`, {
        headers: {
          Origin: 'http://example.com',
        },
      })

      // Default CORS should allow the request
      expect(response.status).toBe(200)
    })
  })
})
