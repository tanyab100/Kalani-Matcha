import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateTax, calculateTotal, canProceedToCheckout } from "../../../utils/pricing";
import type { Cart, CartItem } from "../../../hooks/useCart";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb: fc.Arbitrary<CartItem> = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 10 }),
  selectedCustomizations: fc.dictionary(fc.uuid(), fc.uuid()),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

const subtotalArb = fc.integer({ min: 0, max: 100_000 });
const taxRateArb = fc.float({ min: 0, max: Math.fround(0.2), noNaN: true });
const tipArb = fc.integer({ min: 0, max: 5_000 });

function makeCart(items: CartItem[], tip = 0): Cart {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax = Math.round(subtotal * 0.0875);
  return { items, subtotal, tax, tip, total: subtotal + tax + tip };
}

// ── Property 12: Checkout summary completeness ────────────────────────────────

/**
 * Pure function that mirrors the logic in CheckoutPage.renderCheckoutSummary.
 * Extracted here so it can be tested without React rendering.
 */
function renderCheckoutSummary(cart: Cart) {
  const subtotal = cart.subtotal;
  const tax = calculateTax(subtotal, 0.0875);
  const tip = cart.tip;
  const total = calculateTotal(subtotal, tax, tip);
  return {
    items: cart.items.map((item) => ({
      id: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      linePrice: item.unitPrice * item.quantity,
    })),
    subtotal,
    tax,
    tip,
    total,
  };
}

describe("Checkout property tests", () => {
  // Feature: matcha-ordering-app, Property 12: Checkout summary completeness
  // Validates: Requirements 5.1
  it("Property 12: renderCheckoutSummary — displays all cart items and totals matching cart subtotal, tax, and total", () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1 }),
        tipArb,
        (items, tip) => {
          const cart = makeCart(items, tip);
          const summary = renderCheckoutSummary(cart);

          // All items are present
          expect(summary.items).toHaveLength(items.length);

          // Each item's linePrice = unitPrice * quantity
          for (let i = 0; i < items.length; i++) {
            expect(summary.items[i].name).toBe(items[i].name);
            expect(summary.items[i].quantity).toBe(items[i].quantity);
            expect(summary.items[i].linePrice).toBe(items[i].unitPrice * items[i].quantity);
          }

          // Totals match cart values
          expect(summary.subtotal).toBe(cart.subtotal);
          expect(summary.tax).toBe(calculateTax(cart.subtotal, 0.0875));
          expect(summary.total).toBe(calculateTotal(summary.subtotal, summary.tax, summary.tip));
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 14b: Tip calculation correctness
  // Validates: Requirements 10.3, 10.5, 10.6
  it("Property 14b: calculateTotal — total = subtotal + tax + tip; when tip=0, total = subtotal + tax", () => {
    fc.assert(
      fc.property(subtotalArb, subtotalArb, tipArb, (subtotal, tax, tip) => {
        const total = calculateTotal(subtotal, tax, tip);
        expect(total).toBe(subtotal + tax + tip);
      }),
      { numRuns: 100 }
    );

    // Specific case: tip = 0
    fc.assert(
      fc.property(subtotalArb, subtotalArb, (subtotal, tax) => {
        const total = calculateTotal(subtotal, tax, 0);
        expect(total).toBe(subtotal + tax);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 14: Tax calculation correctness
  // Validates: Requirements 5.7
  it("Property 14: calculateTax — tax = round(subtotal * rate) and total = subtotal + tax", () => {
    fc.assert(
      fc.property(subtotalArb, taxRateArb, (subtotal, rate) => {
        const tax = calculateTax(subtotal, rate);
        expect(tax).toBe(Math.round(subtotal * rate));

        // total (no tip) = subtotal + tax
        const total = calculateTotal(subtotal, tax, 0);
        expect(total).toBe(subtotal + tax);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 16: Empty cart blocks checkout
  // Validates: Requirements 5.11
  it("Property 16: canProceedToCheckout — returns false for any cart with zero items", () => {
    fc.assert(
      fc.property(tipArb, (tip) => {
        const emptyCart: Cart = { items: [], subtotal: 0, tax: 0, tip, total: tip };
        expect(canProceedToCheckout(emptyCart)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
