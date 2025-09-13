/**
 * Keycloak OAuth provider configuration
 */

import type { OAuthProviderConfig } from '../types/index.js'

/**
 * Keycloak OAuth 2.0 / OpenID Connect configuration
 *
 * Setup instructions:
 * 1. Install Keycloak (Docker: docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev)
 * 2. Access admin console at http://localhost:8080/admin
 * 3. Create a new Realm or use existing
 * 4. Create a new Client:
 *    - Client Protocol: openid-connect
 *    - Access Type: confidential (for client secret)
 *    - Valid Redirect URIs: http://localhost:3000/auth/callback
 * 5. Go to Credentials tab and copy the Secret
 * 6. Configure realm settings, user federation, identity providers as needed
 *
 * Free and open source - can be self-hosted
 */
export function createKeycloakProvider(
  baseUrl: string,
  realm: string,
  clientId: string,
  clientSecret: string,
  additionalScopes?: string[],
): OAuthProviderConfig {
  const baseScopes = ['openid', 'profile', 'email', 'offline_access']
  const scopes = additionalScopes ? [...baseScopes, ...additionalScopes] : baseScopes

  // Remove trailing slash from base URL
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')

  return {
    clientId,
    clientSecret,
    authorizationUrl: `${cleanBaseUrl}/realms/${realm}/protocol/openid-connect/auth`,
    tokenUrl: `${cleanBaseUrl}/realms/${realm}/protocol/openid-connect/token`,
    jwksUrl: `${cleanBaseUrl}/realms/${realm}/protocol/openid-connect/certs`,
    issuer: `${cleanBaseUrl}/realms/${realm}`,
    discoveryUrl: `${cleanBaseUrl}/realms/${realm}/.well-known/openid-configuration`,
    scopes,
  }
}

/**
 * Keycloak-specific OAuth parameters
 */
export interface KeycloakOAuthParams {
  kc_idp_hint?: string // Bypass Keycloak login page for specific identity provider
  kc_locale?: string // UI locale (e.g., 'en', 'de', 'es')
  login_hint?: string // Username or email to pre-fill
  prompt?: 'none' | 'login' | 'consent' | 'select_account'
  max_age?: number // Maximum authentication age
  acr_values?: string // Authentication Context Class Reference
}

/**
 * Build Keycloak authorization URL with additional parameters
 */
export function buildKeycloakAuthUrl(baseUrl: string, params?: KeycloakOAuthParams): string {
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
 * Keycloak user profile from ID token
 */
export interface KeycloakProfile {
  sub: string // User ID
  name?: string
  preferred_username?: string
  given_name?: string
  family_name?: string
  middle_name?: string
  nickname?: string
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
    formatted?: string
    street_address?: string
    locality?: string
    region?: string
    postal_code?: string
    country?: string
  }
  updated_at?: number
  // Keycloak-specific claims
  realm_access?: {
    roles: string[]
  }
  resource_access?: {
    [client: string]: {
      roles: string[]
    }
  }
  groups?: string[]
  // Custom attributes from Keycloak user attributes
  [key: string]: unknown
}

/**
 * Keycloak Admin API helper to get extended user profile
 * Requires admin access token
 */
export async function fetchKeycloakUserProfile(
  baseUrl: string,
  realm: string,
  userId: string,
  adminToken: string,
): Promise<unknown> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')

  const response = await fetch(`${cleanBaseUrl}/admin/realms/${realm}/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Keycloak user profile: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get Keycloak Admin API token
 * Used for accessing Keycloak Admin API endpoints
 */
export async function getKeycloakAdminToken(
  baseUrl: string,
  realm: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')

  const response = await fetch(`${cleanBaseUrl}/realms/${realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`Failed to get Keycloak admin token: ${response.statusText}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

/**
 * Logout from Keycloak
 * Ends the session in Keycloak
 */
export async function keycloakLogout(
  baseUrl: string,
  realm: string,
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
): Promise<void> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')

  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
  }

  if (clientSecret) {
    params.client_secret = clientSecret
  }

  const response = await fetch(`${cleanBaseUrl}/realms/${realm}/protocol/openid-connect/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })

  if (!response.ok) {
    throw new Error(`Failed to logout from Keycloak: ${response.statusText}`)
  }
}
