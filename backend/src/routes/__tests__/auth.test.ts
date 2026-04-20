import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

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

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "password123";
const TEST_CUSTOMER_ID = "cust-uuid-1";

// Pre-hash the test password so login mock can return it
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

const TEST_CUSTOMER_ROW = {
  id: TEST_CUSTOMER_ID,
  email: TEST_EMAIL,
  created_at: "2025-01-01T00:00:00Z",
};

// ── POST /auth/register ───────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 201 with token and customer on valid registration", async () => {
    // No existing customer
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT check
      .mockResolvedValueOnce({ rows: [TEST_CUSTOMER_ROW] }); // INSERT

    const res = await request(app)
      .post("/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.customer).toMatchObject({ id: TEST_CUSTOMER_ID, email: TEST_EMAIL });
  });

  it("returns 409 when email is already registered", async () => {
    // Existing customer found
    mockQuery.mockResolvedValueOnce({ rows: [{ id: TEST_CUSTOMER_ID }] });

    const res = await request(app)
      .post("/auth/register")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("EMAIL_TAKEN");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when password is too short", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: TEST_EMAIL, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe("POST /auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 200 with token and customer on valid credentials", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_CUSTOMER_ID, email: TEST_EMAIL, password_hash: TEST_PASSWORD_HASH }],
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.customer).toMatchObject({ id: TEST_CUSTOMER_ID, email: TEST_EMAIL });
  });

  it("returns 401 when password is wrong", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_CUSTOMER_ID, email: TEST_EMAIL, password_hash: TEST_PASSWORD_HASH }],
    });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 when email is not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "unknown@example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_CREDENTIALS");
  });
});

// ── GET /orders/history ───────────────────────────────────────────────────────

describe("GET /orders/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns 401 without auth — guest checkout is allowed but history requires auth", async () => {
    const res = await request(app).get("/orders/history");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 200 with empty orders list for authenticated customer with no orders", async () => {
    // Sign a valid token
    const jwt = await import("jsonwebtoken");
    const token = jwt.sign(
      { id: TEST_CUSTOMER_ID, email: TEST_EMAIL },
      "test-secret",
      { expiresIn: "1h" }
    );

    // Mock DB to return empty orders
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get("/orders/history")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orders");
    expect(res.body.orders).toEqual([]);
  });
});
