import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── Hoist mock objects ────────────────────────────────────────────────────────
const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

// Mock stripe config to avoid STRIPE_SECRET_KEY requirement at import time
vi.mock("../../config/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
  },
}));

// Mock pool — must be before any import that uses it
vi.mock("../../db/pool", () => ({
  pool: { query: mockQuery },
}));

// Import app AFTER mocks are registered
import { app } from "../../app";

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = "test-secret";
const CUSTOMER_ID = "customer-uuid-1";
const ORDER_ID = "order-uuid-1";

function makeToken(customerId = CUSTOMER_ID) {
  return jwt.sign({ id: customerId, email: "test@example.com" }, JWT_SECRET, { expiresIn: "1h" });
}

const MENU_ITEM_ROW = {
  id: "item-uuid-1",
  name: "Matcha Latte",
  description: "Classic matcha latte",
  base_price: 500,
  category: "drinks",
  in_stock: true,
  customizations: [
    {
      id: "group-uuid-1",
      label: "Milk",
      required: true,
      options: [
        { id: "opt-uuid-1", label: "Oat Milk", priceDelta: 50 },
        { id: "opt-uuid-2", label: "Almond Milk", priceDelta: 50 },
      ],
    },
  ],
};

const PAST_ORDER_ITEMS = [
  {
    menuItemId: "item-uuid-1",
    name: "Matcha Latte",
    quantity: 2,
    selectedCustomizations: { "group-uuid-1": "opt-uuid-1" },
    unitPrice: 550,
  },
];

// ── POST /orders/:id/reorder ──────────────────────────────────────────────────

describe("POST /orders/:id/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("returns 401 without auth token", async () => {
    const res = await request(app).post(`/orders/${ORDER_ID}/reorder`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 404 when order does not belong to the customer", async () => {
    // Order query returns no rows (not found or wrong customer)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("returns reorder payload with available items at current prices", async () => {
    // Order query
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: PAST_ORDER_ITEMS }],
    });
    // Menu query
    mockQuery.mockResolvedValueOnce({ rows: [MENU_ITEM_ROW] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      menuItemId: "item-uuid-1",
      name: "Matcha Latte",
      quantity: 2,
      selectedCustomizations: { "group-uuid-1": "opt-uuid-1" },
      unitPrice: 550, // 500 base + 50 priceDelta
    });
    expect(res.body.unavailableItems).toEqual([]);
    expect(res.body.staleCustomizationItems).toEqual([]);
  });

  it("excludes out-of-stock items and reports them by name", async () => {
    const outOfStockItem = { ...MENU_ITEM_ROW, in_stock: false };

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: PAST_ORDER_ITEMS }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [outOfStockItem] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.unavailableItems).toEqual(["Matcha Latte"]);
    expect(res.body.staleCustomizationItems).toEqual([]);
  });

  it("excludes items no longer on the menu and reports them by name", async () => {
    // Menu returns empty — item was removed
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: PAST_ORDER_ITEMS }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.unavailableItems).toEqual(["Matcha Latte"]);
  });

  it("includes items with stale customizations but flags them by name", async () => {
    // Menu item exists but the previously selected option is gone
    const menuWithDifferentOptions = {
      ...MENU_ITEM_ROW,
      customizations: [
        {
          id: "group-uuid-1",
          label: "Milk",
          required: true,
          options: [
            // opt-uuid-1 (Oat Milk) is no longer available
            { id: "opt-uuid-3", label: "Soy Milk", priceDelta: 50 },
          ],
        },
      ],
    };

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: PAST_ORDER_ITEMS }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [menuWithDifferentOptions] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    // Item is still included in cart (customer must update selection)
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].menuItemId).toBe("item-uuid-1");
    // But flagged as having stale customizations
    expect(res.body.staleCustomizationItems).toEqual(["Matcha Latte"]);
    expect(res.body.unavailableItems).toEqual([]);
  });

  it("uses current menu prices, not historical prices", async () => {
    // Menu item now has a higher base price
    const updatedPriceItem = { ...MENU_ITEM_ROW, base_price: 600 };

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: PAST_ORDER_ITEMS }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [updatedPriceItem] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    // unitPrice should be 600 (new base) + 50 (priceDelta for opt-uuid-1) = 650
    expect(res.body.items[0].unitPrice).toBe(650);
  });

  it("handles mixed available and unavailable items correctly", async () => {
    const pastItems = [
      ...PAST_ORDER_ITEMS,
      {
        menuItemId: "item-uuid-2",
        name: "Matcha Cookie",
        quantity: 1,
        selectedCustomizations: {},
        unitPrice: 300,
      },
    ];

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: ORDER_ID, customer_id: CUSTOMER_ID, items_snapshot: pastItems }],
    });
    // Only item-uuid-1 is in the current menu; item-uuid-2 was removed
    mockQuery.mockResolvedValueOnce({ rows: [MENU_ITEM_ROW] });

    const res = await request(app)
      .post(`/orders/${ORDER_ID}/reorder`)
      .set("Authorization", `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].menuItemId).toBe("item-uuid-1");
    expect(res.body.unavailableItems).toEqual(["Matcha Cookie"]);
  });
});
