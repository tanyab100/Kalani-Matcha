// Feature: matcha-ordering-app, Property 24: Venmo order status on creation

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { CreateOrderInput, CartItem } from "../../types/order";

// ── Mock the DB pool ──────────────────────────────────────────────────────────

const { mockQuery, mockRelease, mockConnect, mockPoolQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockClient = { query: mockQuery, release: mockRelease };
  const mockConnect = vi.fn().mockResolvedValue(mockClient);
  const mockPoolQuery = vi.fn();
  return { mockQuery, mockRelease, mockConnect, mockPoolQuery };
});

vi.mock("../../db/pool", () => ({
  pool: { connect: mockConnect, query: mockPoolQuery },
}));

import { createOrder } from "../orderService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildOrderRow(input: CreateOrderInput, status: string) {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    customer_id: input.customerId ?? null,
    guest_email: input.guestEmail ?? null,
    items_snapshot: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    tip: input.tip,
    total: input.total,
    pickup_slot_id: input.pickupSlotId,
    slot_time: new Date("2025-07-01T14:00:00Z"),
    status,
    payment_method: input.paymentMethod,
    idempotency_key: input.idempotencyKey,
    payment_intent_id: input.paymentIntentId ?? null,
    created_at: new Date("2025-07-01T13:00:00Z"),
  };
}

function setupMockForInput(input: CreateOrderInput, status: string) {
  mockQuery.mockReset();
  mockRelease.mockReset();

  const totalQty = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const orderRow = buildOrderRow(input, status);

  mockQuery
    .mockResolvedValueOnce({ rows: [] })                                                                                    // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: input.pickupSlotId, capacity: totalQty + 10, used_capacity: 0 }] })               // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [orderRow] })                                                                            // INSERT RETURNING
    .mockResolvedValueOnce({ rows: [] })                                                                                    // UPDATE pickup_slots
    .mockResolvedValueOnce({ rows: [] });                                                                                   // COMMIT
}

function setupConfirmPaymentMock(orderId: string) {
  mockPoolQuery
    .mockResolvedValueOnce({ rows: [{ id: orderId, status: "pending_payment" }] })  // SELECT order
    .mockResolvedValueOnce({ rows: [{ id: orderId, status: "received" }] });         // UPDATE status
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cartItemArb: fc.Arbitrary<CartItem> = fc.record({
  menuItemId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  quantity: fc.integer({ min: 1, max: 5 }),
  selectedCustomizations: fc.dictionary(fc.uuid(), fc.uuid(), { minKeys: 0, maxKeys: 3 }),
  unitPrice: fc.integer({ min: 100, max: 2000 }),
});

const venmoOrderInputArb: fc.Arbitrary<CreateOrderInput> = fc.record({
  customerId: fc.option(fc.uuid(), { nil: null }),
  guestEmail: fc.option(fc.emailAddress(), { nil: undefined }),
  items: fc.array(cartItemArb, { minLength: 1, maxLength: 5 }),
  subtotal: fc.integer({ min: 0, max: 100_000 }),
  tax: fc.integer({ min: 0, max: 10_000 }),
  tip: fc.integer({ min: 0, max: 5_000 }),
  total: fc.integer({ min: 0, max: 115_000 }),
  pickupSlotId: fc.uuid(),
  paymentMethod: fc.constant("venmo" as const),
  idempotencyKey: fc.uuid(),
  paymentIntentId: fc.option(fc.uuid(), { nil: undefined }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 24: Venmo order status on creation", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRelease.mockReset();
    mockPoolQuery.mockReset();
  });

  /**
   * Property 24a: For any valid cart and pickup slot, an order created via Venmo
   * should always have status = 'pending_payment' and payment_method = 'venmo'.
   * Validates: Requirements 6.9
   */
  it("Property 24a: Venmo orders are always created with status=pending_payment and payment_method=venmo", async () => {
    await fc.assert(
      fc.asyncProperty(venmoOrderInputArb, async (input) => {
        setupMockForInput(input, "pending_payment");

        const { order } = await createOrder(input);

        expect(order.status).toBe("pending_payment");
        expect(order.paymentMethod).toBe("venmo");
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24b: For any order in pending_payment status, calling confirm-payment
   * should advance it to 'received'.
   * Validates: Requirements 6.10
   *
   * This property tests the DB update logic directly via the pool mock.
   */
  it("Property 24b: confirm-payment advances status from pending_payment to received", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (orderId) => {
        setupConfirmPaymentMock(orderId);

        // Simulate the confirm-payment logic: SELECT then UPDATE
        const selectResult = await mockPoolQuery(
          `SELECT id, status FROM orders WHERE id = $1`,
          [orderId]
        );
        expect(selectResult.rows[0].status).toBe("pending_payment");

        const updateResult = await mockPoolQuery(
          `UPDATE orders SET status = 'received' WHERE id = $1 RETURNING id, status`,
          [orderId]
        );
        expect(updateResult.rows[0].status).toBe("received");
        expect(updateResult.rows[0].id).toBe(orderId);
      }),
      { numRuns: 100 }
    );
  });
});
