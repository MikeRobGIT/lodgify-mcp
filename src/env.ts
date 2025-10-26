/**
 * Environment variable validation and security utilities
 * Provides secure environment variable handling with validation and sanitization
 */

import { ZodIssueCode, z } from 'zod'
import { safeLogger } from './logger.js'

/**
 * Normalizes a value to a boolean with consistent handling
 * @param val - The value to normalize
 * @returns Boolean value
 */
export function normalizeBoolean(val: unknown): boolean {
  if (val === null || val === undefined) {
    return false
  }

  // Convert to string, trim whitespace, and lowercase
  const normalized = String(val).trim().toLowerCase()

  // Define explicit sets of truthy and falsy values
  const truthyValues = ['1', 'true', 'yes', 'on']
  const falsyValues = ['0', 'false', 'no', 'off']

  // Check against truthy values first
  if (truthyValues.includes(normalized)) {
    return true
  }

  // Check against falsy values
  if (falsyValues.includes(normalized)) {
    return false
  }

  // Default to false for unknown inputs
  return false
}

/**
 * Supported tool set identifiers for restricting tool registration
 */
export const TOOL_SET_KEYS = [
  'properties',
  'bookings',
  'availability',
  'rates',
  'quotes',
  'webhooks',
  'messaging',
] as const

/**
 * Tool set identifier type
 */
export type ToolSetIdentifier = (typeof TOOL_SET_KEYS)[number]

/**
 * Lookup table mapping environment aliases to canonical tool set identifiers
 */
const TOOL_SET_ALIAS_MAP: Record<string, ToolSetIdentifier> = {
  properties: 'properties',
  property: 'properties',
  'property-management': 'properties',
  'property-managements': 'properties',
  'property-discovery': 'properties',
  'property-discovery-search': 'properties',
  bookings: 'bookings',
  booking: 'bookings',
  'booking-management': 'bookings',
  rates: 'rates',
  rate: 'rates',
  pricing: 'rates',
  price: 'rates',
  quotes: 'quotes',
  quote: 'quotes',
  availability: 'availability',
  calendar: 'availability',
  webhooks: 'webhooks',
  webhook: 'webhooks',
  notifications: 'webhooks',
  messaging: 'messaging',
  message: 'messaging',
  communication: 'messaging',
  communications: 'messaging',
}

/**
 * Parse a comma separated list of tool set identifiers
 * @param raw - Raw CSV string from environment
 * @param ctx - Zod refinement context for reporting issues
 * @returns Array of canonical tool set identifiers
 */
function parseToolSetCsv(raw: string, ctx: z.RefinementCtx): ToolSetIdentifier[] {
  const normalized = raw.trim()
  if (normalized.length === 0) {
    return []
  }

  const tokens = normalized
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)

  if (tokens.length === 0) {
    return []
  }

  const invalidTokens: string[] = []
  const seen = new Set<ToolSetIdentifier>()
  const result: ToolSetIdentifier[] = []

  for (const token of tokens) {
    const mapped = TOOL_SET_ALIAS_MAP[token]
    if (!mapped) {
      invalidTokens.push(token)
      continue
    }

    if (!seen.has(mapped)) {
      seen.add(mapped)
      result.push(mapped)
    }
  }

  if (invalidTokens.length > 0) {
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: `Unknown tool set(s): ${invalidTokens.join(', ')}. Supported sets: ${TOOL_SET_KEYS.join(', ')}`,
    })
    return z.NEVER
  }

  return result
}

/**
 * Lodgify API key validation schema
 * Validates format, length, and basic structure
 */
const apiKeySchema = z
  .string()
  .min(32, 'API key must be at least 32 characters long')
  .max(256, 'API key exceeds maximum length')
  .regex(/^[a-zA-Z0-9+/=_-]+$/, 'API key contains invalid characters')
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
 * Uses consistent boolean normalization with proper boolean default
 */
const debugHttpSchema = z.unknown().optional().default(false).transform(normalizeBoolean)

/**
 * Read-only mode validation schema
 * Uses consistent boolean normalization with proper boolean default
 */
const readOnlySchema = z.unknown().optional().default(false).transform(normalizeBoolean)

/**
 * Enabled tool set CSV schema
 */
const toolSetCsvSchema = z.string().transform((value, ctx) => parseToolSetCsv(value, ctx))

/**
 * Complete environment schema
 */
