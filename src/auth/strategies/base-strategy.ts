/**
 * Base authentication strategy abstract class
 */

import type { Request, Response } from 'express'
import { AuthError } from '../errors/auth-error.js'
import { type AuthConfig, AuthErrorType, type AuthUser } from '../types/index.js'

/**
 * Abstract base class for authentication strategies
 */
export abstract class BaseAuthStrategy {
  protected config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * Authenticate a request
   * @param req - Express request object
   * @param res - Express response object
   * @returns Authenticated user or null
   */
  abstract authenticate(req: Request, res: Response): Promise<AuthUser | null>

  /**
   * Validate a token
   * @param token - Token to validate
   * @returns Validated user information
   */
  abstract validateToken(token: string): Promise<AuthUser>

  /**
   * Refresh a token (optional for strategies that support it)
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(_refreshToken: string): Promise<string> {
    throw new AuthError(
      'Token refresh not supported by this strategy',
      AuthErrorType.PROVIDER_ERROR,
    )
  }

  /**
   * Extract token from request
   * @param req - Express request object
   * @returns Token string or null
   */
  protected extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return null
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2) {
      return null
    }

    const [scheme, token] = parts
    if (scheme.toLowerCase() !== 'bearer') {
      return null
    }

    return token
  }

  /**
   * Check if the strategy can handle the request
   * @param req - Express request object
   * @returns True if the strategy can handle the request
   */
  abstract canHandle(req: Request): boolean

  /**
   * Get the authentication type name
   * @returns Authentication type name
   */
  abstract getType(): string

  /**
   * Initialize the strategy (optional)
   * Called once during server startup
   */
  async initialize(): Promise<void> {
    // Override in subclasses if initialization is needed
  }

  /**
   * Cleanup the strategy (optional)
   * Called during server shutdown
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if cleanup is needed
  }
}
