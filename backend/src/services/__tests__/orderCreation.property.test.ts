// Feature: matcha-ordering-app, Property 15: Order created on confirmed payment

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { CreateOrderInput, CartItem } from "../../types/order";

// ── Mock the DB pool ──────────────────────────────────────────────────────────
// Use vi.hoisted so the mock objects are available inside the vi.mock factory.

const { mockQuery, mockRelease, mockConnect } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockClient = { query: mockQuery, release: mockRelease };
  const mockConnect = vi.fn().mockResolvedValue(mockClient);
  return { mockQuery, mockRelease, mockConnect };
});

vi.mock("../../db/pool", () => ({
  pool: { connect: mockConnect },
}));

// Import the service AFTER the mock is registered
import { createOrder } from "../orderService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildOrderRow(input: CreateOrderInput, status: string) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    customer_id: input.customerId ?? null,
    guest_email: input.guestEmail ?? null,
    items_snapshot: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    tip: input.tip,
    total: input.total,
    pickup_slot_id: input.pickupSlotId,
    slot_time: new Date("2025-06-01T12:00:00Z"),
    status,
    payment_method: input.paymentMethod,
    idempotency_key: input.idempotencyKey,
    payment_intent_id: input.paymentIntentId ?? null,
    created_at: new Date("2025-06-01T11:00:00Z"),
  };
}

/**
 * Configure mockQuery for a successful createOrder transaction:
 *   1. BEGIN
 *   2. SELECT ... FOR UPDATE  → slot with capacity=10, used_capacity=0
 *   3. INSERT INTO orders ... RETURNING  → the order row
 *   4. UPDATE pickup_slots
 *   5. COMMIT
 */
function setupMockForInput(input: CreateOrderInput, status: string) {
  mockQuery.mockReset();
  mockRelease.mockReset();

  const orderRow = buildOrderRow(input, status);
  // Capacity must be >= total item quantity so the order is always accepted
  const totalQty = input.items.reduce((sum, item) => sum + item.quantity, 0);

  mockQuery
    .mockResolvedValueOnce({ rows: [] })                                                                                    // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: input.pickupSlotId, capacity: totalQty + 10, used_capacity: 0 }] })               // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [orderRow] })                                                                            // INSERT RETURNING
    .mockResolvedValueOnce({ rows: [] })                                                                                    // UPDATE pickup_slots
    .mockResolvedValueOnce({ rows: [] });                                                                                   // COMMIT
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb: fc.Arbitrary<CartItem> = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 5 }),
  selectedCustomizations: fc.dictionary(
    fc.uuid(),
    fc.uuid(),
    { minKeys: 0, maxKeys: 3 }
  ),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

const createOrderInputArb: fc.Arbitrary<CreateOrderInput> = fc.record({
  customerId: fc.option(fc.uuid(), { nil: null }),
  guestEmail: fc.option(fc.emailAddress(), { nil: undefined }),
  items: fc.array(cartItemArb, { minLength: 1, maxLength: 5 }),
  subtotal: fc.integer({ min: 0, max: 100_000 }),
  tax: fc.integer({ min: 0, max: 10_000 }),
  tip: fc.integer({ min: 0, max: 5_000 }),
  total: fc.integer({ min: 0, max: 115_000 }),
  pickupSlotId: fc.uuid(),
  paymentMethod: fc.constantFrom("card" as const, "venmo" as const),
  idempotencyKey: fc.uuid(),
  paymentIntentId: fc.option(fc.uuid(), { nil: undefined }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Order creation property tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRelease.mockReset();
  });

  /**
   * Property 15: Order created on confirmed payment
   * Validates: Requirements 5.9, 6.6
   */
  it("Property 15: createOrder — produces exactly one order with all input fields preserved and correct status", async () => {
    await fc.assert(
      fc.asyncProperty(createOrderInputArb, async (input) => {
        const expectedStatus = input.paymentMethod === "venmo" ? "pending_payment" : "received";
        setupMockForInput(input, expectedStatus);

        const { order } = await createOrder(input);

        // 1. Exactly one order returned (no throw = one order created)
        expect(order).toBeDefined();

        // 2. All cart items preserved (same menuItemIds, quantities, customizations)
        expect(order.items).toHaveLength(input.items.length);
        for (let i = 0; i < input.items.length; i++) {
          expect(order.items[i].menuItemId).toBe(input.items[i].menuItemId);
          expect(order.items[i].quantity).toBe(input.items[i].quantity);
          expect(order.items[i].selectedCustomizations).toEqual(
            input.items[i].selectedCustomizations
          );
        }

        // 3. Correct financial totals
        expect(order.subtotal).toBe(input.subtotal);
        expect(order.tax).toBe(input.tax);
        expect(order.tip).toBe(input.tip);
        expect(order.total).toBe(input.total);

        // 4. Correct pickup slot
        expect(order.pickupSlotId).toBe(input.pickupSlotId);

        // 5. Status: 'received' for card, 'pending_payment' for venmo
        expect(order.status).toBe(expectedStatus);

        // 6. Idempotency key preserved
        expect(order.idempotencyKey).toBe(input.idempotencyKey);
      }),
      { numRuns: 100 }
    );
  });
});
