/**
 * Unit tests for Bearer Token Authentication Strategy
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import type { Request, Response } from 'express'
import { AuthError } from '../../errors/auth-error.js'
import { BearerTokenStrategy } from '../../strategies/bearer-strategy.js'
import type { AuthConfig } from '../../types/index.js'

describe('BearerTokenStrategy', () => {
  let strategy: BearerTokenStrategy
  const validToken = 'test-token-1234567890abcdefghijklmnop'

  beforeEach(() => {
    strategy = new BearerTokenStrategy({
      mode: 'bearer',
      bearer: { token: validToken },
    })
  })

  describe('constructor', () => {
    it('should create instance with valid token', () => {
      expect(strategy).toBeDefined()
    })

    it('should create instance even with short token', () => {
      // Note: The actual implementation doesn't validate token length in constructor
      const shortStrategy = new BearerTokenStrategy({
        mode: 'bearer',
        bearer: { token: 'short' },
      })
      expect(shortStrategy).toBeDefined()
    })

    it('should throw error without bearer config', () => {
      expect(() => {
        new BearerTokenStrategy({
          mode: 'bearer',
        } as AuthConfig)
      }).toThrow('Bearer token configuration is required')
    })
  })

  describe('authenticate', () => {
    it('should authenticate with valid bearer token', async () => {
      const req = {
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      } as Request
      const res = {} as Response

      const user = await strategy.authenticate(req, res)
      expect(user).toBeDefined()
      expect(user?.id).toBe('bearer-token-user')
      expect(user?.provider).toBe('bearer')
    })

    it('should throw error with missing authorization header', async () => {
      const req = {
        headers: {},
      } as Request
      const res = {} as Response

      await expect(strategy.authenticate(req, res)).rejects.toThrow('No bearer token provided')
    })

    it('should throw error with invalid bearer format', async () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      } as Request
      const res = {} as Response

      await expect(strategy.authenticate(req, res)).rejects.toThrow('No bearer token provided')
    })

    it('should throw error with incorrect token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer wrong-token-1234567890abcdefghijklmnop',
        },
      } as Request
      const res = {} as Response

      await expect(strategy.authenticate(req, res)).rejects.toThrow('Invalid bearer token')
    })

    it('should handle case-insensitive bearer prefix', async () => {
      const req = {
        headers: {
          authorization: `bearer ${validToken}`,
        },
      } as Request
      const res = {} as Response

      const user = await strategy.authenticate(req, res)
      expect(user).toBeDefined()
      expect(user?.id).toBe('bearer-token-user')
    })
  })

  describe('validateToken', () => {
    it('should validate correct token', async () => {
      const user = await strategy.validateToken(validToken)
      expect(user).toBeDefined()
      expect(user.id).toBe('bearer-token-user')
      expect(user.provider).toBe('bearer')
    })

    it('should throw error for invalid token', async () => {
      await expect(
        strategy.validateToken('invalid-token-1234567890abcdefghijklmnop'),
      ).rejects.toThrow(AuthError)
    })

    it('should throw error for empty token', async () => {
      await expect(strategy.validateToken('')).rejects.toThrow(AuthError)
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(strategy.initialize()).resolves.toBeUndefined()
    })
  })

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await expect(strategy.cleanup()).resolves.toBeUndefined()
    })
  })

  describe('fromEnvironment', () => {
    it('should create from MCP_TOKEN environment variable', () => {
      process.env.MCP_TOKEN = validToken
      const envStrategy = BearerTokenStrategy.fromEnvironment()
      expect(envStrategy).toBeDefined()
      delete process.env.MCP_TOKEN
    })

    it('should return null without MCP_TOKEN', () => {
      delete process.env.MCP_TOKEN
      const envStrategy = BearerTokenStrategy.fromEnvironment()
      expect(envStrategy).toBeNull()
    })
  })
})
