/**
 * Token rotation and refresh management
 */

import { randomBytes } from 'node:crypto'
import { AuthError } from '../errors/auth-error.js'
import { AuthErrorType } from '../types/index.js'

/**
 * Refresh token configuration
 */
export interface RefreshTokenConfig {
  expiresIn: number // Expiration time in seconds
  rotateOnUse: boolean // Generate new refresh token on each use
  reuseWindow?: number // Grace period for reused tokens (seconds)
  maxReuse?: number // Maximum number of reuses allowed
  family?: boolean // Enable refresh token families for breach detection
}

/**
 * Refresh token data
 */
export interface RefreshTokenData {
  id: string
  userId: string
  clientId: string
  scope?: string
  createdAt: Date
  expiresAt: Date
  usedAt?: Date
  reuseCount: number
  family?: string // Token family ID for rotation tracking
  parentId?: string // Parent token ID for rotation chain
  revoked?: boolean
  revokedAt?: Date
  revokedReason?: string
}

/**
 * Default refresh token configurations
 */
export const DEFAULT_REFRESH_CONFIG: { [key: string]: RefreshTokenConfig } = {
  strict: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    rotateOnUse: true,
    reuseWindow: 0, // No reuse allowed
    maxReuse: 0,
    family: true, // Enable family tracking
  },
  moderate: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    rotateOnUse: true,
    reuseWindow: 60, // 60 second grace period
    maxReuse: 1,
    family: true,
  },
  lenient: {
    expiresIn: 90 * 24 * 60 * 60, // 90 days
    rotateOnUse: false,
    reuseWindow: 300, // 5 minute grace period
    maxReuse: 5,
    family: false,
  },
}

/**
 * In-memory refresh token store (replace with database in production)
 */
