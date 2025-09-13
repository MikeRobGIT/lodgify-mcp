/**
 * Security headers middleware
 */

import { randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy?: string | false
  // X-Frame-Options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false
  // X-Content-Type-Options
  contentTypeOptions?: boolean
  // X-XSS-Protection
  xssProtection?: boolean
  // Strict-Transport-Security
  hsts?:
    | {
        maxAge: number
        includeSubDomains?: boolean
        preload?: boolean
      }
    | false
  // Referrer-Policy
  referrerPolicy?: string | false
  // Permissions-Policy
  permissionsPolicy?: string | false
  // Custom headers
  customHeaders?: { [key: string]: string }
}

/**
 * Default security headers configurations
 */
export const DEFAULT_SECURITY_HEADERS: { [key: string]: SecurityHeadersConfig } = {
  strict: {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  },
  moderate: {
    contentSecurityPolicy:
      "default-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    frameOptions: 'SAMEORIGIN',
    contentTypeOptions: true,
    xssProtection: true,
    hsts: {
      maxAge: 2592000, // 30 days
      includeSubDomains: false,
    },
    referrerPolicy: 'origin-when-cross-origin',
  },
  oauth: {
    // Relaxed for OAuth flows
    contentSecurityPolicy: false, // OAuth redirects may conflict with CSP
    frameOptions: 'SAMEORIGIN', // May need to be displayed in frames for some OAuth flows
    contentTypeOptions: true,
    xssProtection: true,
    hsts: {
      maxAge: 2592000,
      includeSubDomains: false,
    },
    referrerPolicy: 'strict-origin', // Don't leak paths during OAuth redirects
  },
}

/**
 * Create security headers middleware
 */
export function createSecurityHeadersMiddleware(config: SecurityHeadersConfig) {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    if (config.contentSecurityPolicy !== false && config.contentSecurityPolicy) {
      // Generate nonce for inline scripts if needed
      const nonce = randomBytes(16).toString('base64')
      res.locals.cspNonce = nonce

      let csp = config.contentSecurityPolicy
      // Replace 'nonce-' placeholder if present
      csp = csp.replace(/'nonce-'/g, `'nonce-${nonce}'`)

      res.setHeader('Content-Security-Policy', csp)
    }

    // X-Frame-Options
    if (config.frameOptions !== false && config.frameOptions) {
      res.setHeader('X-Frame-Options', config.frameOptions)
    }

    // X-Content-Type-Options
    if (config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }

    // X-XSS-Protection
    if (config.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block')
    }

    // Strict-Transport-Security
    if (config.hsts !== false && config.hsts) {
      let hstsValue = `max-age=${config.hsts.maxAge}`
      if (config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains'
      }
      if (config.hsts.preload) {
        hstsValue += '; preload'
      }
      res.setHeader('Strict-Transport-Security', hstsValue)
    }

    // Referrer-Policy
    if (config.referrerPolicy !== false && config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy)
    }

    // Permissions-Policy
    if (config.permissionsPolicy !== false && config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', config.permissionsPolicy)
    }

    // Custom headers
    if (config.customHeaders) {
      for (const [header, value] of Object.entries(config.customHeaders)) {
        res.setHeader(header, value)
      }
    }

    next()
  }
}

/**
 * Get security headers configuration from environment
 */
export function getSecurityHeadersFromEnv(): SecurityHeadersConfig {
  const mode = process.env.SECURITY_HEADERS_MODE || 'moderate'
  const config = { ...(DEFAULT_SECURITY_HEADERS[mode] || DEFAULT_SECURITY_HEADERS.moderate) }

  // Override with environment variables
  if (process.env.CSP_POLICY) {
    config.contentSecurityPolicy = process.env.CSP_POLICY
  }

  if (process.env.FRAME_OPTIONS) {
    config.frameOptions = process.env.FRAME_OPTIONS as 'DENY' | 'SAMEORIGIN'
  }

  if (process.env.HSTS_MAX_AGE) {
    config.hsts = {
      maxAge: parseInt(process.env.HSTS_MAX_AGE, 10),
      includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true',
      preload: process.env.HSTS_PRELOAD === 'true',
    }
  }

  if (process.env.REFERRER_POLICY) {
    config.referrerPolicy = process.env.REFERRER_POLICY
  }

  return config
}

/**
 * OAuth-specific security headers
 */
export function createOAuthSecurityHeaders() {
  return createSecurityHeadersMiddleware({
    ...DEFAULT_SECURITY_HEADERS.oauth,
    customHeaders: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

/**
 * API endpoint security headers
 */
export function createApiSecurityHeaders() {
  return createSecurityHeadersMiddleware({
    contentSecurityPolicy: false, // Not needed for API endpoints
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: false, // Not needed for API endpoints
    referrerPolicy: 'no-referrer',
    customHeaders: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-API-Version': '1.0',
    },
  })
}
