// Feature: matcha-ordering-app, Property 1: Order history access control

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

// ── Minimal JWT helpers (no external deps) ────────────────────────────────────

const VALID_SECRET = "test-secret-for-property-tests";
const WRONG_SECRET = "wrong-secret-for-property-tests";

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token structure");
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  if (sig !== expected) throw new Error("Invalid signature");
  return JSON.parse(Buffer.from(body, "base64url").toString());
}

// ── Mock jsonwebtoken before importing auth middleware ────────────────────────

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: (token: string, secret: string) => verifyJwt(token, secret),
    sign: (payload: Record<string, unknown>, secret: string) => signJwt(payload, secret),
  },
  verify: (token: string, secret: string) => verifyJwt(token, secret),
  sign: (payload: Record<string, unknown>, secret: string) => signJwt(payload, secret),
}));

// Import AFTER mock is registered
import { requireAuth } from "../../middleware/auth";

// ── Mock req/res/next helpers ─────────────────────────────────────────────────

function makeMockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

function makeMockRes(): { res: Response; statusCode: () => number | null } {
  let code: number | null = null;
  const res = {
    status(c: number) { code = c; return res; },
    json() { return res; },
  } as unknown as Response;
  return { res, statusCode: () => code };
}

function runMiddleware(authHeader?: string): { granted: boolean; statusCode: number | null } {
  const req = makeMockReq(authHeader);
  const { res, statusCode } = makeMockRes();
  let nextCalled = false;
  const next: NextFunction = () => { nextCalled = true; };

  requireAuth(req, res, next);

  return { granted: nextCalled, statusCode: statusCode() };
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const customerPayloadArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
});

const randomStringArb = fc.string({ minLength: 0, maxLength: 200 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 1: Order history access control", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = VALID_SECRET;
  });

  /**
   * Property 1a: Valid JWT signed with correct secret → access granted (next() called)
   * Validates: Requirements 1.3
   */
  it("Property 1: valid JWT signed with correct secret always grants access", () => {
    fc.assert(
      fc.property(customerPayloadArb, (payload) => {
        const token = signJwt(payload, VALID_SECRET);
        const { granted, statusCode } = runMiddleware(`Bearer ${token}`);
        expect(granted).toBe(true);
        expect(statusCode).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1b: Random strings as tokens → access denied (401)
   * Validates: Requirements 1.3
   */
  it("Property 1: random strings as tokens always deny access with 401", () => {
    fc.assert(
      fc.property(randomStringArb, (randomToken) => {
        const { granted, statusCode } = runMiddleware(`Bearer ${randomToken}`);
        expect(granted).toBe(false);
        expect(statusCode).toBe(401);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1c: Token signed with wrong secret → access denied (401)
   * Validates: Requirements 1.3
   */
  it("Property 1: tokens signed with wrong secret always deny access with 401", () => {
    fc.assert(
      fc.property(customerPayloadArb, (payload) => {
        const token = signJwt(payload, WRONG_SECRET);
        const { granted, statusCode } = runMiddleware(`Bearer ${token}`);
        expect(granted).toBe(false);
        expect(statusCode).toBe(401);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1d: Missing or malformed Authorization header → access denied (401)
   * Validates: Requirements 1.3
   */
  it("Property 1: missing or non-Bearer authorization header always denies access with 401", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !s.startsWith("Bearer "))
        ),
        (header) => {
          const { granted, statusCode } = runMiddleware(header);
          expect(granted).toBe(false);
          expect(statusCode).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1e (combined): canAccessOrderHistory(session) === true iff session has a valid JWT
   * Validates: Requirements 1.3
   */
  it("Property 1: access is granted if and only if the session has a valid JWT signed with the correct secret", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          customerPayloadArb.map((p) => ({
            token: signJwt(p, VALID_SECRET),
            shouldGrant: true,
          })),
          customerPayloadArb.map((p) => ({
            token: signJwt(p, WRONG_SECRET),
            shouldGrant: false,
          })),
          randomStringArb.map((s) => ({ token: s, shouldGrant: false }))
        ),
        ({ token, shouldGrant }) => {
          const { granted } = runMiddleware(`Bearer ${token}`);
          expect(granted).toBe(shouldGrant);
        }
      ),
      { numRuns: 100 }
    );
  });
});
