/**
 * OAuth 2.1 authentication strategy with PKCE support
 */

import type { Request, Response } from 'express'
import * as jose from 'jose'
import { AuthError } from '../errors/auth-error.js'
import {
  type AuthConfig,
  AuthErrorType,
  type AuthenticatedRequest,
  type AuthUser,
  type JWTPayload,
  type OAuthAuthorizationParams,
  type OAuthProviderConfig,
  type OAuthTokenParams,
  type OAuthTokenResponse,
  type PKCEParams,
} from '../types/index.js'
import { decodeJWT, extractUserFromJWT, validateJWTClaims } from '../utils/jwt.js'
import { generateNonce, generatePKCE, generateState } from '../utils/pkce.js'
import { BaseAuthStrategy } from './base-strategy.js'

// Session storage for OAuth state and PKCE parameters
interface OAuthSession {
  state: string
  pkce: PKCEParams
  nonce?: string
  redirectUri: string
  createdAt: Date
}

// OAuth Discovery Document interface
interface OAuthDiscoveryDocument {
  issuer?: string
  authorization_endpoint?: string
  token_endpoint?: string
  jwks_uri?: string
  introspection_endpoint?: string
  [key: string]: unknown
}

/**
 * OAuth 2.1 authentication strategy with PKCE
 */
export class OAuthStrategy extends BaseAuthStrategy {
  private oauthConfig: OAuthProviderConfig
  private sessions: Map<string, OAuthSession> = new Map()
  private jwksClient?: ReturnType<typeof jose.createRemoteJWKSet>
  private discoveryDocument?: OAuthDiscoveryDocument

  constructor(config: AuthConfig) {
    super(config)

    if (!config.oauth) {
      throw new AuthError('OAuth configuration is required', AuthErrorType.CONFIGURATION_ERROR)
    }

    this.oauthConfig = config.oauth

    if (!this.oauthConfig.clientId) {
      throw new AuthError('OAuth client ID required', AuthErrorType.CONFIGURATION_ERROR)
    }

    if (!this.oauthConfig.clientSecret) {
      throw new AuthError('OAuth client secret required', AuthErrorType.CONFIGURATION_ERROR)
    }
  }

  /**
   * Initialize the OAuth strategy
   */
  async initialize(): Promise<void> {
    // If discovery URL is provided, fetch configuration
    if (this.oauthConfig.discoveryUrl) {
      await this.fetchDiscoveryDocument()
    }

    // Initialize JWKS client for token validation
    if (this.oauthConfig.jwksUrl) {
      this.jwksClient = jose.createRemoteJWKSet(new URL(this.oauthConfig.jwksUrl))
    }
  }

