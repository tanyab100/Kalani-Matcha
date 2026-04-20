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
const ADMIN_ID = "admin-uuid-1";
const CUSTOMER_ID = "customer-uuid-1";
const SLOT_ID = "slot-uuid-1";

function makeAdminToken() {
  return jwt.sign({ id: ADMIN_ID, email: "admin@example.com", role: "store_admin" }, JWT_SECRET, { expiresIn: "1h" });
}

function makeCustomerToken() {
  return jwt.sign({ id: CUSTOMER_ID, email: "customer@example.com", role: "customer" }, JWT_SECRET, { expiresIn: "1h" });
}

const FUTURE_SLOT_ROW = {
  id: SLOT_ID,
  slot_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
  capacity: 10,
  used_capacity: 2,
};

const PAST_SLOT_ROW = {
  id: SLOT_ID,
  slot_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
  capacity: 10,
  used_capacity: 2,
};

// ── PATCH /admin/pickup-slots/:id/capacity ────────────────────────────────────

describe("PATCH /admin/pickup-slots/:id/capacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
  });

  // Test 1: Missing/no token → 401 UNAUTHORIZED
  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .patch(`/admin/pickup-slots/${SLOT_ID}/capacity`)
      .send({ capacity: 20 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  // Test 2: Non-admin JWT (role='customer') → 403 FORBIDDEN
  it("returns 403 when token has customer role", async () => {
    const res = await request(app)
      .patch(`/admin/pickup-slots/${SLOT_ID}/capacity`)
      .set("Authorization", `Bearer ${makeCustomerToken()}`)
      .send({ capacity: 20 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  // Test 3: Admin JWT + past slot → 400 PAST_SLOT_UPDATE
  it("returns 400 PAST_SLOT_UPDATE when slot_time is in the past", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [PAST_SLOT_ROW] });

    const res = await request(app)
      .patch(`/admin/pickup-slots/${SLOT_ID}/capacity`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({ capacity: 20 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("PAST_SLOT_UPDATE");
  });

  // Test 4: Admin JWT + future slot + valid capacity → 200 with updated slot
  it("returns 200 with updated slot for a future slot with valid capacity", async () => {
    const updatedSlot = { ...FUTURE_SLOT_ROW, capacity: 20, available: true };

    mockQuery
      .mockResolvedValueOnce({ rows: [FUTURE_SLOT_ROW] }) // SELECT
      .mockResolvedValueOnce({ rows: [updatedSlot] });    // UPDATE RETURNING

    const res = await request(app)
      .patch(`/admin/pickup-slots/${SLOT_ID}/capacity`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({ capacity: 20 });

    expect(res.status).toBe(200);
    expect(res.body.slot).toMatchObject({ id: SLOT_ID, capacity: 20 });
  });

  // Test 5: Admin JWT + unknown id → 404 SLOT_NOT_FOUND
  it("returns 404 SLOT_NOT_FOUND when slot id does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/admin/pickup-slots/unknown-id/capacity`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({ capacity: 20 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("SLOT_NOT_FOUND");
  });

  // Test 6: Admin JWT + capacity = -1 → 400 VALIDATION_ERROR
  it("returns 400 VALIDATION_ERROR when capacity is negative", async () => {
    const res = await request(app)
      .patch(`/admin/pickup-slots/${SLOT_ID}/capacity`)
      .set("Authorization", `Bearer ${makeAdminToken()}`)
      .send({ capacity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });
});
