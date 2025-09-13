/**
 * JWT utilities for token validation
 */

import { AuthError } from '../errors/auth-error.js'
import { AuthErrorType, type JWTPayload } from '../types/index.js'

/**
 * Decode a JWT without verification (for extracting header and payload)
 * WARNING: This does not verify the signature. Use only for non-security-critical operations.
 */
export function decodeJWT(token: string): {
  header: Record<string, unknown>
  payload: JWTPayload
  signature: string
} {
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new AuthError('Invalid JWT format', AuthErrorType.INVALID_TOKEN)
  }

  try {
    const header = JSON.parse(base64URLDecode(parts[0]))
    const payload = JSON.parse(base64URLDecode(parts[1]))
    const signature = parts[2]

    return { header, payload, signature }
  } catch (error) {
    throw new AuthError('Failed to decode JWT', AuthErrorType.INVALID_TOKEN, error)
  }
}

/**
 * Base64 URL decoding
 */
export function base64URLDecode(str: string): string {
  // Add padding if necessary
  str += '='.repeat((4 - (str.length % 4)) % 4)

  // Replace URL-safe characters
  str = str.replace(/-/g, '+').replace(/_/g, '/')

  return Buffer.from(str, 'base64').toString('utf-8')
}

/**
 * Check if a JWT is expired
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  if (!payload.exp) {
    return false // No expiration means token doesn't expire
  }

  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

/**
 * Check if a JWT is not yet valid
 */
export function isTokenNotYetValid(payload: JWTPayload): boolean {
  if (!payload.iat) {
    return false // No issued at time means token is valid
  }

  const now = Math.floor(Date.now() / 1000)
  // Allow for 30 seconds of clock skew
  return payload.iat > now + 30
}

/**
 * Validate JWT claims
 */
export function validateJWTClaims(
  payload: JWTPayload,
  expectedAudience?: string | string[],
  expectedIssuer?: string,
): void {
  // Check expiration
  if (isTokenExpired(payload)) {
    throw new AuthError('Token has expired', AuthErrorType.EXPIRED_TOKEN)
  }

  // Check not yet valid
  if (isTokenNotYetValid(payload)) {
    throw new AuthError('Token is not yet valid', AuthErrorType.INVALID_TOKEN)
  }

  // Check audience
  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    const expectedAudiences = Array.isArray(expectedAudience)
      ? expectedAudience
      : [expectedAudience]

    const hasValidAudience = expectedAudiences.some((aud) => audiences.includes(aud))

    if (!hasValidAudience) {
      throw new AuthError('Token audience mismatch', AuthErrorType.INVALID_TOKEN, {
        expected: expectedAudience,
        actual: payload.aud,
      })
    }
  }

  // Check issuer
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new AuthError('Token issuer mismatch', AuthErrorType.INVALID_TOKEN, {
      expected: expectedIssuer,
      actual: payload.iss,
    })
  }
}

/**
 * Extract user information from JWT payload
 */
export function extractUserFromJWT(payload: JWTPayload): {
  id: string
  email?: string
  name?: string
  scopes?: string[]
} {
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    scopes: payload.scope ? payload.scope.split(' ') : undefined,
  }
}
