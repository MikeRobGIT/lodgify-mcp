/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.1
 */

import { createHash, randomBytes } from 'node:crypto'
import type { PKCEParams } from '../types/index.js'

/**
 * Generate PKCE parameters for OAuth authorization
 */
export function generatePKCE(): PKCEParams {
  // Generate a cryptographically random code verifier
  // RFC 7636 recommends 43-128 characters
  const verifier = base64URLEncode(randomBytes(32))

  // Generate the code challenge using SHA256
  const challenge = base64URLEncode(createHash('sha256').update(verifier).digest())

  return {
    codeVerifier: verifier,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  }
}

/**
 * Base64 URL encoding (without padding)
 */
export function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Generate a cryptographically secure random state parameter
 */
export function generateState(): string {
  return base64URLEncode(randomBytes(32))
}

/**
 * Generate a cryptographically secure nonce
 */
export function generateNonce(): string {
  return base64URLEncode(randomBytes(32))
}

/**
 * Verify PKCE code challenge
 */
export function verifyPKCE(verifier: string, challenge: string): boolean {
  const expectedChallenge = base64URLEncode(createHash('sha256').update(verifier).digest())

  // Use constant-time comparison to prevent timing attacks
  return timingSafeEqual(expectedChallenge, challenge)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
