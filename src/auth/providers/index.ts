/**
 * OAuth provider configurations and utilities
 */

export * from './auth0.js'
export * from './github.js'
export * from './google.js'
export * from './keycloak.js'

import type { OAuthProviderConfig } from '../types/index.js'
import { createAuth0Provider } from './auth0.js'
import { createGitHubProvider } from './github.js'
import { createGoogleProvider } from './google.js'
import { createKeycloakProvider } from './keycloak.js'

/**
 * Supported OAuth provider types
 */
export type OAuthProviderType = 'google' | 'github' | 'auth0' | 'keycloak' | 'custom'

/**
 * Provider factory configuration
 */
export interface ProviderFactoryConfig {
  type: OAuthProviderType
  clientId: string
  clientSecret: string
  // Provider-specific configuration
  domain?: string // For Auth0
  realm?: string // For Keycloak
  baseUrl?: string // For Keycloak
  audience?: string // For Auth0
  scopes?: string[] // Additional scopes
  // For custom providers
  custom?: OAuthProviderConfig
}

/**
 * Create an OAuth provider configuration based on type
 */
export function createOAuthProvider(config: ProviderFactoryConfig): OAuthProviderConfig {
  switch (config.type) {
    case 'google':
      return createGoogleProvider(config.clientId, config.clientSecret, config.scopes)

    case 'github':
      return createGitHubProvider(config.clientId, config.clientSecret, config.scopes)

    case 'auth0':
      if (!config.domain) {
        throw new Error('Auth0 requires a domain')
      }
      return createAuth0Provider(
        config.domain,
        config.clientId,
        config.clientSecret,
        config.audience,
        config.scopes,
      )

    case 'keycloak':
      if (!config.baseUrl || !config.realm) {
        throw new Error('Keycloak requires baseUrl and realm')
      }
      return createKeycloakProvider(
        config.baseUrl,
        config.realm,
        config.clientId,
        config.clientSecret,
        config.scopes,
      )

    case 'custom':
      if (!config.custom) {
        throw new Error('Custom provider requires full configuration')
      }
      return config.custom

    default:
      throw new Error(`Unsupported OAuth provider type: ${config.type}`)
  }
}

/**
 * Get provider type from issuer URL
 */
export function detectProviderType(issuer: string): OAuthProviderType {
  if (issuer.includes('accounts.google.com')) {
    return 'google'
  }
  if (issuer.includes('github.com')) {
    return 'github'
  }
  if (issuer.includes('auth0.com')) {
    return 'auth0'
  }
  if (issuer.includes('/realms/')) {
    return 'keycloak'
  }
  return 'custom'
}

/**
 * Provider-specific features support
 */
export interface ProviderFeatures {
  supportsRefreshTokens: boolean
  supportsPKCE: boolean
  supportsDiscovery: boolean
  supportsJWT: boolean
  supportsIntrospection: boolean
  supportsRevocation: boolean
}

/**
 * Get feature support for a provider type
 */
export function getProviderFeatures(type: OAuthProviderType): ProviderFeatures {
  switch (type) {
    case 'google':
      return {
        supportsRefreshTokens: true,
        supportsPKCE: true,
        supportsDiscovery: true,
        supportsJWT: true,
        supportsIntrospection: false,
        supportsRevocation: true,
      }

    case 'github':
      return {
        supportsRefreshTokens: false,
        supportsPKCE: false, // GitHub doesn't support PKCE yet
        supportsDiscovery: false,
        supportsJWT: false,
        supportsIntrospection: false,
        supportsRevocation: true,
      }

    case 'auth0':
      return {
        supportsRefreshTokens: true,
        supportsPKCE: true,
        supportsDiscovery: true,
        supportsJWT: true,
        supportsIntrospection: true,
        supportsRevocation: true,
      }

    case 'keycloak':
      return {
        supportsRefreshTokens: true,
        supportsPKCE: true,
        supportsDiscovery: true,
        supportsJWT: true,
        supportsIntrospection: true,
        supportsRevocation: true,
      }

    default:
      // Conservative defaults for custom providers
      return {
        supportsRefreshTokens: false,
        supportsPKCE: false,
        supportsDiscovery: false,
        supportsJWT: false,
        supportsIntrospection: false,
        supportsRevocation: false,
      }
  }
}
