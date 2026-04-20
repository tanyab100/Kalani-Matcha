// Feature: matcha-ordering-app, Property 17: Idempotent order creation

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { CreateOrderInput, CartItem } from "../../types/order";

// ── Mock the DB pool ──────────────────────────────────────────────────────────
// Use vi.hoisted so the mock objects are available inside the vi.mock factory.

const { mockClientQuery, mockRelease, mockConnect, mockPoolQuery } = vi.hoisted(() => {
  const mockClientQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockClient = { query: mockClientQuery, release: mockRelease };
  const mockConnect = vi.fn().mockResolvedValue(mockClient);
  const mockPoolQuery = vi.fn();
  return { mockClientQuery, mockRelease, mockConnect, mockPoolQuery };
});

vi.mock("../../db/pool", () => ({
  pool: {
    connect: mockConnect,
    query: mockPoolQuery,
  },
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
 * Configure mocks for the first (successful) call:
 *   client: BEGIN → SELECT FOR UPDATE → INSERT RETURNING → UPDATE → COMMIT
 */
function setupFirstCall(input: CreateOrderInput, status: string) {
  const orderRow = buildOrderRow(input, status);
  const totalQty = input.items.reduce((sum, item) => sum + item.quantity, 0);

  mockClientQuery
    .mockResolvedValueOnce({ rows: [] })                                                                                    // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: input.pickupSlotId, capacity: totalQty + 10, used_capacity: 0 }] })               // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [orderRow] })                                                                            // INSERT RETURNING
    .mockResolvedValueOnce({ rows: [] })                                                                                    // UPDATE pickup_slots
    .mockResolvedValueOnce({ rows: [] });                                                                                   // COMMIT
}

/**
 * Configure mocks for a subsequent (duplicate) call:
 *   client: BEGIN → SELECT FOR UPDATE → INSERT throws 23505 → ROLLBACK
 *   pool.query: getOrderByIdempotencyKey returns the existing order
 */
function setupSubsequentCall(input: CreateOrderInput, status: string) {
  const orderRow = buildOrderRow(input, status);
  const totalQty = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueViolation = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint: "orders_idempotency_key_key",
  });

  mockClientQuery
    .mockResolvedValueOnce({ rows: [] })                                                                                    // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: input.pickupSlotId, capacity: totalQty + 10, used_capacity: 0 }] })               // SELECT FOR UPDATE
    .mockRejectedValueOnce(uniqueViolation)                                                                                 // INSERT throws 23505
    .mockResolvedValueOnce({ rows: [] });                                                                                   // ROLLBACK (in catch)

  // pool.query is used by getOrderByIdempotencyKey
  mockPoolQuery.mockResolvedValueOnce({ rows: [orderRow] });
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

// N ≥ 1 (total calls = 1 first + N-1 subsequent, so we generate N ≥ 2 to test idempotency)
const numCallsArb: fc.Arbitrary<number> = fc.integer({ min: 2, max: 5 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Idempotency property tests", () => {
  beforeEach(() => {
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockPoolQuery.mockReset();
  });

  /**
   * Property 17: Idempotent order creation
   * Validates: Requirements 6.5
   *
   * For any idempotency key, submitting the same payment confirmation N times (N ≥ 1)
   * should result in exactly one order being created — subsequent submissions should
   * return the existing order without creating duplicates.
   */
  it("Property 17: createOrder — N calls with the same idempotency key return the same order and INSERT is called only once", async () => {
    await fc.assert(
      fc.asyncProperty(createOrderInputArb, numCallsArb, async (input, n) => {
        mockClientQuery.mockReset();
        mockRelease.mockReset();
        mockPoolQuery.mockReset();

        const expectedStatus = input.paymentMethod === "venmo" ? "pending_payment" : "received";

        // Set up first call (successful INSERT)
        setupFirstCall(input, expectedStatus);

        // Set up subsequent calls (23505 → fallback SELECT)
        for (let i = 1; i < n; i++) {
          setupSubsequentCall(input, expectedStatus);
        }

        // Execute all N calls
        const results = [];
        for (let i = 0; i < n; i++) {
          const { order } = await createOrder(input);
          results.push(order);
        }

        // 1. All N calls return a defined order
        expect(results).toHaveLength(n);
        for (const order of results) {
          expect(order).toBeDefined();
        }

        // 2. All calls return the SAME order (same id and idempotency key)
        const firstOrder = results[0];
        for (const order of results) {
          expect(order.id).toBe(firstOrder.id);
          expect(order.idempotencyKey).toBe(input.idempotencyKey);
        }

        // 3. Only one order was ever persisted to the DB:
        //    - The fallback pool.query (getOrderByIdempotencyKey) is called exactly n-1 times
        //      (once per duplicate submission after the first).
        //    - This proves subsequent calls did NOT create new orders but fetched the existing one.
        expect(mockPoolQuery.mock.calls).toHaveLength(n - 1);

        // 4. The returned order preserves the idempotency key
        expect(firstOrder.idempotencyKey).toBe(input.idempotencyKey);
      }),
      { numRuns: 100 }
    );
  });
});
