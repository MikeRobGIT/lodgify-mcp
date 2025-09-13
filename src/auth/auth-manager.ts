/**
 * Authentication manager for handling multiple authentication strategies
 */

import type { Request, Response } from 'express'
import { AuthError } from './errors/auth-error.js'
import type { BaseAuthStrategy } from './strategies/base-strategy.js'
import {
  type AuthConfig,
  AuthErrorType,
  type AuthenticatedRequest,
  type AuthMode,
  type AuthUser,
} from './types/index.js'

/**
 * Authentication manager that coordinates multiple authentication strategies
 */
export class AuthManager {
  private strategies: Map<string, BaseAuthStrategy> = new Map()
  private mode: AuthMode
  private initialized: boolean = false

  constructor(config: AuthConfig) {
    this.mode = config.mode
  }

  /**
   * Register an authentication strategy
   */
  registerStrategy(name: string, strategy: BaseAuthStrategy): void {
    this.strategies.set(name, strategy)
  }

  /**
   * Initialize all registered strategies
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    for (const strategy of this.strategies.values()) {
      await strategy.initialize()
    }

    this.initialized = true
  }

  /**
   * Cleanup all registered strategies
   */
  async cleanup(): Promise<void> {
    for (const strategy of this.strategies.values()) {
      await strategy.cleanup()
    }

    this.initialized = false
  }

  /**
   * Authenticate a request using the appropriate strategy
   */
  async authenticate(req: AuthenticatedRequest, res: Response): Promise<AuthUser> {
    // If authentication is disabled, return anonymous user
    if (this.mode === 'none') {
      return {
        id: 'anonymous',
        email: 'anonymous@localhost',
        name: 'Anonymous User',
        provider: 'none',
        scopes: [],
      }
    }

    // Check which strategies can handle the request
    const availableStrategies = this.getAvailableStrategies(req)

    if (availableStrategies.length === 0) {
      throw new AuthError('No authentication token provided', AuthErrorType.MISSING_TOKEN)
    }

    // Try each available strategy
    const errors: AuthError[] = []
    for (const strategy of availableStrategies) {
      try {
        const user = await strategy.authenticate(req, res)
        if (user) {
          req.user = user
          return user
        }
      } catch (error) {
        if (error instanceof AuthError) {
          errors.push(error)
        } else {
          errors.push(new AuthError('Authentication failed', AuthErrorType.PROVIDER_ERROR, error))
        }
      }
    }

    // If we get here, all strategies failed
    if (errors.length > 0) {
      // Return the most specific error
      const priorityError = this.getPriorityError(errors)
      throw priorityError
    }

    throw new AuthError('Authentication failed', AuthErrorType.INVALID_CREDENTIALS)
  }

  /**
   * Get strategies that can handle the request based on mode
   */
  private getAvailableStrategies(req: Request): BaseAuthStrategy[] {
    const available: BaseAuthStrategy[] = []

    switch (this.mode) {
      case 'bearer': {
        const bearerStrategy = this.strategies.get('bearer')
        if (bearerStrategy?.canHandle(req)) {
          available.push(bearerStrategy)
        }
        break
      }

      case 'oauth': {
        const oauthStrategy = this.strategies.get('oauth')
        if (oauthStrategy?.canHandle(req)) {
          available.push(oauthStrategy)
        }
        break
      }

      case 'dual':
        // Try both strategies in dual mode
        for (const [_name, strategy] of this.strategies) {
          if (strategy.canHandle(req)) {
            available.push(strategy)
          }
        }
        break

      case 'none':
        // No strategies available when authentication is disabled
        break
    }

    return available
  }

  /**
   * Get the highest priority error from a list of errors
   */
  private getPriorityError(errors: AuthError[]): AuthError {
    // Priority order for error types
    const errorPriority = [
      AuthErrorType.EXPIRED_TOKEN,
      AuthErrorType.INVALID_TOKEN,
      AuthErrorType.INSUFFICIENT_SCOPE,
      AuthErrorType.INVALID_CREDENTIALS,
      AuthErrorType.MISSING_TOKEN,
      AuthErrorType.PROVIDER_ERROR,
      AuthErrorType.CONFIGURATION_ERROR,
    ]

    let highestPriorityError = errors[0]
    let highestPriority = errorPriority.indexOf(highestPriorityError.type)

    for (const error of errors) {
      const priority = errorPriority.indexOf(error.type)
      if (priority !== -1 && (highestPriority === -1 || priority < highestPriority)) {
        highestPriority = priority
        highestPriorityError = error
      }
    }

    return highestPriorityError
  }

  /**
   * Validate a token using the appropriate strategy
   */
  async validateToken(token: string, strategyName?: string): Promise<AuthUser> {
    if (strategyName) {
      const strategy = this.strategies.get(strategyName)
      if (!strategy) {
        throw new AuthError(`Strategy ${strategyName} not found`, AuthErrorType.CONFIGURATION_ERROR)
      }
      return strategy.validateToken(token)
    }

    // Try all strategies if no specific one is specified
    const errors: AuthError[] = []
    for (const strategy of this.strategies.values()) {
      try {
        return await strategy.validateToken(token)
      } catch (error) {
        if (error instanceof AuthError) {
          errors.push(error)
        }
      }
    }

    if (errors.length > 0) {
      throw this.getPriorityError(errors)
    }

    throw new AuthError('Token validation failed', AuthErrorType.INVALID_TOKEN)
  }

  /**
   * Refresh a token using the appropriate strategy
   */
  async refreshToken(refreshToken: string, strategyName: string): Promise<string> {
    const strategy = this.strategies.get(strategyName)
    if (!strategy) {
      throw new AuthError(`Strategy ${strategyName} not found`, AuthErrorType.CONFIGURATION_ERROR)
    }

    return strategy.refreshToken(refreshToken)
  }

  /**
   * Get the current authentication mode
   */
  getMode(): AuthMode {
    return this.mode
  }

  /**
   * Get all registered strategy names
   */
  getStrategyNames(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * Check if a specific strategy is registered
   */
  hasStrategy(name: string): boolean {
    return this.strategies.has(name)
  }

  /**
   * Get a registered strategy
   */
  getStrategy(name: string): BaseAuthStrategy | undefined {
    return this.strategies.get(name)
  }
}
