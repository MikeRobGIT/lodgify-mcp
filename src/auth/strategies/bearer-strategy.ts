/**
 * Bearer token authentication strategy
 */

import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { AuthError } from '../errors/auth-error.js'
import {
  type AuthConfig,
  AuthErrorType,
  type AuthUser,
  type BearerTokenConfig,
} from '../types/index.js'
import { BaseAuthStrategy } from './base-strategy.js'

/**
 * Simple bearer token authentication strategy
 * Compatible with existing MCP_TOKEN implementation
 */
export class BearerTokenStrategy extends BaseAuthStrategy {
  private bearerConfig: BearerTokenConfig
  private tokenHash: string

  constructor(config: AuthConfig) {
    super(config)

    if (!config.bearer) {
      throw new AuthError(
        'Bearer token configuration is required',
        AuthErrorType.CONFIGURATION_ERROR,
      )
    }

    this.bearerConfig = config.bearer

    // Hash the token for secure comparison
    this.tokenHash = this.hashToken(this.bearerConfig.token)
  }

  /**
   * Hash a token for secure storage and comparison
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Authenticate a request using bearer token
   */
  async authenticate(req: Request, _res: Response): Promise<AuthUser | null> {
    const token = this.extractToken(req)

    if (!token) {
      throw new AuthError('No bearer token provided', AuthErrorType.MISSING_TOKEN)
    }

    // Validate the token
    const user = await this.validateToken(token)
    return user
  }

  /**
   * Validate a bearer token
   */
  async validateToken(token: string): Promise<AuthUser> {
    // Hash the provided token for comparison
    const providedTokenHash = this.hashToken(token)

    // Constant-time comparison to prevent timing attacks
    if (!this.timingSafeEqual(providedTokenHash, this.tokenHash)) {
      throw new AuthError('Invalid bearer token', AuthErrorType.INVALID_TOKEN)
    }

    // Return a simple user object for bearer token auth
    return {
      id: 'bearer-token-user',
      provider: 'bearer',
      // Token doesn't expire in bearer mode
    }
  }

  /**
   * Check if the strategy can handle the request
   */
  canHandle(req: Request): boolean {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return false
    }

    // Check if it's a bearer token
    return authHeader.toLowerCase().startsWith('bearer ')
  }

  /**
   * Get the authentication type name
   */
  getType(): string {
    return 'bearer'
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Create a Bearer strategy from environment variables
   * (for backward compatibility with existing MCP_TOKEN setup)
   */
  static fromEnvironment(): BearerTokenStrategy | null {
    const token = process.env.MCP_TOKEN

    if (!token) {
      return null
    }

    const config: AuthConfig = {
      mode: 'bearer',
      bearer: {
        token,
        headerName: 'authorization',
      },
    }

    return new BearerTokenStrategy(config)
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: BearerTokenConfig): void {
    if (!config.token) {
      throw new AuthError('Bearer token is required', AuthErrorType.CONFIGURATION_ERROR)
    }

    if (config.token.length < 32) {
      throw new AuthError(
        'Bearer token must be at least 32 characters for security',
        AuthErrorType.CONFIGURATION_ERROR,
      )
    }

    // Check for common weak tokens
    const weakTokens = ['password', 'secret', 'token', '12345']
    if (weakTokens.some((weak) => config.token.toLowerCase().includes(weak))) {
      console.warn('Warning: Bearer token appears to be weak. Consider using a stronger token.')
    }
  }
}
