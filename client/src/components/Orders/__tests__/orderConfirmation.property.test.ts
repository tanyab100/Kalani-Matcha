// Feature: matcha-ordering-app, Property 18: Order confirmation rendering
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { renderOrderConfirmation, type Order } from "../OrderConfirmation";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 10 }),
  selectedCustomizations: fc.dictionary(fc.uuid(), fc.uuid()),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

// Generate valid ISO 8601 date strings (future dates to be realistic)
const isoDateArb = fc
  .date({ min: new Date("2025-01-01"), max: new Date("2030-12-31") })
  .map((d) => d.toISOString());

const orderStatusArb = fc.constantFrom(
  "pending_payment",
  "received",
  "preparing",
  "ready"
) as fc.Arbitrary<Order["status"]>;

const paymentMethodArb = fc.constantFrom(
  "card",
  "venmo"
) as fc.Arbitrary<Order["paymentMethod"]>;

const orderArb: fc.Arbitrary<Order> = fc.record({
  id: fc.uuid(),
  customerId: fc.option(fc.uuid(), { nil: null }),
  guestEmail: fc.option(fc.emailAddress(), { nil: undefined }),
  items: fc.array(cartItemArb, { minLength: 1, maxLength: 10 }),
  subtotal: fc.integer({ min: 100, max: 100000 }),
  tax: fc.integer({ min: 0, max: 10000 }),
  tip: fc.integer({ min: 0, max: 5000 }),
  total: fc.integer({ min: 100, max: 115000 }),
  pickupSlotId: fc.uuid(),
  pickupTime: isoDateArb,
  status: orderStatusArb,
  paymentMethod: paymentMethodArb,
  createdAt: isoDateArb,
  idempotencyKey: fc.uuid(),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Order confirmation rendering property tests", () => {
  // Feature: matcha-ordering-app, Property 18: Order confirmation rendering
  // Validates: Requirements 7.1
  it("Property 18: renderOrderConfirmation — order number, pickup time, all items, and totals are present and correct", () => {
    fc.assert(
      fc.property(orderArb, (order) => {
        const result = renderOrderConfirmation(order);

        // 1. orderId is a non-empty string (order number is present)
        expect(typeof result.orderId).toBe("string");
        expect(result.orderId.length).toBeGreaterThan(0);

        // 2. pickupTime is a non-empty string (pickup time is present)
        expect(typeof result.pickupTime).toBe("string");
        expect(result.pickupTime.length).toBeGreaterThan(0);

        // 3. items has the same length as order.items (all items present)
        expect(result.items.length).toBe(order.items.length);

        // 4–6. Per-item: name, quantity, and linePrice
        for (let i = 0; i < order.items.length; i++) {
          expect(result.items[i].name).toBe(order.items[i].name);
          expect(result.items[i].quantity).toBe(order.items[i].quantity);
          expect(result.items[i].linePrice).toBe(
            order.items[i].unitPrice * order.items[i].quantity
          );
        }

        // 7–10. Totals pass through unchanged
        expect(result.subtotal).toBe(order.subtotal);
        expect(result.tax).toBe(order.tax);
        expect(result.tip).toBe(order.tip);
        expect(result.total).toBe(order.total);
      }),
      { numRuns: 100 }
    );
  });
});
