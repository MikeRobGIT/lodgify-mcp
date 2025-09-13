/**
 * Security tests for token rotation and breach detection
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  cleanupRefreshTokens,
  createRefreshToken,
  DEFAULT_REFRESH_CONFIG,
  destroyAllRefreshTokens,
  type RefreshTokenConfig,
  refreshTokenStore,
  revokeRefreshToken,
  useRefreshToken,
} from '../../security/token-rotation.js'

describe('Token Rotation Security', () => {
  beforeEach(() => {
    // Clean up any existing tokens
    destroyAllRefreshTokens()
  })

  afterEach(() => {
    // Clean up after each test
    destroyAllRefreshTokens()
  })

  describe('Refresh Token Creation', () => {
    it('should create a unique refresh token', () => {
      const token1 = createRefreshToken('user-1', 'client-1', DEFAULT_REFRESH_CONFIG.strict)
      const token2 = createRefreshToken('user-1', 'client-1', DEFAULT_REFRESH_CONFIG.strict)

      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
      expect(token1.length).toBeGreaterThan(40)
    })

    it('should track token families', () => {
      const parentToken = createRefreshToken('user-1', 'client-1', DEFAULT_REFRESH_CONFIG.strict)
      const tokenData = useRefreshToken(parentToken, DEFAULT_REFRESH_CONFIG.strict)

      // Token rotation should produce a new token ID when rotateOnUse is true
      expect(tokenData.newTokenId).toBeDefined()
      expect(tokenData.userId).toBe('user-1')
      expect(tokenData.clientId).toBe('client-1')
    })

    it('should store token metadata', () => {
      const scopes = ['read', 'write']
      const token = createRefreshToken(
        'user-1',
        'client-1',
        DEFAULT_REFRESH_CONFIG.moderate,
        scopes,
      )

      expect(refreshTokenStore.isRevoked(token)).toBe(false)
    })
  })

  describe('Token Rotation', () => {
    it('should rotate tokens on use', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const originalToken = createRefreshToken('user-1', 'client-1', config)

      const result = useRefreshToken(originalToken, config)

      expect(result.newTokenId).toBeDefined()
      expect(result.newTokenId).not.toBe(originalToken)
      expect(result.userId).toBe('user-1')
    })

    it('should revoke old token after rotation', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const originalToken = createRefreshToken('user-1', 'client-1', config)

      const result = useRefreshToken(originalToken, config)

      // Original token should be revoked (check via store)
      expect(refreshTokenStore.isRevoked(originalToken)).toBe(true)

      // New token should be valid (check via store)
      if (!result.newTokenId) {
        throw new Error('Expected newTokenId to be defined')
      }
      expect(refreshTokenStore.isRevoked(result.newTokenId)).toBe(false)
    })

    it('should maintain token family through rotations', () => {
      const config = DEFAULT_REFRESH_CONFIG.moderate
      let currentToken = createRefreshToken('user-1', 'client-1', config)

      // Rotate multiple times
      for (let i = 0; i < 5; i++) {
        const result = useRefreshToken(currentToken, config)
        expect(result.newTokenId).toBeDefined()
        expect(result.userId).toBe('user-1')
        expect(result.clientId).toBe('client-1')
        if (!result.newTokenId) {
          throw new Error('Expected newTokenId to be defined')
        }
        currentToken = result.newTokenId
      }
    })

    it('should respect rotation requirement configuration', () => {
      const config: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.moderate,
        rotateOnUse: false,
      }

      const token = createRefreshToken('user-1', 'client-1', config)
      const result = useRefreshToken(token, config)

      // When rotation not required, same token can be reused
      expect(result.newTokenId).toBeUndefined()

      // Token should still be valid
      expect(refreshTokenStore.isRevoked(token)).toBe(false)
    })
  })

  describe('Breach Detection', () => {
    it('should detect reuse of rotated token', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const originalToken = createRefreshToken('user-1', 'client-1', config)

      // First use - normal rotation
      const firstUse = useRefreshToken(originalToken, config)
      expect(firstUse.newTokenId).toBeDefined()

      // Second use of same token - breach detection
      expect(() => {
        useRefreshToken(originalToken, config)
      }).toThrow('Refresh token has been revoked')
    })

    it('should revoke entire token family on breach', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const token1 = createRefreshToken('user-1', 'client-1', config)

      // Create a family of tokens
      const result1 = useRefreshToken(token1, config)
      if (!result1.newTokenId) {
        throw new Error('Expected newTokenId to be defined')
      }
      const token2 = result1.newTokenId
      const result2 = useRefreshToken(token2, config)
      if (!result2.newTokenId) {
        throw new Error('Expected newTokenId to be defined')
      }
      const token3 = result2.newTokenId

      // Attempt to reuse token2 (breach)
      try {
        useRefreshToken(token2, config)
      } catch (_e) {
        // Expected error
      }

      // All tokens in family should be revoked
      expect(refreshTokenStore.isRevoked(token1)).toBe(true)
      expect(refreshTokenStore.isRevoked(token2)).toBe(true)
      expect(refreshTokenStore.isRevoked(token3)).toBe(true)
    })

    it('should track breach attempts', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const token = createRefreshToken('user-1', 'client-1', config)

      // Use and rotate
      const _result = useRefreshToken(token, config)

      // Attempt breach
      let breachDetected = false
      try {
        useRefreshToken(token, config)
      } catch (e) {
        const error = e as Error
        breachDetected =
          error.message.includes('Refresh token has been revoked') ||
          error.message.includes('reuse')
      }

      expect(breachDetected).toBe(true)
    })
  })

  describe('Token Expiration', () => {
    it('should expire tokens after TTL', async () => {
      const config: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.moderate,
        expiresIn: 0.1, // 100ms in seconds for testing
      }

      const token = createRefreshToken('user-1', 'client-1', config)

      // Token should be valid initially
      expect(refreshTokenStore.isRevoked(token)).toBe(false)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Token should be expired
      expect(() => {
        useRefreshToken(token, config)
      }).toThrow('Refresh token has expired')
    })

    it('should handle different expiration times', () => {
      const configs = [
        { ...DEFAULT_REFRESH_CONFIG.strict, expiresIn: 1 }, // 1 second
        { ...DEFAULT_REFRESH_CONFIG.moderate, expiresIn: 60 }, // 1 minute
        { ...DEFAULT_REFRESH_CONFIG.lenient, expiresIn: 3600 }, // 1 hour
      ]

      for (const config of configs) {
        const token = createRefreshToken('user-1', `client-${config.expiresIn}`, config)
        expect(refreshTokenStore.isRevoked(token)).toBe(false)
      }
    })
  })

  describe('Revocation', () => {
    it('should revoke individual tokens', () => {
      const token = createRefreshToken('user-1', 'client-1', DEFAULT_REFRESH_CONFIG.moderate)

      expect(refreshTokenStore.isRevoked(token)).toBe(false)

      revokeRefreshToken(token, 'Manual revocation')

      expect(refreshTokenStore.isRevoked(token)).toBe(true)
    })

    it('should revoke token families', () => {
      const config = DEFAULT_REFRESH_CONFIG.moderate
      const token1 = createRefreshToken('user-1', 'client-1', config)

      // Create family
      const result1 = useRefreshToken(token1, config)
      if (!result1.newTokenId) {
        throw new Error('Expected newTokenId to be defined')
      }
      const token2 = result1.newTokenId

      const result2 = useRefreshToken(token2, config)
      if (!result2.newTokenId) {
        throw new Error('Expected newTokenId to be defined')
      }
      const token3 = result2.newTokenId

      // Get the family ID from the store (the tokens share the same family)
      const tokenData = refreshTokenStore.get(token2)
      const familyId = tokenData?.family

      if (!familyId) {
        throw new Error('Family ID not found')
      }

      // Revoke entire family (using store method)
      refreshTokenStore.revokeFamily(familyId, 'Family revocation test')

      // All tokens should be revoked
      expect(refreshTokenStore.isRevoked(token1)).toBe(true)
      expect(refreshTokenStore.isRevoked(token2)).toBe(true)
      expect(refreshTokenStore.isRevoked(token3)).toBe(true)
    })

    it('should prevent use of revoked tokens', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const token = createRefreshToken('user-1', 'client-1', config)

      revokeRefreshToken(token, 'Test revocation')

      expect(() => {
        useRefreshToken(token, config)
      }).toThrow('Refresh token has been revoked')
    })
  })

  describe('Security Configuration', () => {
    it('should enforce strict mode settings', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict

      expect(config.rotateOnUse).toBe(true)
      expect(config.reuseWindow).toBe(0)
      expect(config.maxReuse).toBe(0)
      expect(config.family).toBe(true)
    })

    it('should allow moderate mode settings', () => {
      const config = DEFAULT_REFRESH_CONFIG.moderate

      expect(config.rotateOnUse).toBe(true)
      expect(config.reuseWindow).toBe(60)
      expect(config.maxReuse).toBe(1)
      expect(config.family).toBe(true)
    })

    it('should support relaxed mode settings', () => {
      const config = DEFAULT_REFRESH_CONFIG.lenient

      expect(config.rotateOnUse).toBe(false)
      expect(config.reuseWindow).toBe(300)
      expect(config.maxReuse).toBe(5)
      expect(config.family).toBe(false)
    })

    it('should enforce reuse limits', () => {
      const config: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.strict,
        rotateOnUse: false, // Disable rotation for this test
        maxReuse: 2,
        reuseWindow: 60, // Allow reuse within 60 seconds
      }

      const token = createRefreshToken('user-1', 'client-1', config)

      // First use
      const result1 = useRefreshToken(token, config)
      expect(result1.userId).toBe('user-1')

      // Second use within window should work
      const result2 = useRefreshToken(token, config)
      expect(result2.userId).toBe('user-1')

      // Third use within window should work (maxReuse = 2)
      const result3 = useRefreshToken(token, config)
      expect(result3.userId).toBe('user-1')

      // Fourth reuse should fail (exceeds maxReuse)
      expect(() => {
        useRefreshToken(token, config)
      }).toThrow('Refresh token reuse limit exceeded')
    })
  })

  describe('Cleanup', () => {
    it('should clean up expired tokens', () => {
      const config: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.moderate,
        expiresIn: 0.05, // 50ms in seconds
      }

      // Create multiple tokens
      const tokens: string[] = []
      for (let i = 0; i < 10; i++) {
        tokens.push(createRefreshToken(`user-${i}`, 'client-1', config))
      }

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cleanupRefreshTokens()

          // All tokens should be cleaned up
          for (const token of tokens) {
            expect(() => {
              useRefreshToken(token, config)
            }).toThrow()
          }

          resolve()
        }, 100)
      })
    })

    it('should preserve valid tokens during cleanup', () => {
      const shortConfig: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.moderate,
        expiresIn: 0.05, // 50ms in seconds
      }

      const longConfig: RefreshTokenConfig = {
        ...DEFAULT_REFRESH_CONFIG.moderate,
        expiresIn: 10, // 10 seconds
      }

      const expiredToken = createRefreshToken('user-1', 'client-1', shortConfig)
      const validToken = createRefreshToken('user-2', 'client-2', longConfig)

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          cleanupRefreshTokens()

          // Expired token should be gone
          expect(() => {
            useRefreshToken(expiredToken, shortConfig)
          }).toThrow()

          // Valid token should still work
          expect(() => {
            useRefreshToken(validToken, longConfig)
          }).not.toThrow()

          resolve()
        }, 100)
      })
    })
  })

  describe('Attack Scenarios', () => {
    it('should prevent token prediction attacks', () => {
      const tokens = new Set<string>()

      // Generate many tokens
      for (let i = 0; i < 100; i++) {
        const token = createRefreshToken(`user-${i}`, 'client-1', DEFAULT_REFRESH_CONFIG.strict)
        tokens.add(token)
      }

      // All tokens should be unique
      expect(tokens.size).toBe(100)

      // Tokens should have sufficient entropy
      const tokenArray = Array.from(tokens)
      for (const token of tokenArray) {
        expect(token.length).toBeGreaterThan(40)
        // Should contain alphanumeric and special characters
        expect(/[a-zA-Z0-9+/=]/.test(token)).toBe(true)
      }
    })

    it('should prevent replay attacks', () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const token = createRefreshToken('user-1', 'client-1', config)

      // First use succeeds
      const result = useRefreshToken(token, config)
      expect(result.newTokenId).toBeDefined()

      // Replay attempt fails
      expect(() => {
        useRefreshToken(token, config)
      }).toThrow('Refresh token has been revoked')
    })

    it('should handle concurrent token use attempts', async () => {
      const config = DEFAULT_REFRESH_CONFIG.strict
      const token = createRefreshToken('user-1', 'client-1', config)

      // Simulate concurrent use attempts
      const attempts = Array(5)
        .fill(null)
        .map(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                try {
                  const result = useRefreshToken(token, config)
                  resolve({ success: true, result })
                } catch (e) {
                  resolve({ success: false, error: e })
                }
              }, Math.random() * 10)
            }),
        )

      const results = await Promise.all(attempts)

      // Only one should succeed
      const successes = results.filter((r: unknown) => (r as { success: boolean }).success)
      expect(successes.length).toBe(1)

      // Others should fail with revocation error
      const failures = results.filter((r: unknown) => !(r as { success: boolean }).success)
      expect(failures.length).toBe(4)
    })
  })
})
