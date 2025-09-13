/**
 * CORS configuration for OAuth authentication
 */

import type { NextFunction, Request, Response } from 'express'

/**
 * CORS configuration options
 */
export interface CorsConfig {
  origins: string[] | '*' // Allowed origins
  methods?: string[] // Allowed HTTP methods
  allowedHeaders?: string[] // Allowed request headers
  exposedHeaders?: string[] // Headers exposed to the client
  credentials?: boolean // Allow credentials (cookies, auth headers)
  maxAge?: number // Preflight cache duration in seconds
}

/**
 * Default CORS configurations for different environments
 */
export const DEFAULT_CORS_CONFIG: { [key: string]: CorsConfig } = {
  development: {
    origins: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  production: {
    origins: [], // Must be explicitly configured
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 3600, // 1 hour
  },
  oauth: {
    // Special configuration for OAuth endpoints
    origins: [], // OAuth redirect URIs
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Location', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 3600,
  },
}

/**
 * Create CORS middleware
 */
export function createCorsMiddleware(config: CorsConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    // Check if origin is allowed
    if (config.origins === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*')
    } else if (origin && config.origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    } else if (config.origins.length > 0) {
      // Origin not allowed, don't set CORS headers
      // This will cause the browser to block the request
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'CORS policy violation' })
      }
    }

    // Set other CORS headers
    if (config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    if (config.methods && config.methods.length > 0) {
      res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '))
    }

    if (config.allowedHeaders && config.allowedHeaders.length > 0) {
      res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '))
    }

    if (config.exposedHeaders && config.exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '))
    }

    if (config.maxAge) {
      res.setHeader('Access-Control-Max-Age', config.maxAge.toString())
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    } else {
      return next()
    }
  }
}

/**
 * Parse allowed origins from environment variable
 */
export function parseAllowedOrigins(originsStr?: string): string[] {
  if (!originsStr) {
    return []
  }

  // Handle wildcard
  if (originsStr === '*') {
    return []
  }

  // Parse comma-separated list
  return originsStr
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

/**
 * Get CORS configuration from environment
 */
export function getCorsConfigFromEnv(): CorsConfig {
  const env = process.env.NODE_ENV || 'development'

  // Start with default config for environment
  const config = { ...(DEFAULT_CORS_CONFIG[env] || DEFAULT_CORS_CONFIG.production) }

  // Override with environment variables if present
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  if (allowedOrigins) {
    config.origins = allowedOrigins === '*' ? '*' : parseAllowedOrigins(allowedOrigins)
  }

  const allowedMethods = process.env.CORS_ALLOWED_METHODS
  if (allowedMethods) {
    config.methods = allowedMethods.split(',').map((m) => m.trim())
  }

  const allowedHeaders = process.env.CORS_ALLOWED_HEADERS
  if (allowedHeaders) {
    config.allowedHeaders = allowedHeaders.split(',').map((h) => h.trim())
  }

  const allowCredentials = process.env.CORS_ALLOW_CREDENTIALS
  if (allowCredentials !== undefined) {
    config.credentials = allowCredentials === 'true'
  }

  const maxAge = process.env.CORS_MAX_AGE
  if (maxAge) {
    config.maxAge = parseInt(maxAge, 10)
  }

  return config
}

/**
 * Validate CORS configuration
 */
export function validateCorsConfig(config: CorsConfig): void {
  if (config.origins !== '*' && config.origins.length === 0) {
    console.warn('Warning: No CORS origins configured. All cross-origin requests will be blocked.')
  }

  if (config.credentials && config.origins === '*') {
    throw new Error('CORS: Cannot use credentials with wildcard origin (*)')
  }

  if (config.origins !== '*') {
    // Validate origin format
    for (const origin of config.origins) {
      try {
        new URL(origin)
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`)
      }
    }
  }
}
