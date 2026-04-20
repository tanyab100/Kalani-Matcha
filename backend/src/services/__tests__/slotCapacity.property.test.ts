// Feature: matcha-ordering-app, Property 22: Slot capacity enforcement
// Feature: matcha-ordering-app, Property 23: Slot usage calculation

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  canAcceptOrder,
  calculateOrderCapacityUnits,
  calculateSlotUsage,
} from "../slotCapacity";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const slotArb = fc.record({
  capacity: fc.integer({ min: 1, max: 20 }),
  usedCapacity: fc.integer({ min: 0, max: 20 }),
});

const orderUnitsArb = fc.integer({ min: 1, max: 20 });

const itemArb = fc.record({
  quantity: fc.integer({ min: 1, max: 10 }),
});

const orderArb = fc.record({
  items: fc.array(itemArb, { minLength: 1, maxLength: 5 }),
});

const ordersArb = fc.array(orderArb, { minLength: 0, maxLength: 10 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Slot capacity property tests", () => {
  /**
   * Property 22: Slot capacity enforcement
   * Validates: Requirements 11.2, 11.4
   */
  it("Property 22: canAcceptOrder — allowed if and only if usedCapacity + orderUnits <= capacity", () => {
    fc.assert(
      fc.property(slotArb, orderUnitsArb, (slot, orderUnits) => {
        const result = canAcceptOrder(slot, orderUnits);
        const expected = slot.usedCapacity + orderUnits <= slot.capacity;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: Slot usage calculation
   * Validates: Requirements 11.4
   */
  it("Property 23: calculateSlotUsage — equals sum of all item quantities across all orders", () => {
    fc.assert(
      fc.property(ordersArb, (orders) => {
        const result = calculateSlotUsage(orders);
        const expected = orders.reduce(
          (total, order) =>
            total + order.items.reduce((sum, item) => sum + item.quantity, 0),
          0
        );
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});
