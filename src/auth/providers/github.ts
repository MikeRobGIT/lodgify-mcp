/**
 * GitHub OAuth provider configuration
 */

import type { OAuthProviderConfig } from '../types/index.js'

/**
 * GitHub OAuth configuration
 *
 * Setup instructions:
 * 1. Go to https://github.com/settings/developers
 * 2. Click "New OAuth App" or select existing
 * 3. Fill in application details:
 *    - Application name
 *    - Homepage URL
 *    - Authorization callback URL (e.g., http://localhost:3000/auth/callback)
 * 4. Copy Client ID and Client Secret
 *
 * Note: GitHub doesn't support PKCE yet, but we implement it for future compatibility
 */
export function createGitHubProvider(
  clientId: string,
  clientSecret: string,
  additionalScopes?: string[],
): OAuthProviderConfig {
  // GitHub doesn't use OpenID Connect, so no 'openid' scope
  const baseScopes = ['read:user', 'user:email']
  const scopes = additionalScopes ? [...baseScopes, ...additionalScopes] : baseScopes

  return {
    clientId,
    clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    // GitHub doesn't provide JWKS or discovery endpoints
    issuer: 'https://github.com',
    scopes,
  }
}

/**
 * GitHub-specific OAuth parameters
 */
export interface GitHubOAuthParams {
  login?: string // Suggest a specific account to use
  allow_signup?: boolean // Allow users to sign up for GitHub
}

/**
 * Build GitHub authorization URL with additional parameters
 */
export function buildGitHubAuthUrl(baseUrl: string, params?: GitHubOAuthParams): string {
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
 * GitHub user profile from API
 * Since GitHub doesn't use JWT, you need to fetch this from the API
 */
export interface GitHubProfile {
  id: number
  login: string
  name?: string
  email?: string
  avatar_url?: string
  bio?: string
  company?: string
  location?: string
  blog?: string
  twitter_username?: string
  public_repos?: number
  followers?: number
  following?: number
  created_at?: string
  updated_at?: string
}

/**
 * Fetch GitHub user profile using access token
 */
export async function fetchGitHubProfile(accessToken: string): Promise<GitHubProfile> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${response.statusText}`)
  }

  return response.json() as Promise<GitHubProfile>
}

/**
 * Fetch GitHub user emails
 * Needed because the primary email might be private
 */
export async function fetchGitHubEmails(accessToken: string): Promise<
  Array<{
    email: string
    primary: boolean
    verified: boolean
    visibility: string | null
  }>
> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub emails: ${response.statusText}`)
  }

  return response.json() as Promise<
    Array<{
      email: string
      primary: boolean
      verified: boolean
      visibility: string | null
    }>
  >
}