const envSchema = z.object({
  LODGIFY_API_KEY: apiKeySchema,
  LOG_LEVEL: logLevelSchema,
  DEBUG_HTTP: debugHttpSchema,
  LODGIFY_READ_ONLY: readOnlySchema,
  LODGIFY_ENABLED_TOOL_SETS: toolSetCsvSchema.optional(),
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
 * Sanitizes an API key for logging purposes
 * @param apiKey - The API key to sanitize
 * @returns Sanitized key showing only first 4 and last 4 characters
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
 * Validates API key format and security properties
 * @param apiKey - The API key to validate
 * @param config - Security configuration options
 * @returns Validation result with warnings
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
 * Validates and loads environment configuration
 * @param securityConfig - Optional security configuration
 * @returns Validated environment configuration
 * @throws Error if validation fails
 */
export function loadEnvironment(securityConfig: Partial<SecurityConfig> = {}): EnvConfig {
  try {
    // Build raw environment object, excluding undefined values
    // This allows Zod's default values to work properly
    const optionalKeys = ['LOG_LEVEL', 'DEBUG_HTTP', 'LODGIFY_READ_ONLY', 'NODE_ENV'] as const

    const rawEnv: Record<string, string | undefined> = {
      // Always include LODGIFY_API_KEY (required)
      LODGIFY_API_KEY: process.env.LODGIFY_API_KEY,
      // Merge in only present, non-empty optional vars (trimmed)
      ...Object.fromEntries(
        optionalKeys
          .map((key) => [key, process.env[key]?.trim()])
          .filter(([, value]) => value !== undefined && value !== ''),
      ),
    }

    if (process.env.LODGIFY_ENABLED_TOOL_SETS !== undefined) {
      rawEnv.LODGIFY_ENABLED_TOOL_SETS = process.env.LODGIFY_ENABLED_TOOL_SETS
    }

    // Debug logging for read-only mode via structured logger
    if (process.env.LODGIFY_READ_ONLY !== undefined) {
      safeLogger.debug('[ENV DEBUG] loadEnvironment received LODGIFY_READ_ONLY', {
        LODGIFY_READ_ONLY: process.env.LODGIFY_READ_ONLY,
      })
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

    // Debug logging for parsed read-only value via structured logger
    if (process.env.LODGIFY_READ_ONLY !== undefined || config.LODGIFY_READ_ONLY) {
      safeLogger.debug('[ENV DEBUG] After parsing, LODGIFY_READ_ONLY', {
        LODGIFY_READ_ONLY: config.LODGIFY_READ_ONLY,
      })
    }

    // Log successful environment configuration loading
    safeLogger.info('Environment configuration loaded successfully', {
      logLevel: config.LOG_LEVEL,
      debugHttp: config.DEBUG_HTTP,
      readOnly: config.LODGIFY_READ_ONLY,
      nodeEnv: config.NODE_ENV,
      enabledToolSets: config.LODGIFY_ENABLED_TOOL_SETS,
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
 * Checks if the current environment is production
 * @param config - Environment configuration
 * @returns True if production environment
 */
export function isProduction(config: EnvConfig): boolean {
  return config.NODE_ENV === 'production'
}

/**
 * Checks if the current environment is development
 * @param config - Environment configuration
 * @returns True if development environment
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
 * Checks if read-only mode is enabled
 * @param config - Environment configuration
 * @returns True if read-only mode is active
 */
export function isReadOnly(config: EnvConfig): boolean {
  return config.LODGIFY_READ_ONLY === true
}

/**
 * Gets safe environment info for logging/debugging
 * @param config - Environment configuration
 * @returns Sanitized environment information
 */
export function getSafeEnvInfo(config: EnvConfig): Record<string, unknown> {
  return {
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
    debugHttp: config.DEBUG_HTTP,
    readOnly: config.LODGIFY_READ_ONLY,
    enabledToolSets: config.LODGIFY_ENABLED_TOOL_SETS,
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

/**
 * Get enabled tool set configuration from environment without requiring full validation
 */
export function getEnabledToolSetsFromEnv(): ToolSetIdentifier[] | undefined {
  const rawValue = process.env.LODGIFY_ENABLED_TOOL_SETS

  if (rawValue === undefined) {
    return undefined
  }

  const parseResult = toolSetCsvSchema.safeParse(rawValue)
  if (!parseResult.success) {
    const message = parseResult.error.errors.map((issue) => issue.message).join('; ')
    safeLogger.error('Invalid LODGIFY_ENABLED_TOOL_SETS configuration', { message })
    throw new EnvironmentError('Invalid LODGIFY_ENABLED_TOOL_SETS configuration', {
      errors: parseResult.error.errors,
    })
  }

  return parseResult.data
}

// Export the schemas for testing
export { apiKeySchema, debugHttpSchema, envSchema, logLevelSchema, readOnlySchema }
