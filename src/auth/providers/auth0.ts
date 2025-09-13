/**
 * Auth0 OAuth provider configuration
 */

import type { OAuthProviderConfig } from '../types/index.js'

/**
 * Auth0 OAuth 2.0 configuration
 *
 * Setup instructions:
 * 1. Sign up for free at https://auth0.com/
 * 2. Create a new Application in the Dashboard
 * 3. Choose "Regular Web Application" as the application type
 * 4. Note your Domain, Client ID, and Client Secret
 * 5. Configure Allowed Callback URLs (e.g., http://localhost:3000/auth/callback)
 * 6. Configure Allowed Logout URLs if needed
 * 7. Enable desired connections (Google, GitHub, Username-Password, etc.)
 *
 * Free tier includes:
 * - 7,000 active users
 * - Unlimited logins
 * - 2 social identity providers
 * - Up to 3 Actions/Rules/Hooks
 */
export function createAuth0Provider(
  domain: string,
  clientId: string,
  clientSecret: string,
  audience?: string,
  additionalScopes?: string[],
): OAuthProviderConfig {
  const baseScopes = ['openid', 'profile', 'email', 'offline_access']
  const scopes = additionalScopes ? [...baseScopes, ...additionalScopes] : baseScopes

  // Remove protocol if included in domain
  const cleanDomain = domain.replace(/^https?:\/\//, '')

  return {
    clientId,
    clientSecret,
    authorizationUrl: `https://${cleanDomain}/authorize`,
    tokenUrl: `https://${cleanDomain}/oauth/token`,
    jwksUrl: `https://${cleanDomain}/.well-known/jwks.json`,
    issuer: `https://${cleanDomain}/`,
    audience: audience || `https://${cleanDomain}/api/v2/`,
    discoveryUrl: `https://${cleanDomain}/.well-known/openid-configuration`,
    scopes,
  }
}

/**
 * Auth0-specific OAuth parameters
 */
export interface Auth0OAuthParams {
  connection?: string // Specific connection to use (e.g., 'google-oauth2', 'github')
  organization?: string // Organization ID for multi-tenant apps
  invitation?: string // Invitation ID for user invitations
  login_hint?: string // Email to pre-fill
  screen_hint?: 'signup' | 'login' // Show signup or login screen
  prompt?: 'none' | 'login' | 'consent' | 'select_account'
  max_age?: number // Maximum authentication age in seconds
  ui_locales?: string // Preferred languages (e.g., 'en es')
}

/**
 * Build Auth0 authorization URL with additional parameters
 */
export function buildAuth0AuthUrl(baseUrl: string, params?: Auth0OAuthParams): string {
  const url = new URL(baseUrl)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }

  return url.toString()
}

/**
 * Auth0 user profile from ID token
 */
export interface Auth0Profile {
  sub: string // User ID (format: auth0|123456 or google-oauth2|123456)
  name?: string
  given_name?: string
  family_name?: string
  middle_name?: string
  nickname?: string
  preferred_username?: string
  profile?: string
  picture?: string
  website?: string
  email?: string
  email_verified?: boolean
  gender?: string
  birthdate?: string
  zoneinfo?: string
  locale?: string
  phone_number?: string
  phone_number_verified?: boolean
  address?: {
    country?: string
  }
  updated_at?: string
  // Custom claims can be added via Auth0 Actions/Rules
  [key: string]: unknown
}

/**
 * Auth0 Management API helper to get extended user profile
 * Requires Management API access token
 */
export async function fetchAuth0UserProfile(
  domain: string,
  userId: string,
  managementApiToken: string,
): Promise<unknown> {
  const cleanDomain = domain.replace(/^https?:\/\//, '')

  const response = await fetch(
    `https://${cleanDomain}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch Auth0 user profile: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get Auth0 Management API token
 * Used for accessing Auth0 Management API endpoints
 */
export async function getAuth0ManagementToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  audience?: string,
): Promise<string> {
  const cleanDomain = domain.replace(/^https?:\/\//, '')

  const response = await fetch(`https://${cleanDomain}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: audience || `https://${cleanDomain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get Auth0 Management API token: ${response.statusText}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}
