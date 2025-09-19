import { createInstance, type i18n, type TFunction } from 'i18next'

import type { InternationalizationOptions } from '../date/validator.js'
import { clearResourceCache, loadNamespaceResources, SUPPORTED_LANGUAGES } from './resources.js'

const translatorCache = new Map<string, i18n>()

export function getTranslator(namespace: string, options: InternationalizationOptions): TFunction {
  const { language, locale } = resolveLocale(options)
  const cacheKey = `${namespace}:${locale}`

  let instance = translatorCache.get(cacheKey)
  if (!instance) {
    const resources = loadNamespaceResources(namespace, language)
    instance = createInstance()
    instance.init({
      lng: locale,
      fallbackLng: 'en',
      ns: [namespace],
      defaultNS: namespace,
      resources,
      supportedLngs: SUPPORTED_LANGUAGES,
      initImmediate: false,
      returnNull: false,
      interpolation: {
        escapeValue: false,
        format(value, format, lng) {
          const resolvedLocale = locale || lng || language || 'en'

          if (format === 'number') {
            const numeric = typeof value === 'number' ? value : Number(value)
            if (Number.isFinite(numeric)) {
              return new Intl.NumberFormat(resolvedLocale).format(numeric)
            }
          }

          if (format === 'date') {
            const dateValue =
              value instanceof Date
                ? value
                : typeof value === 'string'
                  ? new Date(value)
                  : new Date(String(value))

            if (!Number.isNaN(dateValue.getTime())) {
              return new Intl.DateTimeFormat(resolvedLocale, {
                dateStyle: 'medium',
              }).format(dateValue)
            }
          }

          return value === undefined || value === null ? '' : String(value)
        },
      },
    })

    translatorCache.set(cacheKey, instance)
  }

  return instance.getFixedT(locale, namespace)
}

export function clearTranslatorCache(): void {
  translatorCache.clear()
  clearResourceCache()
}

function resolveLocale(options: InternationalizationOptions): { language: string; locale: string } {
  const fallback = 'en'
  const candidateLocale = options.locale ?? options.language ?? fallback
  const language = candidateLocale.split('-')[0]?.toLowerCase() ?? fallback
  const locale = candidateLocale

  return {
    language,
    locale,
  }
}
