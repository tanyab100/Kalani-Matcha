/**
 * Smoke tests
 *
 * 1. No raw card data stored server-side (Req 6.1)
 * 2. Payment method configured in Payment Processor (Req 6.1)
 *
 * Validates: Requirements 6.1
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all files under `dir` matching `extensions`. */
function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Return all lines in `content` that match any of the forbidden patterns. */
function findForbiddenMatches(
  content: string,
  patterns: RegExp[]
): string[] {
  return content
    .split("\n")
    .filter((line) => patterns.some((p) => p.test(line)));
}

// ---------------------------------------------------------------------------
// Raw card field names that must never appear in server-side storage code
// ---------------------------------------------------------------------------
const RAW_CARD_PATTERNS: RegExp[] = [
  /\bcard_number\b/i,
  /\bcardNumber\b/,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bcvv2\b/i,
  /\bpan\b/i,
];

// Directories / file types to scan
// __dirname = backend/src/services/__tests__
// so ../../../ = backend/src/
const SRC_ROOT = path.resolve(__dirname, "../../");
const MIGRATION_DIR = path.resolve(SRC_ROOT, "db/migrations");
const SERVICES_DIR = path.resolve(SRC_ROOT, "services");

const SQL_FILES = collectFiles(MIGRATION_DIR, [".sql"]);
const TS_SERVICE_FILES = collectFiles(SERVICES_DIR, [".ts"]).filter(
  // Exclude this test file itself
  (f) => !f.includes("smoke.test.ts")
);

// ---------------------------------------------------------------------------
// Test 1 – No raw card fields in migration SQL files (Req 6.1)
// ---------------------------------------------------------------------------
describe("Smoke: no raw card data in database schema / migrations (Req 6.1)", () => {
  it("should find at least one SQL migration file to scan", () => {
    expect(SQL_FILES.length).toBeGreaterThan(0);
  });

  for (const file of SQL_FILES) {
    it(`${path.basename(file)} contains no raw card field names`, () => {
      const content = fs.readFileSync(file, "utf-8");
      const matches = findForbiddenMatches(content, RAW_CARD_PATTERNS);
      expect(
        matches,
        `Found raw card field(s) in ${file}:\n${matches.join("\n")}`
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Test 2 – No raw card fields in order/payment service files (Req 6.1)
// ---------------------------------------------------------------------------
describe("Smoke: no raw card data in service source files (Req 6.1)", () => {
  it("should find at least one service TypeScript file to scan", () => {
    expect(TS_SERVICE_FILES.length).toBeGreaterThan(0);
  });

  for (const file of TS_SERVICE_FILES) {
    it(`${path.basename(file)} contains no raw card field names`, () => {
      const content = fs.readFileSync(file, "utf-8");
      const matches = findForbiddenMatches(content, RAW_CARD_PATTERNS);
      expect(
        matches,
        `Found raw card field(s) in ${file}:\n${matches.join("\n")}`
      ).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Test 3 – Stripe client is configured when STRIPE_SECRET_KEY is set (Req 6.1)
// ---------------------------------------------------------------------------
describe("Smoke: payment processor client is configured (Req 6.1)", () => {
  it("exports a non-null Stripe client when STRIPE_SECRET_KEY is set", async () => {
    // Provide a test key so the stripe module initialises without throwing.
    // Stripe accepts any string starting with "sk_test_" for offline validation.
    process.env.STRIPE_SECRET_KEY = "sk_test_smoke_test_key";

    // Dynamically import so the env var is set before the module evaluates.
    const { stripe } = await import("../../config/stripe.js");

    expect(stripe).toBeDefined();
    expect(stripe).not.toBeNull();
    // Verify it looks like a real Stripe client (has the `paymentIntents` namespace)
    expect(typeof stripe.paymentIntents).toBe("object");
  });
});
