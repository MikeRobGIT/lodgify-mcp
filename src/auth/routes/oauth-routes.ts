/**
 * OAuth authentication routes
 */

import { type NextFunction, type Request, type Response, Router } from 'express'
import type { AuthManager } from '../auth-manager.js'
import { getOAuthCallbackUrl } from '../config/env-loader.js'
import { AuthError } from '../errors/auth-error.js'
import { createOAuthSecurityHeaders } from '../security/headers.js'
import { authRateLimiter } from '../security/rate-limiter.js'
import {
  createRefreshToken,
  DEFAULT_REFRESH_CONFIG,
  revokeRefreshToken,
  useRefreshToken,
} from '../security/token-rotation.js'
import type { OAuthStrategy } from '../strategies/oauth-strategy.js'
import { AuthErrorType, type AuthenticatedRequest } from '../types/index.js'

/**
 * Create OAuth routes
 */
export function createOAuthRoutes(authManager: AuthManager): Router {
  const router = Router()

  // Apply OAuth-specific security headers
  router.use(createOAuthSecurityHeaders())

  // Get OAuth strategy
  const oauthStrategy = authManager.hasStrategy('oauth')
    ? (authManager.getStrategy('oauth') as OAuthStrategy)
    : null

  if (!oauthStrategy) {
    // No OAuth configured, return empty router
    return router
  }

  /**
   * OAuth configuration endpoint for ChatGPT and other clients
   * GET /auth/config
   */
  router.get('/config', (_req: Request, res: Response) => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.HTTP_PORT || 3000}`

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
  })

  /**
   * OAuth authorization endpoint
   * GET /auth/authorize
   */
  router.get(
    '/authorize',
    authRateLimiter.login,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const returnTo = (req.query.return_to as string) || '/'
        const callbackUrl = getOAuthCallbackUrl()

        // Generate authorization URL
        const authUrl = await oauthStrategy.getAuthorizationUrl(callbackUrl)

        // Store session data (in production, use proper session management)
        // For now, we'll use a query parameter (less secure)
        // TODO: Implement proper session store with the session data:
        // const session: OAuthSession = { returnTo }
        const finalAuthUrl = `${authUrl}&return_to=${encodeURIComponent(returnTo)}`

        // Redirect to OAuth provider
        res.redirect(finalAuthUrl)
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * OAuth callback endpoint
   * GET /auth/callback
   */
  router.get('/callback', async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { code, state, error, error_description } = req.query
      const returnTo = (req.query.return_to as string) || '/'

      // Check for OAuth errors
      if (error) {
        throw new AuthError(
          (error_description as string) || 'OAuth authorization failed',
          AuthErrorType.PROVIDER_ERROR,
          { error },
        )
      }

      if (!code || !state) {
        throw new AuthError('Missing authorization code or state', AuthErrorType.INVALID_TOKEN)
      }

      const callbackUrl = getOAuthCallbackUrl()

      // Exchange code for tokens
      const tokens = await oauthStrategy.handleCallback(
        code as string,
        state as string,
        callbackUrl,
      )

      // Validate access token to get user info
      const user = await oauthStrategy.validateToken(tokens.access_token)

      // Create refresh token if we got one from provider
      let refreshTokenId: string | undefined
      if (tokens.refresh_token) {
        refreshTokenId = createRefreshToken(
          user.id,
          'oauth-client', // In production, use actual client ID
          DEFAULT_REFRESH_CONFIG.moderate,
          tokens.scope,
        )
      }

      // Create session response
      const sessionData = {
        access_token: tokens.access_token,
        token_type: 'Bearer',
        expires_in: tokens.expires_in,
        refresh_token: refreshTokenId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      }

      // In production, store session and return session ID
      // For now, return tokens directly (less secure)
      res.json({
        success: true,
        ...sessionData,
        return_to: returnTo,
      })
    } catch (error) {
      // OAuth error, redirect to error page
      const returnTo = (req.query.return_to as string) || '/'
      const errorMessage = error instanceof AuthError ? error.message : 'Authentication failed'

      res.redirect(`${returnTo}?error=${encodeURIComponent(errorMessage)}`)
    }
  })

  /**
   * Token refresh endpoint
   * POST /auth/refresh
   */
  router.post(
    '/refresh',
    authRateLimiter.refresh,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { refresh_token } = req.body

        if (!refresh_token) {
          throw new AuthError('Refresh token required', AuthErrorType.MISSING_TOKEN)
        }

        // Use refresh token
        const tokenData = useRefreshToken(refresh_token, DEFAULT_REFRESH_CONFIG.moderate)

        // Get new access token from OAuth provider
        const newAccessToken = await oauthStrategy.refreshToken(refresh_token)

        // Validate new token to get user info
        const user = await oauthStrategy.validateToken(newAccessToken)

        res.json({
          access_token: newAccessToken,
          token_type: 'Bearer',
          refresh_token: tokenData.newTokenId || refresh_token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        })
      } catch (error) {
        next(error)
      }
    },
  )

  /**
   * Token validation endpoint
   * POST /auth/validate
   */
  router.post(
    '/validate',
    authRateLimiter.tokenValidation,
    async (req: Request, res: Response, _next: NextFunction) => {
      try {
        const { token } = req.body

        if (!token) {
          throw new AuthError('Token required', AuthErrorType.MISSING_TOKEN)
        }

        // Validate token
        const user = await authManager.validateToken(token, 'oauth')

        res.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            scopes: user.scopes,
          },
        })
      } catch (error) {
        // Token is invalid
        res.json({
          valid: false,
          error: error instanceof AuthError ? error.type : 'INVALID_TOKEN',
        })
      }
    },
  )

  /**
   * Logout endpoint
   * POST /auth/logout
   */
  router.post('/logout', async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    try {
      const { refresh_token } = req.body

      if (refresh_token) {
        // Revoke refresh token
        revokeRefreshToken(refresh_token, 'User logout')
      }

      // Clear any session data
      // In production, destroy server-side session

      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    } catch (_error) {
      // Logout should always succeed from user perspective
      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    }
  })

  /**
   * OAuth discovery endpoint
   * GET /.well-known/oauth-authorization-server
   */
  router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`

    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/auth/authorize`,
      token_endpoint: `${baseUrl}/auth/refresh`,
      token_endpoint_auth_methods_supported: ['none'], // Public client
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_introspection_endpoint: `${baseUrl}/auth/validate`,
      revocation_endpoint: `${baseUrl}/auth/logout`,
    })
  })

  return router
}

/**
 * Error handler for OAuth routes
 */
export function oauthErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AuthError) {
    const wwwAuth = err.getWWWAuthenticateHeader()
    if (wwwAuth) {
      res.setHeader('WWW-Authenticate', wwwAuth)
    }

    res.status(err.statusCode).json({
      error: err.type,
      error_description: err.message,
      ...(process.env.NODE_ENV === 'development' && { details: err.details }),
    })
  } else {
    console.error('OAuth error:', err)
    res.status(500).json({
      error: 'server_error',
      error_description: 'An unexpected error occurred',
    })
  }
}
