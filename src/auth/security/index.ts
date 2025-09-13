/**
 * Security utilities and middleware
 */

export * from './cors.js'
export * from './headers.js'
export * from './rate-limiter.js'
export * from './token-rotation.js'

import type { Express } from 'express'
import { createCorsMiddleware, getCorsConfigFromEnv, validateCorsConfig } from './cors.js'
import { createSecurityHeadersMiddleware, getSecurityHeadersFromEnv } from './headers.js'
import { authRateLimiter } from './rate-limiter.js'

/**
 * Apply all security middleware to an Express app
 */
export function applySecurityMiddleware(app: Express): void {
  // CORS configuration
  const corsConfig = getCorsConfigFromEnv()
  validateCorsConfig(corsConfig)
  app.use(createCorsMiddleware(corsConfig))

  // Security headers
  const headersConfig = getSecurityHeadersFromEnv()
  app.use(createSecurityHeadersMiddleware(headersConfig))

  // Rate limiting for specific endpoints
  app.use('/auth/login', authRateLimiter.login)
  app.use('/auth/token', authRateLimiter.refresh)
  app.use('/auth/validate', authRateLimiter.tokenValidation)
  app.use('/mcp', authRateLimiter.general)
}

/**
 * Security best practices checklist
 */
export const SECURITY_CHECKLIST = {
  authentication: [
    'Use strong bearer tokens (32+ characters)',
    'Implement OAuth 2.1 with PKCE',
    'Enable token rotation for refresh tokens',
    'Set appropriate token expiration times',
    'Use secure session management',
  ],
  transport: [
    'Always use HTTPS in production',
    'Enable HSTS headers',
    'Use secure cookies (httpOnly, secure, sameSite)',
    'Implement certificate pinning for mobile clients',
  ],
  headers: [
    'Set Content-Security-Policy',
    'Enable X-Frame-Options',
    'Set X-Content-Type-Options: nosniff',
    'Configure proper CORS policies',
    'Set Referrer-Policy',
  ],
  rateLimit: [
    'Limit authentication attempts',
    'Implement progressive delays',
    'Use CAPTCHA for repeated failures',
    'Monitor for suspicious patterns',
  ],
  monitoring: [
    'Log authentication events',
    'Monitor for anomalies',
    'Set up alerts for security events',
    'Regular security audits',
    'Implement intrusion detection',
  ],
  dataProtection: [
    'Never log sensitive data',
    'Encrypt data at rest',
    'Use secure key management',
    'Implement data retention policies',
    'Regular backups with encryption',
  ],
}

/**
 * Get security configuration summary
 */
export function getSecuritySummary(): object {
  return {
    cors: getCorsConfigFromEnv(),
    headers: getSecurityHeadersFromEnv(),
    rateLimits: {
      login: '5 attempts per 15 minutes',
      tokenValidation: '30 requests per minute',
      general: '100 requests per minute',
      refresh: '10 refreshes per hour',
    },
    environment: process.env.NODE_ENV,
    httpsRequired: process.env.NODE_ENV === 'production',
    sessionSecured: !!process.env.SESSION_SECRET,
  }
}
