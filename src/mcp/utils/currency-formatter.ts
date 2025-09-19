/**
 * Currency formatting utilities for Response Enhancer
 */

/**
 * Comprehensive currency symbols mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  // Major currencies
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  // Commonwealth currencies
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  // European currencies
  CHF: 'Fr.',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  // Asian currencies
  INR: '₹',
  KRW: '₩',
  THB: '฿',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  PHP: '₱',
  IDR: 'Rp',
  MYR: 'RM',
  VND: '₫',
  // Middle East & Africa
  AED: 'د.إ',
  SAR: '﷼',
  ILS: '₪',
  ZAR: 'R',
  EGP: 'E£',
  // Americas
  BRL: 'R$',
  MXN: '$',
  ARS: '$',
  COP: '$',
  CLP: '$',
  PEN: 'S/',
  // Other
  RUB: '₽',
  TRY: '₺',
  UAH: '₴',
}

/**
 * Format currency values with expanded symbol support
 * @param amount - The numeric amount to format (returns 'N/A' if undefined)
 * @param currency - The currency code (defaults to 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | undefined, currency?: string): string {
  if (amount === undefined || amount === null) return 'N/A'

  const targetCurrency = currency || 'USD'

  try {
    const formatted = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: targetCurrency,
    })

    // Check if the formatter used the generic currency symbol
    // This happens for unknown currency codes
    if (formatted.includes('¤')) {
      // Try to use a known symbol from our mapping
      const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency
      const plainFormatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${symbol} ${plainFormatted}`
    }

    return formatted
  } catch (e) {
    // Fallback for invalid currency codes, which throw a RangeError
    if (e instanceof RangeError) {
      // Try to use a known symbol from our mapping
      const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      return `${symbol} ${formatted}`
    }
    // Re-throw other errors
    throw e
  }
}
