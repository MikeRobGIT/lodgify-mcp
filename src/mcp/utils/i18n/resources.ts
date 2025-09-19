import fs from 'node:fs'

import type { Resource } from 'i18next'

const BASE_LOCALE = 'en'
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * A branded type representing a validated namespace string.
 * Namespaces must be validated through `validateNamespace()` before use.
 *
 * @remarks
 * This type provides compile-time safety when working with namespace strings.
 * It ensures that only properly validated namespace strings are used in file operations.
 *
 * @example
 * ```typescript
 * // Create a validated namespace
 * const namespace: ValidatedNamespace = validateNamespace('my-namespace')
 *
 * // Use the validated namespace safely
 * loadNamespaceResources(namespace, 'en')
 * ```
 */
export type ValidatedNamespace = string & { readonly __brand: 'ValidatedNamespace' }

const resourceCache = new Map<string, Resource>()
const fileCache = new Map<string, Record<string, unknown>>()

export function loadNamespaceResources(namespace: string, language: string): Resource {
  // Validate namespace early to ensure consistency
  const validatedNamespace = validateNamespace(namespace)
  const normalizedLanguage = normalizeLanguage(language)
  const cacheKey = `${validatedNamespace}:${normalizedLanguage}`

  if (resourceCache.has(cacheKey)) {
    return resourceCache.get(cacheKey) as Resource
  }

  const baseResource = getLocaleData(BASE_LOCALE, validatedNamespace)
  const resource: Resource = {
    [BASE_LOCALE]: {
      [validatedNamespace]: baseResource,
    },
  }

  if (normalizedLanguage !== BASE_LOCALE && isSupportedLanguage(normalizedLanguage)) {
    const localizedResource = getLocaleData(normalizedLanguage, validatedNamespace)
    resource[normalizedLanguage] = {
      [validatedNamespace]: localizedResource,
    }
  }

  resourceCache.set(cacheKey, resource)
  return resource
}

export function clearResourceCache(): void {
  resourceCache.clear()
  fileCache.clear()
}

function getLocaleData(
  language: SupportedLanguage | string,
  namespace: string,
): Record<string, unknown> {
  // Validate namespace to prevent path traversal attacks
  const validatedNamespace = validateNamespace(namespace)

  const normalizedLanguage = normalizeLanguage(language)
  const cacheKey = `${normalizedLanguage}:${validatedNamespace}`

  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey) as Record<string, unknown>
  }

  try {
    const fileUrl = new URL(
      `./locales/${normalizedLanguage}/${validatedNamespace}.json`,
      import.meta.url,
    )
    const raw = fs.readFileSync(fileUrl, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    fileCache.set(cacheKey, parsed)
    return parsed
  } catch (error) {
    // Only fallback to BASE_LOCALE after validation has occurred
    if (normalizedLanguage !== BASE_LOCALE) {
      return getLocaleData(BASE_LOCALE, validatedNamespace)
    }

    throw error
  }
}

/**
 * Validates a namespace string to prevent path traversal attacks and ensure safe file operations.
 *
 * @param namespace - The namespace string to validate
 * @returns The validated namespace string as a branded type
 * @throws {Error} If the namespace contains invalid characters, path traversal patterns, or exceeds length limits
 *
 * @example
 * // Valid namespaces
 * validateNamespace('validator') // returns 'validator' as ValidatedNamespace
 * validateNamespace('date-formatter') // returns 'date-formatter' as ValidatedNamespace
 * validateNamespace('user_settings') // returns 'user_settings' as ValidatedNamespace
 *
 * @example
 * // Invalid namespaces (will throw)
 * validateNamespace('../etc/passwd') // throws: contains invalid characters
 * validateNamespace('../../') // throws: contains invalid characters
 * validateNamespace('ns/with/slashes') // throws: contains invalid characters
 * validateNamespace('ns!@#$%') // throws: contains invalid characters
 * validateNamespace('') // throws: must be non-empty string
 *
 * @security This function prevents path traversal attacks by:
 * - Allowing only alphanumeric characters, hyphens, and underscores
 * - Blocking dots, slashes, and other path navigation characters
 * - Enforcing a maximum length of 100 characters
 */
export function validateNamespace(namespace: string): ValidatedNamespace {
  // Reject empty or undefined namespace
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('Invalid namespace: namespace must be a non-empty string')
  }

  // Reject overly long namespaces that could be attempting buffer overflow
  if (namespace.length > 100) {
    throw new Error(`Invalid namespace: "${namespace}" exceeds maximum length`)
  }

  // Allow only alphanumeric characters, hyphens, and underscores
  // This regex blocks dots, slashes, and all special characters that could be used for path traversal
  const namespacePattern = /^[a-zA-Z0-9_-]+$/
  if (!namespacePattern.test(namespace)) {
    throw new Error(`Invalid namespace: "${namespace}" contains invalid characters`)
  }

  return namespace as ValidatedNamespace
}

function normalizeLanguage(language?: string): SupportedLanguage {
  const normalized = (language ?? BASE_LOCALE).split('-')[0]?.toLowerCase() ?? BASE_LOCALE
  if (isSupportedLanguage(normalized)) {
    return normalized
  }

  return BASE_LOCALE
}

function isSupportedLanguage(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
}
