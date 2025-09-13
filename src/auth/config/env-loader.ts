/**
 * Environment variable configuration loader for authentication
 */

import { createOAuthProvider, type OAuthProviderType } from '../providers/index.js'
import type { AuthConfig, AuthMode, OAuthProviderConfig } from '../types/index.js'

/**
 * Environment variable names for authentication configuration
 */
export const AUTH_ENV_VARS = {
  // Authentication mode
  AUTH_MODE: 'AUTH_MODE', // bearer, oauth, dual, none

  // Bearer token configuration
  MCP_TOKEN: 'MCP_TOKEN', // Legacy support
  AUTH_BEARER_TOKEN: 'AUTH_BEARER_TOKEN', // New variable name

  // OAuth provider configuration
  OAUTH_PROVIDER: 'OAUTH_PROVIDER', // google, github, auth0, keycloak, custom
  OAUTH_CLIENT_ID: 'OAUTH_CLIENT_ID',
  OAUTH_CLIENT_SECRET: 'OAUTH_CLIENT_SECRET',
  OAUTH_SCOPES: 'OAUTH_SCOPES', // Space-separated list

  // Provider-specific configuration
  OAUTH_DOMAIN: 'OAUTH_DOMAIN', // Auth0 domain
  OAUTH_REALM: 'OAUTH_REALM', // Keycloak realm
  OAUTH_BASE_URL: 'OAUTH_BASE_URL', // Keycloak base URL
  OAUTH_AUDIENCE: 'OAUTH_AUDIENCE', // Auth0/custom audience

  // Custom provider configuration
  OAUTH_AUTH_URL: 'OAUTH_AUTH_URL',
  OAUTH_TOKEN_URL: 'OAUTH_TOKEN_URL',
  OAUTH_JWKS_URL: 'OAUTH_JWKS_URL',
  OAUTH_ISSUER: 'OAUTH_ISSUER',
  OAUTH_DISCOVERY_URL: 'OAUTH_DISCOVERY_URL',

  // Session configuration
  SESSION_SECRET: 'SESSION_SECRET',
  TRUST_PROXY: 'TRUST_PROXY', // true/false for Express trust proxy

  // Server configuration
  HTTP_PORT: 'HTTP_PORT',
  HTTP_HOST: 'HTTP_HOST',
  BASE_URL: 'BASE_URL', // For OAuth callbacks
} as const

/**
 * Load authentication configuration from environment variables
 */
export function loadAuthConfig(): AuthConfig | null {
  const mode = getAuthMode()

  if (!mode) {
    return null
  }

  const config: AuthConfig = {
    mode,
    sessionSecret: process.env[AUTH_ENV_VARS.SESSION_SECRET],
    trustProxy: process.env[AUTH_ENV_VARS.TRUST_PROXY] === 'true',
  }

  // Load bearer configuration if needed
  if (mode === 'bearer' || mode === 'dual') {
    const bearerToken = getBearerToken()
    if (bearerToken) {
      config.bearer = {
        token: bearerToken,
      }
    } else if (mode === 'bearer') {
      throw new Error('Bearer token is required when AUTH_MODE is "bearer"')
    }
  }

  // Load OAuth configuration if needed
  if (mode === 'oauth' || mode === 'dual') {
    const oauthConfig = getOAuthConfig()
    if (oauthConfig) {
      config.oauth = oauthConfig
    } else if (mode === 'oauth') {
      throw new Error('OAuth configuration is required when AUTH_MODE is "oauth"')
    }
  }

  return config
}

/**
 * Get authentication mode from environment
 */
function getAuthMode(): AuthMode | null {
  const mode = process.env[AUTH_ENV_VARS.AUTH_MODE]

  if (!mode) {
    // Default behavior: check what's configured
    if (getBearerToken() && getOAuthConfig()) {
      return 'dual'
    } else if (getBearerToken()) {
      return 'bearer'
    } else if (getOAuthConfig()) {
      return 'oauth'
    }
    return null
  }

  if (!['bearer', 'oauth', 'dual', 'none'].includes(mode)) {
    throw new Error(
      `Invalid AUTH_MODE: ${mode}. Must be "bearer", "oauth", "dual", or "none"`,
    )
  }

  return mode as AuthMode
}

/**
 * Get bearer token from environment
 */
function getBearerToken(): string | null {
  // Check new variable first, fall back to legacy
  return (
    process.env[AUTH_ENV_VARS.AUTH_BEARER_TOKEN] || process.env[AUTH_ENV_VARS.MCP_TOKEN] || null
  )
}

/**
 * Get OAuth configuration from environment
 */