  /**
   * Fetch OAuth discovery document
   */
  private async fetchDiscoveryDocument(): Promise<void> {
    try {
      if (!this.oauthConfig.discoveryUrl) {
        throw new Error('Discovery URL is not configured')
      }
      const response = await fetch(this.oauthConfig.discoveryUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch discovery document: ${response.statusText}`)
      }

      this.discoveryDocument = (await response.json()) as OAuthDiscoveryDocument

      // Update configuration from discovery document
      if (this.discoveryDocument.authorization_endpoint) {
        this.oauthConfig.authorizationUrl = this.discoveryDocument.authorization_endpoint
      }
      if (this.discoveryDocument.token_endpoint) {
        this.oauthConfig.tokenUrl = this.discoveryDocument.token_endpoint
      }
      if (this.discoveryDocument.jwks_uri) {
        this.oauthConfig.jwksUrl = this.discoveryDocument.jwks_uri
        this.jwksClient = jose.createRemoteJWKSet(new URL(this.discoveryDocument.jwks_uri))
      }
      if (this.discoveryDocument.issuer) {
        this.oauthConfig.issuer = this.discoveryDocument.issuer
      }
    } catch (error) {
      throw new AuthError(
        'Failed to fetch OAuth discovery document',
        AuthErrorType.PROVIDER_ERROR,
        error,
      )
    }
  }

  /**
   * Generate authorization URL with PKCE
   */
  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const state = generateState()
    const pkce = generatePKCE()
    const nonce = generateNonce()

    // Store session data
    const session: OAuthSession = {
      state,
      pkce,
      nonce,
      redirectUri,
      createdAt: new Date(),
    }
    this.sessions.set(state, session)

    // Clean up old sessions (older than 10 minutes)
    this.cleanupSessions()

    // Build authorization URL
    const params: OAuthAuthorizationParams = {
      client_id: this.oauthConfig.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: Array.isArray(this.oauthConfig.scopes)
        ? this.oauthConfig.scopes.join(' ')
        : this.oauthConfig.scopes || 'openid profile email',
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
    }

    // Add audience if configured (for Auth0 and similar providers)
    if (this.oauthConfig.audience) {
      params.audience = Array.isArray(this.oauthConfig.audience)
        ? this.oauthConfig.audience.join(' ')
        : this.oauthConfig.audience
    }

    const url = new URL(this.oauthConfig.authorizationUrl)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })

    return url.toString()
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<OAuthTokenResponse> {
    // Verify state parameter
    const session = this.sessions.get(state)
    if (!session) {
      throw new AuthError('Invalid or expired OAuth state', AuthErrorType.INVALID_TOKEN)
    }

    // Check if session has expired (10 minute timeout)
    const sessionAge = Date.now() - session.createdAt.getTime()
    if (sessionAge > 10 * 60 * 1000) {
      this.sessions.delete(state)
      throw new AuthError('Invalid or expired OAuth state', AuthErrorType.INVALID_TOKEN)
    }

    // Remove session to prevent reuse
    this.sessions.delete(state)

    // Verify redirect URI matches
    if (session.redirectUri !== redirectUri) {
      throw new AuthError('Redirect URI mismatch', AuthErrorType.INVALID_TOKEN)
    }

    // Exchange authorization code for tokens
    const tokenParams: OAuthTokenParams = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      code_verifier: session.pkce.codeVerifier,
    }

    const tokenResponse = await this.exchangeCodeForTokens(tokenParams)

    // Validate the ID token if present
    if (tokenResponse.id_token) {
      await this.validateIdToken(tokenResponse.id_token, session.nonce)
    }

    return tokenResponse
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(params: OAuthTokenParams): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(this.oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params as unknown as Record<string, string>).toString(),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new AuthError(
          'Failed to exchange code for tokens',
          AuthErrorType.PROVIDER_ERROR,
          error,
        )
      }

      const tokens = (await response.json()) as OAuthTokenResponse
      return tokens
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      throw new AuthError('Failed to exchange code for tokens', AuthErrorType.PROVIDER_ERROR, error)
    }
  }

  /**
   * Validate ID token
   */
  private async validateIdToken(idToken: string, expectedNonce?: string): Promise<JWTPayload> {
    try {
      if (!this.jwksClient) {
        throw new AuthError('JWKS client not initialized', AuthErrorType.CONFIGURATION_ERROR)
      }

      // Verify JWT signature and claims
      const { payload } = await jose.jwtVerify(idToken, this.jwksClient, {
        issuer: this.oauthConfig.issuer,
        audience: this.oauthConfig.clientId,
      })

      // Verify nonce if present
      if (expectedNonce && payload.nonce !== expectedNonce) {
        throw new AuthError('Nonce mismatch', AuthErrorType.INVALID_TOKEN)
      }

      return payload as JWTPayload
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      throw new AuthError('Invalid ID token', AuthErrorType.INVALID_TOKEN, error)
    }
  }

  /**
   * Authenticate a request using OAuth access token
   */
  async authenticate(req: AuthenticatedRequest, _res: Response): Promise<AuthUser | null> {
    const token = this.extractToken(req)

    if (!token) {
      throw new AuthError('No access token provided', AuthErrorType.MISSING_TOKEN)
    }

    // Validate the token
    const user = await this.validateToken(token)
    return user
  }

  /**
   * Validate an OAuth access token
   */
  async validateToken(token: string): Promise<AuthUser> {
    try {
      // If we have JWKS, validate as JWT
      if (this.jwksClient) {
        const { payload } = await jose.jwtVerify(token, this.jwksClient, {
          issuer: this.oauthConfig.issuer,
          audience: this.oauthConfig.audience,
        })

        const jwtPayload = payload as JWTPayload
        validateJWTClaims(jwtPayload, this.oauthConfig.audience, this.oauthConfig.issuer)

        const userInfo = extractUserFromJWT(jwtPayload)
        return {
          ...userInfo,
          provider: 'oauth',
          expiresAt: jwtPayload.exp ? new Date(jwtPayload.exp * 1000) : undefined,
        }
      }

      // Otherwise, introspect the token (if introspection endpoint is available)
      if (this.discoveryDocument?.introspection_endpoint) {
        return await this.introspectToken(token)
      }

      // If no validation method is available, decode without verification (less secure)
      const { payload } = decodeJWT(token)
      const userInfo = extractUserFromJWT(payload)
      return {
        ...userInfo,
        provider: 'oauth',
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      throw new AuthError('Invalid access token', AuthErrorType.INVALID_TOKEN, error)
    }
  }

  /**
   * Introspect an OAuth token
   */
  private async introspectToken(token: string): Promise<AuthUser> {
    try {
      if (!this.discoveryDocument?.introspection_endpoint) {
        throw new AuthError(
          'Introspection endpoint not available',
          AuthErrorType.CONFIGURATION_ERROR,
        )
      }
      const response = await fetch(this.discoveryDocument.introspection_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`,
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }).toString(),
      })

      if (!response.ok) {
        throw new AuthError('Token introspection failed', AuthErrorType.PROVIDER_ERROR)
      }

      const result = (await response.json()) as {
        active: boolean
        sub?: string
        username?: string
        email?: string
        name?: string
        scope?: string
        exp?: number
      }

      if (!result.active) {
        throw new AuthError('Token is not active', AuthErrorType.INVALID_TOKEN)
      }

      return {
        id: result.sub || result.username || 'unknown',
        email: result.email,
        name: result.name,
        provider: 'oauth',
        scopes: result.scope ? result.scope.split(' ') : undefined,
        expiresAt: result.exp ? new Date(result.exp * 1000) : undefined,
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      throw new AuthError('Token introspection failed', AuthErrorType.PROVIDER_ERROR, error)
    }
  }

  /**
   * Refresh an OAuth token
   */
  async refreshToken(refreshToken: string): Promise<string> {
    const params: OAuthTokenParams = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
    }

    const tokenResponse = await this.exchangeCodeForTokens(params)
    return tokenResponse.access_token
  }

  /**
   * Check if the strategy can handle the request
   */
  canHandle(req: Request): boolean {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return false
    }

    // OAuth uses Bearer tokens
    return authHeader.toLowerCase().startsWith('bearer ')
  }

  /**
   * Get the authentication type name
   */
  getType(): string {
    return 'oauth'
  }

  /**
   * Clean up old sessions
   */
  private cleanupSessions(): void {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    for (const [state, session] of this.sessions.entries()) {
      if (session.createdAt < tenMinutesAgo) {
        this.sessions.delete(state)
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.sessions.clear()
  }
}
