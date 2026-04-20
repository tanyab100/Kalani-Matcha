import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Hoist mock objects so they're available inside vi.mock factories ──────────
const { mockConstructEvent, mockCreateOrder, mockGetOrderByIdempotencyKey, mockCreateRedirectToken } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockCreateOrder = vi.fn();
  const mockGetOrderByIdempotencyKey = vi.fn();
  const mockCreateRedirectToken = vi.fn().mockResolvedValue("redirect-token-123");
  return { mockConstructEvent, mockCreateOrder, mockGetOrderByIdempotencyKey, mockCreateRedirectToken };
});

// Mock stripe config — must be before any import that uses it
vi.mock("../../config/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}));

// Mock orderService
vi.mock("../../services/orderService", () => ({
  createOrder: mockCreateOrder,
  getOrderByIdempotencyKey: mockGetOrderByIdempotencyKey,
  createRedirectToken: mockCreateRedirectToken,
}));

// Import app AFTER mocks are registered
import { app } from "../../app";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_ITEMS = JSON.stringify([
  {
    menuItemId: "item-1",
    name: "Matcha Latte",
    quantity: 2,
    selectedCustomizations: {},
    unitPrice: 550,
  },
]);

const VALID_METADATA = {
  idempotencyKey: "idem-key-123",
  customerId: "",
  guestEmail: "guest@example.com",
  pickupSlotId: "slot-uuid-1",
  subtotal: "1100",
  tax: "99",
  tip: "0",
  total: "1199",
  items: VALID_ITEMS,
  paymentMethod: "card",
};

function makeSucceededEvent(metadata: Record<string, string> = VALID_METADATA) {
  return {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_123",
        metadata,
      },
    },
  };
}

const VALID_ORDER = {
  id: "order-uuid-1",
  customerId: null,
  guestEmail: "guest@example.com",
  items: JSON.parse(VALID_ITEMS),
  subtotal: 1100,
  tax: 99,
  tip: 0,
  total: 1199,
  pickupSlotId: "slot-uuid-1",
  pickupTime: "2025-06-01T12:00:00Z",
  status: "received",
  paymentMethod: "card",
  createdAt: "2025-06-01T11:00:00Z",
  idempotencyKey: "idem-key-123",
  paymentIntentId: "pi_test_123",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /webhook/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Signature verification ─────────────────────────────────────────────────

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("MISSING_SIGNATURE");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "bad-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_SIGNATURE");
    expect(res.body.message).toContain("No signatures found");
  });

  it("returns 200 for an unhandled event type", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  // ── Integration: payment_intent.succeeded → order creation ────────────────

  it("creates an order and returns 200 with orderId on valid payment_intent.succeeded", async () => {
    mockConstructEvent.mockReturnValue(makeSucceededEvent());
    mockGetOrderByIdempotencyKey.mockResolvedValue(null); // no existing order
    mockCreateOrder.mockResolvedValue({ order: VALID_ORDER, accessToken: "" });

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.orderId).toBe(VALID_ORDER.id);

    // Verify createOrder was called with the correct arguments
    expect(mockCreateOrder).toHaveBeenCalledOnce();
    expect(mockCreateOrder).toHaveBeenCalledWith({
      customerId: null,
      guestEmail: "guest@example.com",
      items: JSON.parse(VALID_ITEMS),
      subtotal: 1100,
      tax: 99,
      tip: 0,
      total: 1199,
      pickupSlotId: "slot-uuid-1",
      paymentMethod: "card",
      idempotencyKey: "idem-key-123",
      paymentIntentId: "pi_test_123",
    });
  });

  it("returns 200 with existing orderId when idempotency key already exists (no duplicate)", async () => {
    mockConstructEvent.mockReturnValue(makeSucceededEvent());
    // Simulate order already created for this idempotency key
    mockGetOrderByIdempotencyKey.mockResolvedValue(VALID_ORDER);

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, orderId: VALID_ORDER.id });

    // createOrder must NOT be called — idempotency short-circuit
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  // ── Metadata parsing ───────────────────────────────────────────────────────

  it("returns 400 when items metadata is invalid JSON", async () => {
    const badMetadata = { ...VALID_METADATA, items: "not-valid-json{{" };
    mockConstructEvent.mockReturnValue(makeSucceededEvent(badMetadata));
    mockGetOrderByIdempotencyKey.mockResolvedValue(null);

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("INVALID_METADATA");
  });
});