function getOAuthConfig(): OAuthProviderConfig | null {
  const provider = process.env[AUTH_ENV_VARS.OAUTH_PROVIDER] as OAuthProviderType

  if (!provider) {
    return null
  }

  const clientId = process.env[AUTH_ENV_VARS.OAUTH_CLIENT_ID]
  const clientSecret = process.env[AUTH_ENV_VARS.OAUTH_CLIENT_SECRET]

  if (!clientId || !clientSecret) {
    console.warn('OAuth provider specified but CLIENT_ID or CLIENT_SECRET missing')
    return null
  }

  // Parse scopes
  const scopesStr = process.env[AUTH_ENV_VARS.OAUTH_SCOPES]
  const scopes = scopesStr ? scopesStr.split(' ') : undefined

  if (provider === 'custom') {
    // Custom provider requires explicit URLs
    const authUrl = process.env[AUTH_ENV_VARS.OAUTH_AUTH_URL]
    const tokenUrl = process.env[AUTH_ENV_VARS.OAUTH_TOKEN_URL]
    const issuer = process.env[AUTH_ENV_VARS.OAUTH_ISSUER]

    if (!authUrl || !tokenUrl || !issuer) {
      throw new Error('Custom OAuth provider requires AUTH_URL, TOKEN_URL, and ISSUER')
    }

    return {
      clientId,
      clientSecret,
      authorizationUrl: authUrl,
      tokenUrl,
      jwksUrl: process.env[AUTH_ENV_VARS.OAUTH_JWKS_URL],
      issuer,
      audience: process.env[AUTH_ENV_VARS.OAUTH_AUDIENCE],
      discoveryUrl: process.env[AUTH_ENV_VARS.OAUTH_DISCOVERY_URL],
      scopes: scopes || ['openid', 'profile', 'email'],
    }
  }

  // Use provider factory
  try {
    return createOAuthProvider({
      type: provider,
      clientId,
      clientSecret,
      domain: process.env[AUTH_ENV_VARS.OAUTH_DOMAIN],
      realm: process.env[AUTH_ENV_VARS.OAUTH_REALM],
      baseUrl: process.env[AUTH_ENV_VARS.OAUTH_BASE_URL],
      audience: process.env[AUTH_ENV_VARS.OAUTH_AUDIENCE],
      scopes,
    })
  } catch (error) {
    console.error(`Failed to create OAuth provider configuration: ${error}`)
    return null
  }
}

/**
 * Get OAuth callback URL from environment
 */
export function getOAuthCallbackUrl(): string {
  const baseUrl = process.env[AUTH_ENV_VARS.BASE_URL]
  if (baseUrl) {
    return `${baseUrl}/auth/callback`
  }

  // Construct from host and port
  const host = process.env[AUTH_ENV_VARS.HTTP_HOST] || 'localhost'
  const port = process.env[AUTH_ENV_VARS.HTTP_PORT] || '3000'
  const protocol = port === '443' ? 'https' : 'http'

  return `${protocol}://${host}:${port}/auth/callback`
}

/**
 * Validate authentication configuration
 */
export function validateAuthConfig(config: AuthConfig): void {
  if (config.mode === 'bearer' || config.mode === 'dual') {
    if (!config.bearer?.token) {
      throw new Error('Bearer token is required for bearer authentication')
    }
    if (config.bearer.token.length < 32) {
      console.warn('Warning: Bearer token should be at least 32 characters for security')
    }
  }

  if (config.mode === 'oauth' || config.mode === 'dual') {
    if (!config.oauth) {
      throw new Error('OAuth configuration is required for OAuth authentication')
    }
    if (!config.oauth.clientId || !config.oauth.clientSecret) {
      throw new Error('OAuth client ID and secret are required')
    }
  }

  if (config.mode === 'none') {
    // No authentication required; no validation necessary
    return
  }

  if (config.mode === 'dual') {
    if (!config.sessionSecret) {
      console.warn('Warning: SESSION_SECRET is recommended for dual mode authentication')
    }
  }
}

/**
 * Generate example .env configuration
 */
export function generateExampleEnv(mode: AuthMode = 'dual'): string {
  const lines: string[] = [
    '# Authentication Configuration',
    `AUTH_MODE=${mode} # Options: bearer, oauth, dual, none`,
    '',
  ]

  if (mode === 'bearer' || mode === 'dual') {
    lines.push(
      '# Bearer Token Authentication',
      'AUTH_BEARER_TOKEN=your-secret-token-here-minimum-32-chars',
      '',
    )
  }

  if (mode === 'oauth' || mode === 'dual') {
    lines.push(
      '# OAuth Configuration',
      'OAUTH_PROVIDER=google # Options: google, github, auth0, keycloak, custom',
      'OAUTH_CLIENT_ID=your-client-id-here',
      'OAUTH_CLIENT_SECRET=your-client-secret-here',
      'OAUTH_SCOPES=openid profile email # Space-separated list',
      '',
      '# Provider-Specific Configuration',
      '# For Auth0:',
      '# OAUTH_DOMAIN=your-tenant.auth0.com',
      '# OAUTH_AUDIENCE=https://your-api-identifier',
      '',
      '# For Keycloak:',
      '# OAUTH_BASE_URL=http://localhost:8080',
      '# OAUTH_REALM=your-realm',
      '',
      '# For Custom Provider:',
      '# OAUTH_AUTH_URL=https://provider.com/authorize',
      '# OAUTH_TOKEN_URL=https://provider.com/token',
      '# OAUTH_JWKS_URL=https://provider.com/.well-known/jwks.json',
      '# OAUTH_ISSUER=https://provider.com',
      '# OAUTH_DISCOVERY_URL=https://provider.com/.well-known/openid-configuration',
      '',
    )
  }

  lines.push(
    '# Session Configuration (recommended for OAuth)',
    'SESSION_SECRET=your-session-secret-here-minimum-32-chars',
    'TRUST_PROXY=false # Set to true if behind a proxy',
    '',
    '# Server Configuration',
    'HTTP_PORT=3000',
    'HTTP_HOST=localhost',
    'BASE_URL=http://localhost:3000 # Used for OAuth callbacks',
  )

  return lines.join('\n')
}
