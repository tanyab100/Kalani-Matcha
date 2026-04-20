import type { Cart } from "../hooks/useCart";

/** Configured store tax rate (10.25%). */
export const TAX_RATE = 0.1025;

/**
 * Calculate tax in cents.
 * Returns Math.round(subtotalCents * rate).
 */
export function calculateTax(subtotalCents: number, rate: number): number {
  return Math.round(subtotalCents * rate);
}

/**
 * Calculate order total in cents.
 * Returns subtotal + tax + tip.
 */
export function calculateTotal(
  subtotalCents: number,
  taxCents: number,
  tipCents: number,
): number {
  return subtotalCents + taxCents + tipCents;
}

/**
 * Returns true if the cart has at least one item and checkout can proceed.
 * Validates: Requirements 5.11
 */
export function canProceedToCheckout(cart: Cart): boolean {
  return cart.items.length > 0;
}

/**
 * Format a cent value as a display price string, e.g. 1050 → "$10.50".
 * Use this everywhere prices are rendered to avoid UI inconsistencies.
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
