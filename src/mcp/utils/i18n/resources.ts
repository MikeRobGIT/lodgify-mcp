import fs from 'node:fs'

import type { Resource } from 'i18next'

const BASE_LOCALE = 'en'
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const resourceCache = new Map<string, Resource>()
const fileCache = new Map<string, Record<string, unknown>>()

export function loadNamespaceResources(namespace: string, language: string): Resource {
  const normalizedLanguage = normalizeLanguage(language)
  const cacheKey = `${namespace}:${normalizedLanguage}`

  if (resourceCache.has(cacheKey)) {
    return resourceCache.get(cacheKey) as Resource
  }

  const baseResource = getLocaleData(BASE_LOCALE, namespace)
  const resource: Resource = {
    [BASE_LOCALE]: {
      [namespace]: baseResource,
    },
  }

  if (normalizedLanguage !== BASE_LOCALE && isSupportedLanguage(normalizedLanguage)) {
    const localizedResource = getLocaleData(normalizedLanguage, namespace)
    resource[normalizedLanguage] = {
      [namespace]: localizedResource,
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
  const normalizedLanguage = normalizeLanguage(language)
  const cacheKey = `${normalizedLanguage}:${namespace}`

  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey) as Record<string, unknown>
  }

  try {
    const fileUrl = new URL(`./locales/${normalizedLanguage}/${namespace}.json`, import.meta.url)
    const raw = fs.readFileSync(fileUrl, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    fileCache.set(cacheKey, parsed)
    return parsed
  } catch (error) {
    if (normalizedLanguage !== BASE_LOCALE) {
      return getLocaleData(BASE_LOCALE, namespace)
    }

    throw error
  }
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
