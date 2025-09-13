/**
 * Authentication types and interfaces for the Lodgify MCP server
 */

import type { NextFunction, Request, Response } from 'express'

/**
 * Supported authentication modes
 */
export type AuthMode = 'bearer' | 'oauth' | 'dual' | 'none'

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  jwksUrl?: string
  issuer: string
  audience?: string
  scopes?: string[]
  discoveryUrl?: string
}

/**
 * Bearer token configuration
 */
export interface BearerTokenConfig {
  token: string
  headerName?: string
}

/**
 * Main authentication configuration
 */
export interface AuthConfig {
  mode: AuthMode
  bearer?: BearerTokenConfig
  oauth?: OAuthProviderConfig
  sessionSecret?: string
  trustProxy?: boolean
}

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string
  email?: string
  name?: string
  provider: 'bearer' | 'oauth' | 'none'
  scopes?: string[]
  expiresAt?: Date
}

/**
 * OAuth token response
 */
export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

/**
 * PKCE (Proof Key for Code Exchange) parameters
 */
export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

/**
 * OAuth authorization request parameters
 */
export interface OAuthAuthorizationParams {
  client_id: string
  redirect_uri: string
  response_type: 'code'
  scope: string
  state: string
  code_challenge: string
  code_challenge_method: 'S256'
  audience?: string
}

/**
 * OAuth token request parameters
 */
export interface OAuthTokenParams {
  grant_type: 'authorization_code' | 'refresh_token'
  code?: string
  redirect_uri?: string
  client_id: string
  client_secret?: string
  code_verifier?: string
  refresh_token?: string
}

/**
 * JWT payload for OAuth tokens
 */
export interface JWTPayload {
  sub: string
  aud: string | string[]
  iss: string
  exp: number
  iat: number
  scope?: string
  email?: string
  name?: string
}

/**
 * Express request with authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser
  token?: string
}

/**
 * Authentication middleware function
 */
export type AuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => void | Promise<void>

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}
