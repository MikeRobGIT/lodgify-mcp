/**
 * Express authentication middleware
 */

import type { NextFunction, Request, Response } from 'express'
import type { AuthManager } from '../auth-manager.js'
import { AuthError, isAuthError } from '../errors/auth-error.js'
import { AuthErrorType, type AuthenticatedRequest } from '../types/index.js'

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(authManager: AuthManager) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // If auth is disabled globally, bypass authentication
      if (authManager.getMode && authManager.getMode() === 'none') {
        return next()
      }

      // Skip authentication for health check and public endpoints
      if (isPublicEndpoint(req.path)) {
        return next()
      }

      // Authenticate the request
      const user = await authManager.authenticate(req, res)

      // Attach user to request
      req.user = user

      next()
    } catch (error) {
      handleAuthError(error, res)
    }
  }
}

/**
 * Create optional authentication middleware
 * Attempts authentication but doesn't fail if not authenticated
 */
export function createOptionalAuthMiddleware(authManager: AuthManager) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // If auth is disabled globally, bypass authentication
      if (authManager.getMode && authManager.getMode() === 'none') {
        return next()
      }

      // Skip authentication for health check and public endpoints
      if (isPublicEndpoint(req.path)) {
        return next()
      }

      // Try to authenticate but don't fail
      try {
        const user = await authManager.authenticate(req, res)
        req.user = user
      } catch (_error) {
        // Authentication failed, but that's okay for optional auth
        // Just continue without setting req.user
      }

      next()
    } catch (error) {
      // Only handle unexpected errors
      if (!isAuthError(error)) {
        handleAuthError(error, res)
      } else {
        next()
      }
    }
  }
}

/**
 * Create scope validation middleware
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return handleAuthError(
        new AuthError('Authentication required', AuthErrorType.MISSING_TOKEN),
        res,
      )
    }

    const userScopes = req.user.scopes || []
    const hasRequiredScope = requiredScopes.some((scope) => userScopes.includes(scope))

    if (!hasRequiredScope) {
      return handleAuthError(
        new AuthError(
          `Insufficient scope. Required: ${requiredScopes.join(' or ')}`,
          AuthErrorType.INSUFFICIENT_SCOPE,
        ),
        res,
      )
    }

    next()
  }
}

/**
 * Check if endpoint is public (no auth required)
 */
function isPublicEndpoint(path: string): boolean {
  const publicPaths = [
    '/health',
    '/auth/login',
    '/auth/callback',
    '/auth/authorize',
    '/.well-known/oauth-authorization-server',
    '/favicon.ico',
  ]

  return publicPaths.some((publicPath) => path.startsWith(publicPath))
}

/**
 * Handle authentication errors
 */
function handleAuthError(error: unknown, res: Response): void {
  if (isAuthError(error)) {
    const authError = error as AuthError

    // Set WWW-Authenticate header if available
    const wwwAuth = authError.getWWWAuthenticateHeader()
    if (wwwAuth) {
      res.setHeader('WWW-Authenticate', wwwAuth)
    }

    res.status(authError.statusCode).json({
      error: authError.type,
      message: authError.message,
      ...(process.env.NODE_ENV === 'development' && { details: authError.details }),
    })
  } else {
    // Generic error
    console.error('Authentication error:', error)
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during authentication',
    })
  }
}

/**
 * Extract bearer token from request
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }

  return parts[1]
}

/**
 * Create a middleware to log authentication events
 */
export function createAuthLoggingMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now()

    // Log after response
    res.on('finish', () => {
      const duration = Date.now() - startTime
      const authStatus = req.user ? 'authenticated' : 'anonymous'
      const userId = req.user?.id || 'unknown'
      const provider = req.user?.provider || 'none'

      console.log({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        authStatus,
        userId,
        provider,
        statusCode: res.statusCode,
        duration,
      })
    })

    next()
  }
}