class RefreshTokenStore {
  private tokens: Map<string, RefreshTokenData> = new Map()
  private userTokens: Map<string, Set<string>> = new Map()
  private families: Map<string, Set<string>> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }

  /**
   * Create a new refresh token
   */
  create(
    userId: string,
    clientId: string,
    config: RefreshTokenConfig,
    scope?: string,
    familyId?: string,
    parentId?: string,
  ): RefreshTokenData {
    const tokenId = this.generateTokenId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + config.expiresIn * 1000)

    const token: RefreshTokenData = {
      id: tokenId,
      userId,
      clientId,
      scope,
      createdAt: now,
      expiresAt,
      reuseCount: 0,
      family: familyId || (config.family ? this.generateFamilyId() : undefined),
      parentId,
      revoked: false,
    }

    // Store token
    this.tokens.set(tokenId, token)

    // Track by user
    if (!this.userTokens.has(userId)) {
      this.userTokens.set(userId, new Set())
    }
    this.userTokens.get(userId)?.add(tokenId)

    // Track by family
    if (token.family) {
      if (!this.families.has(token.family)) {
        this.families.set(token.family, new Set())
      }
      this.families.get(token.family)?.add(tokenId)
    }

    return token
  }

  /**
   * Validate and use a refresh token
   */
  use(tokenId: string, config: RefreshTokenConfig): RefreshTokenData {
    const token = this.tokens.get(tokenId)

    if (!token) {
      throw new AuthError('Invalid refresh token', AuthErrorType.INVALID_TOKEN)
    }

    // Check if revoked
    if (token.revoked) {
      // Potential token reuse after revocation - security breach!
      if (token.family) {
        this.revokeFamily(token.family, 'Attempted reuse of revoked token')
      }
      throw new AuthError('Refresh token has been revoked', AuthErrorType.INVALID_TOKEN, {
        reason: token.revokedReason,
      })
    }

    // Check expiration
    if (token.expiresAt < new Date()) {
      this.revoke(tokenId, 'Token expired')
      throw new AuthError('Refresh token has expired', AuthErrorType.EXPIRED_TOKEN)
    }

    // Check if this is a reuse
    const isReuse = !!token.usedAt

    if (isReuse && token.usedAt) {
      const reuseWindow = (Date.now() - token.usedAt.getTime()) / 1000

      if (reuseWindow > (config.reuseWindow || 0)) {
        // Token reuse outside grace period - potential breach!
        if (token.family) {
          this.revokeFamily(token.family, 'Token reuse detected outside grace period')
        }
        this.revoke(tokenId, 'Suspicious reuse detected')
        throw new AuthError('Refresh token reuse detected', AuthErrorType.INVALID_TOKEN)
      }

      // Within grace period
      token.reuseCount++
      if (token.reuseCount > (config.maxReuse || 0)) {
        this.revoke(tokenId, 'Maximum reuse count exceeded')
        throw new AuthError('Refresh token reuse limit exceeded', AuthErrorType.INVALID_TOKEN)
      }
    }

    // Mark as used
    token.usedAt = new Date()

    // Rotate if configured (only on first use)
    if (config.rotateOnUse && !isReuse) {
      // Create new token
      const newToken = this.create(
        token.userId,
        token.clientId,
        config,
        token.scope,
        token.family,
        token.id,
      )

      // Revoke old token (but keep for grace period)
      this.revoke(tokenId, 'Rotated')

      return newToken
    }

    return token
  }

  /**
   * Revoke a refresh token
   */
  revoke(tokenId: string, reason: string): void {
    const token = this.tokens.get(tokenId)
    if (token && !token.revoked) {
      token.revoked = true
      token.revokedAt = new Date()
      token.revokedReason = reason
    }
  }

  /**
   * Revoke all tokens in a family (breach detection)
   */
  revokeFamily(familyId: string, reason: string): void {
    const familyTokens = this.families.get(familyId)
    if (familyTokens) {
      for (const tokenId of familyTokens) {
        this.revoke(tokenId, `Family revoked: ${reason}`)
      }
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeUserTokens(userId: string, reason: string): void {
    const userTokens = this.userTokens.get(userId)
    if (userTokens) {
      for (const tokenId of userTokens) {
        this.revoke(tokenId, `User tokens revoked: ${reason}`)
      }
    }
  }

  /**
   * Get token by ID
   */
  get(tokenId: string): RefreshTokenData | undefined {
    return this.tokens.get(tokenId)
  }

  /**
   * Check if a token is revoked
   */
  isRevoked(tokenId: string): boolean {
    const token = this.tokens.get(tokenId)
    return token ? !!token.revoked : true // Consider non-existent tokens as revoked
  }

  /**
   * Clean up expired and revoked tokens
   */
  private cleanup(): void {
    const now = new Date()
    const gracePeriod = 24 * 60 * 60 * 1000 // Keep revoked tokens for 24 hours

    for (const [tokenId, token] of this.tokens.entries()) {
      // Remove expired tokens
      if (token.expiresAt < now) {
        this.removeToken(tokenId)
        continue
      }

      // Remove old revoked tokens
      if (token.revoked && token.revokedAt) {
        const revokedAge = now.getTime() - token.revokedAt.getTime()
        if (revokedAge > gracePeriod) {
          this.removeToken(tokenId)
        }
      }
    }
  }

  /**
   * Remove a token from all stores
   */
  private removeToken(tokenId: string): void {
    const token = this.tokens.get(tokenId)
    if (!token) return

    // Remove from main store
    this.tokens.delete(tokenId)

    // Remove from user tokens
    const userTokens = this.userTokens.get(token.userId)
    if (userTokens) {
      userTokens.delete(tokenId)
      if (userTokens.size === 0) {
        this.userTokens.delete(token.userId)
      }
    }

    // Remove from family
    if (token.family) {
      const familyTokens = this.families.get(token.family)
      if (familyTokens) {
        familyTokens.delete(tokenId)
        if (familyTokens.size === 0) {
          this.families.delete(token.family)
        }
      }
    }
  }

  /**
   * Generate a secure token ID
   */
  private generateTokenId(): string {
    return randomBytes(32).toString('base64url')
  }

  /**
   * Generate a family ID
   */
  private generateFamilyId(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * Destroy the store
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.tokens.clear()
    this.userTokens.clear()
    this.families.clear()
  }

  /**
   * Clean up expired tokens (public interface)
   */
  cleanupExpired(): void {
    this.cleanup()
  }
}

// Global refresh token store
export const refreshTokenStore = new RefreshTokenStore()

/**
 * Create a new refresh token
 */
export function createRefreshToken(
  userId: string,
  clientId: string,
  config: RefreshTokenConfig,
  scope?: string,
): string {
  const token = refreshTokenStore.create(userId, clientId, config, scope)
  return token.id
}

/**
 * Use a refresh token
 */
export function useRefreshToken(
  tokenId: string,
  config: RefreshTokenConfig,
): { newTokenId?: string; userId: string; clientId: string; scope?: string } {
  const token = refreshTokenStore.use(tokenId, config)

  if (config.rotateOnUse) {
    // Return the new token ID if rotated
    return {
      newTokenId: token.id,
      userId: token.userId,
      clientId: token.clientId,
      scope: token.scope,
    }
  }

  return {
    userId: token.userId,
    clientId: token.clientId,
    scope: token.scope,
  }
}

/**
 * Revoke a refresh token
 */
export function revokeRefreshToken(tokenId: string, reason: string = 'User requested'): void {
  refreshTokenStore.revoke(tokenId, reason)
}

/**
 * Revoke all tokens for a user
 */
export function revokeUserRefreshTokens(userId: string, reason: string = 'User requested'): void {
  refreshTokenStore.revokeUserTokens(userId, reason)
}

/**
 * Clean up expired refresh tokens
 */
export function cleanupRefreshTokens(): void {
  refreshTokenStore.cleanupExpired()
}

/**
 * Destroy all refresh tokens (for testing)
 */
export function destroyAllRefreshTokens(): void {
  refreshTokenStore.destroy()
}
