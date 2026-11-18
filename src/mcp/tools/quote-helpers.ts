/**
 * Shared helpers for tools that attach a Lodgify quote to a booking.
 */

import { z } from 'zod'
import type { AttachedQuoteResult } from '../../api/v1/bookings/types.js'

/** Field names the tool used to accept; Lodgify never honored them. */
export const LEGACY_QUOTE_FIELDS = [
  'payload',
  'totalPrice',
  'subtotal',
  'currency',
  'breakdown',
  'adjustments',
  'validUntil',
  'notes',
  'customTerms',
  'policyId',
  'rentalAgreementId',
  'sendToGuest',
  'replaceExisting',
] as const

/**
 * Zod shape that accepts the legacy fields only so the handler can reject them
 * with a clear message. The MCP SDK would otherwise drop unknown keys silently.
 */
export const legacyQuoteFieldsShape = Object.fromEntries(
  LEGACY_QUOTE_FIELDS.map((name) => [name, z.unknown().optional()]),
) as Record<(typeof LEGACY_QUOTE_FIELDS)[number], z.ZodOptional<z.ZodUnknown>>

/**
 * Names of legacy fields present in the input, or an empty list.
 */
export function findLegacyQuoteFields(input: Record<string, unknown>): string[] {
  return LEGACY_QUOTE_FIELDS.filter((name) => input[name] !== undefined)
}

export const LEGACY_QUOTE_MESSAGE =
  'Lodgify prices a quote from the property rate plans and cannot take a custom total, ' +
  'breakdown, notes or expiry. Use is_policy_active, promotion_code, room_types and add_ons instead.'

/** Compare in whole cents so 1.01 vs 1 is exactly one cent, not 0.010000000000000009. */
const MONEY_TOLERANCE_CENTS = 1
const cents = (amount: number): number => Math.round(amount * 100)

/**
 * Warnings about what Lodgify stored versus what the caller wanted.
 */
export function quoteWarnings(
  quote: AttachedQuoteResult,
  options: { expectedTotal?: number; promotionCode?: string | null },
): string[] {
  const warnings: string[] = []

  if (
    options.expectedTotal !== undefined &&
    Math.abs(cents(quote.totalAmount) - cents(options.expectedTotal)) > MONEY_TOLERANCE_CENTS
  ) {
    warnings.push(
      `Lodgify priced the stay at ${quote.totalAmount} ${quote.currency ?? ''}, not ${options.expectedTotal}. ` +
        'Rate plans and promotion codes set the price and the API cannot override it. Tell the owner before confirming to the guest.',
    )
  }

  if (options.promotionCode && !quote.lines.some((line) => line.type === 'Promotion')) {
    warnings.push(
      `Promotion code "${options.promotionCode}" produced no discount line. Lodgify ignores unknown or ineligible codes without an error.`,
    )
  }

  if (quote.isPolicyActive) {
    warnings.push(
      `The quote carries the "${quote.policy ?? 'rate'}" policy and is ${quote.status}. Lodgify moves the booking to ${quote.bookingStatus ?? 'Tentative'} and refuses payment links until the quote is sent from the Lodgify dashboard. Use is_policy_active:false for bookings that must stay Booked and payable.`,
    )
  }

  return warnings
}
