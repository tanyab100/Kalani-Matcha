// Feature: matcha-ordering-app, Property 19: Order history sort order
// Feature: matcha-ordering-app, Property 20: Order history detail completeness

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  sortOrderHistory,
  renderOrderDetail,
  type HistoryOrder,
} from "../OrderHistoryPage";
import type { CartItem } from "../OrderConfirmation";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb: fc.Arbitrary<CartItem> = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 10 }),
  selectedCustomizations: fc.dictionary(fc.uuid(), fc.uuid()),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

const isoDateArb = fc
  .date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") })
  .map((d) => d.toISOString());

const historyOrderArb: fc.Arbitrary<HistoryOrder> = fc.record({
  id: fc.uuid(),
  createdAt: isoDateArb,
  total: fc.integer({ min: 100, max: 100000 }),
  items: fc.array(cartItemArb, { minLength: 1, maxLength: 5 }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Order history property tests", () => {
  // Feature: matcha-ordering-app, Property 19: Order history sort order
  // Validates: Requirements 8.1
  it("Property 19: sortOrderHistory — orders are sorted by createdAt descending with no orders omitted", () => {
    fc.assert(
      fc.property(fc.array(historyOrderArb), (orders) => {
        const sorted = sortOrderHistory(orders);

        // No orders omitted: same length
        expect(sorted).toHaveLength(orders.length);

        // All original orders are present (by id)
        const originalIds = new Set(orders.map((o) => o.id));
        const sortedIds = new Set(sorted.map((o) => o.id));
        expect(sortedIds).toEqual(originalIds);

        // Sorted descending by createdAt
        for (let i = 0; i < sorted.length - 1; i++) {
          const a = new Date(sorted[i].createdAt).getTime();
          const b = new Date(sorted[i + 1].createdAt).getTime();
          expect(a).toBeGreaterThanOrEqual(b);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 20: Order history detail completeness
  // Validates: Requirements 8.2
  it("Property 20: renderOrderDetail — includes all items with customizations, order total, and order date", () => {
    fc.assert(
      fc.property(historyOrderArb, (order) => {
        const detail = renderOrderDetail(order);

        // Order date is present and non-empty
        expect(typeof detail.date).toBe("string");
        expect(detail.date.length).toBeGreaterThan(0);

        // Order total is present (formatted as a currency string)
        expect(typeof detail.total).toBe("string");
        expect(detail.total.length).toBeGreaterThan(0);
        // Total value matches: $X.XX format (total / 100 formatted to 2 decimal places)
        expect(detail.total).toBe(`$${(order.total / 100).toFixed(2)}`);

        // All items are present
        expect(detail.items).toHaveLength(order.items.length);

        for (let i = 0; i < order.items.length; i++) {
          const resultItem = detail.items[i];
          const sourceItem = order.items[i];

          // Item name is preserved
          expect(resultItem.name).toBe(sourceItem.name);

          // Item quantity is preserved
          expect(resultItem.quantity).toBe(sourceItem.quantity);

          // Customizations are present: one entry per selectedCustomization value
          const expectedCustomizations = Object.values(sourceItem.selectedCustomizations);
          expect(resultItem.customizations).toEqual(expectedCustomizations);
        }
      }),
      { numRuns: 100 }
    );
  });
});
