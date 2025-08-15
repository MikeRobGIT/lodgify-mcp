/**
 * Environment variable validation and security utilities
 * Provides secure environment variable handling with validation and sanitization
 */

import { z } from 'zod'
import { safeLogger } from './logger.js'

/**
 * Lodgify API key validation schema
 * Validates format, length, and basic structure
 */
const apiKeySchema = z
  .string()
  .min(32, 'API key must be at least 32 characters long')
  .max(256, 'API key exceeds maximum length')
  .regex(/^[a-zA-Z0-9_-]+$/, 'API key contains invalid characters')
  .refine(
    (key) => !key.toLowerCase().includes('test') || key.toLowerCase().includes('sandbox'),
    'Suspicious API key format detected',
  )

/**
 * Log level validation schema
 */
const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']).optional().default('info')

/**
 * Debug HTTP flag validation schema
 */
const debugHttpSchema = z
  .string()
  .optional()
  .default('0')
  .transform((val) => val === '1' || val === 'true')

/**
 * Complete environment schema
 */
const envSchema = z.object({
  LODGIFY_API_KEY: apiKeySchema,
  LOG_LEVEL: logLevelSchema,
  DEBUG_HTTP: debugHttpSchema,
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
})

/**
 * Validated environment configuration type
 */
export type EnvConfig = z.infer<typeof envSchema>

/**
 * Security configuration for environment handling
 */
interface SecurityConfig {
  /** Whether to allow test/demo API keys */
  allowTestKeys: boolean
  /** Whether to validate API key format strictly */
  strictValidation: boolean
  /** Whether to log validation warnings */
  logWarnings: boolean
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowTestKeys: false,
  strictValidation: true,
  logWarnings: true,
}

/**
 * Return a logging-safe, masked version of an API key.
 *
 * If the key length is 8 characters or fewer the function returns `'***'`.
 * For longer keys it preserves the first four and last four characters and
 * replaces the middle with asterisks (at least four `*` characters).
 *
 * @param apiKey - The raw API key to mask.
 * @returns A masked string safe for inclusion in logs.
 */
export function sanitizeApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***'
  }
  const start = apiKey.substring(0, 4)
  const end = apiKey.substring(apiKey.length - 4)
  const middle = '*'.repeat(Math.max(4, apiKey.length - 8))
  return `${start}${middle}${end}`
}

/**
 * Validate an API key's format and apply additional security checks, returning any non-fatal warnings.
 *
 * The function first validates the key against the runtime `apiKeySchema`. If schema validation fails,
 * it returns { isValid: false } and populates `warnings` with the schema error messages. If the schema
 * passes, the function performs extra checks (e.g., test/demo indicators, length under strict mode,
 * repeating-character patterns) and returns { isValid: true } together with any generated warnings.
 * When `config.logWarnings` is true, warnings are emitted via the configured logger as a side effect.
 *
 * @param apiKey - The API key to validate.
 * @param config - Partial security options that override defaults. Recognized keys:
 *   - allowTestKeys: when true, suppresses warnings for keys containing `test`.
 *   - strictValidation: when true, enforces stricter length warnings for short keys.
 *   - logWarnings: when true, warnings will be logged via the safe logger.
 * @returns An object with `isValid` (false when schema validation fails) and `warnings` (array of messages).
 */
export function validateApiKey(
  apiKey: string,
  config: Partial<SecurityConfig> = {},
): { isValid: boolean; warnings: string[] } {
  const securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...config }
  const warnings: string[] = []

  try {
    apiKeySchema.parse(apiKey)
  } catch (error) {
    return {
      isValid: false,
      warnings:
        error instanceof z.ZodError
          ? error.errors.map((e) => e.message)
          : ['Invalid API key format'],
    }
  }

  // Additional security checks
  if (apiKey.toLowerCase().includes('test') && !securityConfig.allowTestKeys) {
    warnings.push('Test API key detected - not recommended for production')
  }

  if (apiKey.toLowerCase().includes('demo')) {
    warnings.push('Demo API key detected - limited functionality expected')
  }

  if (apiKey.length < 64 && securityConfig.strictValidation) {
    warnings.push('API key appears shorter than expected for production use')
  }

  // Check for common weak patterns
  if (/^(.)\1{10,}/.test(apiKey)) {
    warnings.push('API key contains suspicious repeating patterns')
  }

  if (securityConfig.logWarnings && warnings.length > 0) {
    warnings.forEach((warning) => {
      safeLogger.warn(`API Key validation warning: ${warning}`)
    })
  }

  return {
    isValid: true,
    warnings,
  }
}

