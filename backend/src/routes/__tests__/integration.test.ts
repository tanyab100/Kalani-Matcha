/**
 * End-to-end integration tests for the matcha ordering app backend.
 *
 * Covers:
 *   Flow 1: Full checkout (card) — payment intent → webhook → order confirmation + idempotency
 *   Flow 2: Reorder — history → reorder → cart payload (with unavailable item exclusion)
 *   Flow 3: Order status polling — GET /orders/:id reflects status changes
 *
 * Requirements: 5.9, 8.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";

// ── Hoist mock objects ────────────────────────────────────────────────────────
const {
  mockConstructEvent,
  mockPaymentIntentsCreate,
  mockQuery,
  mockConnect,
  mockClientQuery,
  mockClientRelease,
} = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockPaymentIntentsCreate = vi.fn();
  const mockQuery = vi.fn();
  const mockClientQuery = vi.fn();
  const mockClientRelease = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  });
  return {
    mockConstructEvent,
    mockPaymentIntentsCreate,
    mockQuery,
    mockConnect,
    mockClientQuery,
    mockClientRelease,
  };
});

// Mock stripe — must be before any import that uses it
vi.mock("../../config/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    paymentIntents: { create: mockPaymentIntentsCreate },
  },
}));

// Mock pool — must be before any import that uses it
vi.mock("../../db/pool", () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

// Import app AFTER mocks are registered
import { app } from "../../app";

// ── Constants ─────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret";
const CUSTOMER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORDER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SLOT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MENU_ITEM_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const IDEM_KEY = "idem-key-integration-test-001";
const PI_ID = "pi_integration_test_001";

// A plaintext access token and its SHA-256 hash (simulates what orderService generates)
const ACCESS_TOKEN_PLAINTEXT = "a".repeat(64);
const ACCESS_TOKEN_HASH = createHash("sha256").update(ACCESS_TOKEN_PLAINTEXT).digest("hex");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAuthToken(customerId = CUSTOMER_ID) {
  return jwt.sign({ id: customerId, email: "customer@example.com", role: "customer" }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

const CART_ITEMS = [
  {
    menuItemId: MENU_ITEM_ID,
    name: "Matcha Latte",
    quantity: 2,
    selectedCustomizations: {},
    unitPrice: 550,
  },
];

const CART_ITEMS_JSON = JSON.stringify(CART_ITEMS);

// Metadata that Stripe stores on the PaymentIntent and the webhook delivers back
const WEBHOOK_METADATA = {
  idempotencyKey: IDEM_KEY,
  customerId: CUSTOMER_ID,
  guestEmail: "",
  pickupSlotId: SLOT_ID,
  subtotal: "1100",
  tax: "99",
  tip: "0",
  total: "1199",
  items: CART_ITEMS_JSON,
  paymentMethod: "card",
};

function makeSucceededEvent(metadata = WEBHOOK_METADATA) {
  return {
    type: "payment_intent.succeeded",
    data: { object: { id: PI_ID, metadata } },
  };
}

// A fully-formed order row as returned by the DB (after JOIN with pickup_slots)
const ORDER_ROW = {
  id: ORDER_ID,
  customer_id: CUSTOMER_ID,
  guest_email: null,
  items_snapshot: CART_ITEMS,
  subtotal: 1100,
  tax: 99,
  tip: 0,
  total: 1199,
  pickup_slot_id: SLOT_ID,
  slot_time: new Date("2025-12-01T14:00:00Z"),
  status: "received",
  payment_method: "card",
  payment_reference: null,
  payment_confirmed_at: null,
  payment_confirmed_by: null,
  created_at: new Date("2025-12-01T13:00:00Z"),
  idempotency_key: IDEM_KEY,
  payment_intent_id: PI_ID,
  access_token_hash: ACCESS_TOKEN_HASH,
};

// Slot row returned by the DB — slot_time must be at least 10 minutes in the future
// AND within store hours (9 AM–5 PM Pacific). We pick noon Pacific on the next calendar day
// to guarantee both constraints regardless of when the test runs.
function nextNoonPacific(): Date {
  const now = new Date();
  // Get tomorrow's date in Pacific time
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
  // Build "YYYY-MM-DD 12:00:00" in Pacific, then convert to UTC
  const [month, day, year] = tomorrowStr.split("/");
  // Use Intl to find the UTC offset for noon Pacific on that date
  const noonPacificStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T12:00:00`;
  // Create a date as if it were UTC, then adjust for Pacific offset
  // Simpler: just use a fixed offset approach via toLocaleString round-trip
  const candidate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T20:00:00Z`); // noon PST (UTC-8)
  return candidate;
}

const FUTURE_SLOT_TIME = nextNoonPacific();
const SLOT_ROW = {
  id: SLOT_ID,
  slot_time: FUTURE_SLOT_TIME,
  capacity: 5,
  used_capacity: 0,
};

// Menu item row (flat, as returned by the checkout intent query)
const MENU_ITEM_FLAT_ROW = {
  menu_item_id: MENU_ITEM_ID,
  base_price: 550,
  group_id: null,
  option_id: null,
  price_delta: null,
};

// Menu item row for reorder (with customizations JSON)
const MENU_ITEM_REORDER_ROW = {
  id: MENU_ITEM_ID,
  name: "Matcha Latte",
  description: "Classic matcha latte",
  base_price: 550,
  category: "drinks",
  in_stock: true,
  customizations: null,
};

// ── Flow 1: Full checkout (card) ──────────────────────────────────────────────

describe("Flow 1: Full checkout — payment intent → webhook → order confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("POST /checkout/intent returns clientSecret for a valid cart and slot", async () => {
    // DB: menu items query
    mockQuery.mockResolvedValueOnce({ rows: [MENU_ITEM_FLAT_ROW] });
    // DB: slot availability query
    mockQuery.mockResolvedValueOnce({ rows: [SLOT_ROW] });
    // Stripe: create payment intent
    mockPaymentIntentsCreate.mockResolvedValueOnce({
      client_secret: "pi_secret_test_abc",
    });

    const res = await request(app)
      .post("/checkout/intent")
      .send({
        cart: { items: CART_ITEMS, tip: 0 },
        pickupSlotId: SLOT_ID,
        idempotencyKey: IDEM_KEY,
        paymentMethod: "card",
        customerId: CUSTOMER_ID,
      });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe("pi_secret_test_abc");
    expect(res.body.serverTotals).toMatchObject({
      subtotal: 1100,
      tax: expect.any(Number),
      tip: 0,
    });
    expect(mockPaymentIntentsCreate).toHaveBeenCalledOnce();
  });

  it("POST /webhook/payment creates an order on payment_intent.succeeded", async () => {
    mockConstructEvent.mockReturnValue(makeSucceededEvent());

    // getOrderByIdempotencyKey → no existing order
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // createOrder uses pool.connect() for a transaction
    // Sequence: BEGIN, SELECT slot FOR UPDATE, INSERT order, UPDATE slot, COMMIT
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [SLOT_ROW] }) // SELECT slot FOR UPDATE
      .mockResolvedValueOnce({ rows: [ORDER_ROW] }) // INSERT order RETURNING
      .mockResolvedValueOnce({}) // UPDATE pickup_slots
      .mockResolvedValueOnce({}); // COMMIT

    // createRedirectToken: INSERT into order_redirect_tokens
    mockQuery.mockResolvedValueOnce({});

    const res = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.orderId).toBe(ORDER_ID);
  });

  it("GET /orders/:id returns order with status 'received' and correct items", async () => {
    // pool.query for GET /orders/:id (token-based access)
    mockQuery.mockResolvedValueOnce({ rows: [ORDER_ROW] });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .query({ token: ACCESS_TOKEN_PLAINTEXT });

    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({
      id: ORDER_ID,
      status: "received",
      pickupSlotId: SLOT_ID,
      items: expect.arrayContaining([
        expect.objectContaining({ menuItemId: MENU_ITEM_ID, quantity: 2 }),
      ]),
    });
  });

  it("idempotency: duplicate webhook event returns same order without creating a duplicate", async () => {
    // First delivery
    mockConstructEvent.mockReturnValue(makeSucceededEvent());
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing order
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [SLOT_ROW] }) // SELECT slot FOR UPDATE
      .mockResolvedValueOnce({ rows: [ORDER_ROW] }) // INSERT order RETURNING
      .mockResolvedValueOnce({}) // UPDATE pickup_slots
      .mockResolvedValueOnce({}); // COMMIT
    mockQuery.mockResolvedValueOnce({}); // createRedirectToken INSERT

    const res1 = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res1.status).toBe(200);
    expect(res1.body.orderId).toBe(ORDER_ID);

    // Second delivery (same event) — idempotency key already exists
    vi.clearAllMocks();
    mockConstructEvent.mockReturnValue(makeSucceededEvent());
    // getOrderByIdempotencyKey returns the existing order → short-circuit
    mockQuery.mockResolvedValueOnce({ rows: [ORDER_ROW] });

    const res2 = await request(app)
      .post("/webhook/payment")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "valid-sig")
      .send(Buffer.from("{}"));

    expect(res2.status).toBe(200);
    expect(res2.body.orderId).toBe(ORDER_ID);
    // createOrder (pool.connect) must NOT have been called on the second delivery
    expect(mockConnect).not.toHaveBeenCalled();
  });
});

// ── Flow 2: Reorder ───────────────────────────────────────────────────────────

describe("Flow 2: Reorder — history → reorder → cart payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("GET /orders/history returns past orders sorted newest first", async () => {
    const olderOrder = {
      ...ORDER_ROW,
      id: "order-older",
      created_at: new Date("2025-11-01T10:00:00Z"),
    };
    const newerOrder = {
      ...ORDER_ROW,
      id: "order-newer",
      created_at: new Date("2025-12-01T13:00:00Z"),
    };

    // DB returns rows already sorted by created_at DESC (as the query specifies)
    mockQuery.mockResolvedValueOnce({ rows: [newerOrder, olderOrder] });

    const res = await request(app)
      .get("/orders/history")
      .set("Authorization", `Bearer ${makeAuthToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    // Newest first
    expect(res.body.orders[0].id).toBe("order-newer");
    expect(res.body.orders[1].id).toBe("order-older");
  });

  it("POST /orders/:id/reorder returns cart payload with items at current prices", async () => {
    // Order lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: CART_ITEMS }],
    });
    // Menu lookup
    mockQuery.mockResolvedValueOnce({ rows: [MENU_ITEM_REORDER_ROW] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeAuthToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      menuItemId: MENU_ITEM_ID,
      name: "Matcha Latte",
      quantity: 2,
      unitPrice: 550, // current menu price
    });
    expect(res.body.unavailableItems).toEqual([]);
    expect(res.body.staleCustomizationItems).toEqual([]);
  });

  it("POST /orders/:id/reorder excludes unavailable items from the cart payload", async () => {
    const pastItems = [
      ...CART_ITEMS,
      {
        menuItemId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        name: "Matcha Cookie",
        quantity: 1,
        selectedCustomizations: {},
        unitPrice: 300,
      },
    ];

    // Order lookup
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: pastItems }],
    });
    // Menu lookup — only the Matcha Latte is still available; cookie was removed
    mockQuery.mockResolvedValueOnce({ rows: [MENU_ITEM_REORDER_ROW] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeAuthToken()}`);

    expect(res.status).toBe(200);
    // Only the available item is in the cart
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].menuItemId).toBe(MENU_ITEM_ID);
    // Removed item is reported as unavailable (Req 8.4)
    expect(res.body.unavailableItems).toContain("Matcha Cookie");
  });

  it("GET /orders/history returns 401 without auth token (Req 1.3)", async () => {
    const res = await request(app).get("/orders/history");
    expect(res.status).toBe(401);
  });
});

// ── Flow 3: Order status polling ──────────────────────────────────────────────

describe("Flow 3: Order status polling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("GET /orders/:id returns current status with valid access token", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ORDER_ROW] });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .query({ token: ACCESS_TOKEN_PLAINTEXT });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("received");
  });

  it("GET /orders/:id reflects updated status after status change (received → preparing)", async () => {
    const preparingRow = { ...ORDER_ROW, status: "preparing" };
    mockQuery.mockResolvedValueOnce({ rows: [preparingRow] });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .query({ token: ACCESS_TOKEN_PLAINTEXT });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("preparing");
  });

  it("GET /orders/:id returns 403 with an invalid access token", async () => {
    // No matching row when token hash doesn't match
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/orders/${ORDER_ID}`)
      .query({ token: "wrong-token" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("GET /orders/:id returns 403 when no token is provided", async () => {
    const res = await request(app).get(`/orders/${ORDER_ID}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });
});
