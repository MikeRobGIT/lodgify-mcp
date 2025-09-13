/**
 * Google OAuth provider configuration
 */

import type { OAuthProviderConfig } from '../types/index.js'

/**
 * Google OAuth 2.0 configuration
 *
 * Setup instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing
 * 3. Enable Google+ API
 * 4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
 * 5. Configure consent screen
 * 6. Add authorized redirect URIs (e.g., http://localhost:3000/auth/callback)
 * 7. Copy Client ID and Client Secret
 */
export function createGoogleProvider(
  clientId: string,
  clientSecret: string,
  additionalScopes?: string[],
): OAuthProviderConfig {
  const baseScopes = ['openid', 'profile', 'email']
  const scopes = additionalScopes ? [...baseScopes, ...additionalScopes] : baseScopes

  return {
    clientId,
    clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    scopes,
  }
}

/**
 * Google-specific OAuth parameters
 */
export interface GoogleOAuthParams {
  access_type?: 'online' | 'offline' // offline for refresh tokens
  prompt?: 'none' | 'consent' | 'select_account'
  include_granted_scopes?: boolean
  login_hint?: string // Email address to pre-fill
  hd?: string // Hosted domain (for G Suite)
}

/**
 * Build Google authorization URL with additional parameters
 */
export function buildGoogleAuthUrl(baseUrl: string, params?: GoogleOAuthParams): string {
  const url = new URL(baseUrl)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }

  // Google recommends always requesting offline access for refresh tokens
  if (!url.searchParams.has('access_type')) {
    url.searchParams.append('access_type', 'offline')
  }

  return url.toString()
}

/**
 * Google user profile from ID token
 */
export interface GoogleProfile {
  sub: string // Unique Google user ID
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  email?: string
  email_verified?: boolean
  locale?: string
  hd?: string // Hosted domain
}