/**
 * Load, validate, and return the application's environment configuration.
 *
 * Reads required environment variables, enforces presence of LODGIFY_API_KEY,
 * runs security checks against the API key, and validates all values against
 * the runtime schema before returning a typed EnvConfig.
 *
 * @param securityConfig - Optional overrides for runtime security checks (e.g., allowTestKeys, strictValidation, logWarnings).
 * @returns The validated environment configuration (EnvConfig).
 * @throws Error when a required environment variable is missing, the API key fails security validation, or schema validation fails.
 */
export function loadEnvironment(securityConfig: Partial<SecurityConfig> = {}): EnvConfig {
  try {
    // Parse environment variables
    const rawEnv = {
      LODGIFY_API_KEY: process.env.LODGIFY_API_KEY,
      LOG_LEVEL: process.env.LOG_LEVEL,
      DEBUG_HTTP: process.env.DEBUG_HTTP,
      NODE_ENV: process.env.NODE_ENV,
    }

    // Validate required variables are present
    if (!rawEnv.LODGIFY_API_KEY) {
      throw new Error(
        'LODGIFY_API_KEY environment variable is required. ' +
          'Please set it in your .env file or environment variables.',
      )
    }

    // Validate API key security
    const apiKeyValidation = validateApiKey(rawEnv.LODGIFY_API_KEY, securityConfig)
    if (!apiKeyValidation.isValid) {
      throw new Error(`Invalid API key: ${apiKeyValidation.warnings.join(', ')}`)
    }

    // Parse and validate all environment variables
    const config = envSchema.parse(rawEnv)

    safeLogger.info('Environment configuration loaded successfully', {
      logLevel: config.LOG_LEVEL,
      debugHttp: config.DEBUG_HTTP,
      nodeEnv: config.NODE_ENV,
      apiKeyMask: sanitizeApiKey(config.LODGIFY_API_KEY),
      warnings: apiKeyValidation.warnings.length > 0 ? apiKeyValidation.warnings : undefined,
    })

    return config
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown environment validation error'
    safeLogger.error('Environment validation failed', { error: errorMessage })
    throw new Error(`Environment validation failed: ${errorMessage}`)
  }
}

/**
 * Return true when the provided EnvConfig indicates a production environment.
 *
 * @returns True if `NODE_ENV` equals `"production"`.
 */
export function isProduction(config: EnvConfig): boolean {
  return config.NODE_ENV === 'production'
}

/**
 * Return true if the provided environment config represents a development environment.
 *
 * @returns `true` when `config.NODE_ENV === 'development'`, otherwise `false`.
 */
export function isDevelopment(config: EnvConfig): boolean {
  return config.NODE_ENV === 'development'
}

/**
 * Checks if the current environment is test
 * @param config - Environment configuration
 * @returns True if test environment
 */
export function isTest(config: EnvConfig): boolean {
  return config.NODE_ENV === 'test'
}

/**
 * Return a sanitized, non-sensitive snapshot of selected environment settings for logging or diagnostics.
 *
 * The returned object includes runtime flags and a masked representation of the API key so logs do not expose secrets.
 *
 * @param config - Validated environment configuration
 * @returns An object with:
 *  - `nodeEnv` — NODE_ENV value
 *  - `logLevel` — LOG_LEVEL value
 *  - `debugHttp` — DEBUG_HTTP boolean
 *  - `apiKeyPresent` — whether an API key is present
 *  - `apiKeyLength` — length of the raw API key
 *  - `apiKeyMask` — masked API key produced by `sanitizeApiKey`
 */
export function getSafeEnvInfo(config: EnvConfig): Record<string, unknown> {
  return {
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
    debugHttp: config.DEBUG_HTTP,
    apiKeyPresent: !!config.LODGIFY_API_KEY,
    apiKeyLength: config.LODGIFY_API_KEY.length,
    apiKeyMask: sanitizeApiKey(config.LODGIFY_API_KEY),
  }
}

/**
 * Environment validation error class
 */
export class EnvironmentError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'EnvironmentError'
  }
}

// Export the schemas for testing
export { apiKeySchema, logLevelSchema, debugHttpSchema, envSchema }
