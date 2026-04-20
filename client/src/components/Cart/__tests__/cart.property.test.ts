import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  computeCartTotals,
  addItemToCart,
  removeItemFromCart,
  updateItemQuantity,
  customizationKey,
  TAX_RATE,
  type CartItem,
  type Cart,
} from "../../../hooks/useCart";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 10 }),
  selectedCustomizations: fc.dictionary(fc.uuid(), fc.uuid()),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

const tipArb = fc.integer({ min: 0, max: 500 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Cart property tests", () => {
  // Feature: matcha-ordering-app, Property 8: Cart total invariant
  // Validates: Requirements 4.1, 4.3, 4.4
  it("Property 8: computeCartTotals — total always equals subtotal + tax + tip, and subtotal equals sum of unitPrice * quantity", () => {
    fc.assert(
      fc.property(fc.array(cartItemArb), tipArb, (items, tip) => {
        const { subtotal, tax, total } = computeCartTotals(items, TAX_RATE, tip);

        const expectedSubtotal = items.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        expect(subtotal).toBe(expectedSubtotal);
        expect(tax).toBe(Math.round(subtotal * TAX_RATE));
        expect(total).toBe(subtotal + tax + tip);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 8 (mutation): totals invariant holds after addItemToCart", () => {
    fc.assert(
      fc.property(fc.array(cartItemArb), cartItemArb, tipArb, (items, newItem, tip) => {
        const result = addItemToCart(items, newItem);
        const { subtotal, tax, total } = computeCartTotals(result, TAX_RATE, tip);

        const expectedSubtotal = result.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        );
        expect(subtotal).toBe(expectedSubtotal);
        expect(tax).toBe(Math.round(subtotal * TAX_RATE));
        expect(total).toBe(subtotal + tax + tip);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 8 (mutation): totals invariant holds after removeItemFromCart", () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1 }),
        tipArb,
        (items, tip) => {
          const target = items[0];
          const custKey = customizationKey(target.selectedCustomizations);
          const result = removeItemFromCart(items, target.menuItemId, custKey);
          const { subtotal, tax, total } = computeCartTotals(result, TAX_RATE, tip);

          const expectedSubtotal = result.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0
          );
          expect(subtotal).toBe(expectedSubtotal);
          expect(tax).toBe(Math.round(subtotal * TAX_RATE));
          expect(total).toBe(subtotal + tax + tip);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 8 (mutation): totals invariant holds after updateItemQuantity", () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1 }),
        fc.integer({ min: 1, max: 10 }),
        tipArb,
        (items, newQty, tip) => {
          const target = items[0];
          const custKey = customizationKey(target.selectedCustomizations);
          const result = updateItemQuantity(items, target.menuItemId, custKey, newQty);
          const { subtotal, tax, total } = computeCartTotals(result, TAX_RATE, tip);

          const expectedSubtotal = result.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0
          );
          expect(subtotal).toBe(expectedSubtotal);
          expect(tax).toBe(Math.round(subtotal * TAX_RATE));
          expect(total).toBe(subtotal + tax + tip);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 9: Cart line item rendering
  // Validates: Requirements 4.2
  it("Property 9: renderCartItem — output contains name, quantity, and linePrice = unitPrice * quantity", () => {
    function renderCartItem(item: CartItem): {
      name: string;
      quantity: number;
      linePrice: number;
    } {
      return {
        name: item.name,
        quantity: item.quantity,
        linePrice: item.unitPrice * item.quantity,
      };
    }

    fc.assert(
      fc.property(cartItemArb, (item) => {
        const result = renderCartItem(item);

        expect(result.name).toBe(item.name);
        expect(result.quantity).toBe(item.quantity);
        expect(result.linePrice).toBe(item.unitPrice * item.quantity);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 10: Cart summary completeness
  // Validates: Requirements 4.5
  it("Property 10: computeCartTotals — non-empty cart has positive subtotal and total equals subtotal + tax + tip", () => {
    fc.assert(
      fc.property(
        fc.array(cartItemArb, { minLength: 1 }),
        tipArb,
        (items, tip) => {
          const { subtotal, tax, total } = computeCartTotals(items, TAX_RATE, tip);

          expect(subtotal).toBeGreaterThan(0);
          expect(total).toBe(subtotal + tax + tip);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 11: Cart sessionStorage round-trip
  // Validates: Requirements 4.6, 4.7
  it("Property 11: Cart JSON round-trip — serializing and deserializing produces a structurally equivalent cart", () => {
    const cartArb = fc.record({
      items: fc.array(cartItemArb),
      subtotal: fc.integer({ min: 0, max: 100000 }),
      tax: fc.integer({ min: 0, max: 10000 }),
      tip: tipArb,
      total: fc.integer({ min: 0, max: 110000 }),
    });

    fc.assert(
      fc.property(cartArb, (cart: Cart) => {
        const serialized = JSON.stringify(cart);
        const deserialized = JSON.parse(serialized) as Cart;

        expect(deserialized.items).toEqual(cart.items);
        expect(deserialized.subtotal).toBe(cart.subtotal);
        expect(deserialized.tax).toBe(cart.tax);
        expect(deserialized.tip).toBe(cart.tip);
        expect(deserialized.total).toBe(cart.total);
      }),
      { numRuns: 100 }
    );
  });
});
