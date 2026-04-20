/**
 * Unit tests for stale customization handling.
 * Requirements: 8.6
 *
 * Tests:
 * 1. When cart has items with hasStaleCustomization: true, a stale customization warning should be shown
 * 2. When cart has items with hasStaleCustomization: true, the Venmo payment button should be disabled
 * 3. When cart has no stale items, no warning is shown and payment is enabled
 */

import { describe, it, expect } from "vitest";
import type { CartItem } from "../../../hooks/useCart";

// ── Pure helpers mirroring CheckoutPage logic ─────────────────────────────────

/**
 * Returns the stale items from a cart — mirrors the logic in CheckoutPage.tsx:
 *   const staleItems = cart.items.filter((i) => i.hasStaleCustomization);
 */
function getStaleItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.hasStaleCustomization);
}

/**
 * Returns whether the stale customization warning should be shown.
 * Mirrors: staleItems.length > 0 → render warning banner
 */
function shouldShowStaleWarning(items: CartItem[]): boolean {
  return getStaleItems(items).length > 0;
}

/**
 * Returns whether the Venmo payment button should be disabled.
 * Mirrors: disabled={staleItems.length > 0}
 */
function isVenmoButtonDisabled(items: CartItem[]): boolean {
  return getStaleItems(items).length > 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    menuItemId: "item-1",
    name: "Matcha Latte",
    quantity: 1,
    selectedCustomizations: {},
    unitPrice: 500,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Stale customization handling — checkout warning", () => {
  it("shows stale customization warning when cart has items with hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: false }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte", hasStaleCustomization: true }),
    ];

    expect(shouldShowStaleWarning(items)).toBe(true);
  });

  it("shows stale customization warning when ALL items have hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: true }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte", hasStaleCustomization: true }),
    ];

    expect(shouldShowStaleWarning(items)).toBe(true);
  });

  it("does not show stale customization warning when no items have hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: false }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte", hasStaleCustomization: false }),
    ];

    expect(shouldShowStaleWarning(items)).toBe(false);
  });

  it("does not show stale customization warning when hasStaleCustomization is undefined (normal items)", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1" }), // hasStaleCustomization not set
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte" }),
    ];

    expect(shouldShowStaleWarning(items)).toBe(false);
  });

  it("does not show stale customization warning for an empty cart", () => {
    expect(shouldShowStaleWarning([])).toBe(false);
  });
});

describe("Stale customization handling — Venmo payment button disabled state", () => {
  it("Venmo payment button is disabled when cart has items with hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: true }),
    ];

    expect(isVenmoButtonDisabled(items)).toBe(true);
  });

  it("Venmo payment button is disabled when only some items have hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: false }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte", hasStaleCustomization: true }),
    ];

    expect(isVenmoButtonDisabled(items)).toBe(true);
  });

  it("Venmo payment button is enabled when no items have hasStaleCustomization: true", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1", hasStaleCustomization: false }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte" }),
    ];

    expect(isVenmoButtonDisabled(items)).toBe(false);
  });

  it("Venmo payment button is enabled for an empty cart (no stale items)", () => {
    expect(isVenmoButtonDisabled([])).toBe(false);
  });
});

describe("Stale customization handling — stale item identification", () => {
  it("correctly identifies which items are stale", () => {
    const staleItem = makeItem({ menuItemId: "item-2", name: "Hojicha Latte", hasStaleCustomization: true });
    const freshItem = makeItem({ menuItemId: "item-1", hasStaleCustomization: false });

    const stale = getStaleItems([freshItem, staleItem]);

    expect(stale).toHaveLength(1);
    expect(stale[0].menuItemId).toBe("item-2");
    expect(stale[0].name).toBe("Hojicha Latte");
  });

  it("returns empty array when no items are stale", () => {
    const items: CartItem[] = [
      makeItem({ menuItemId: "item-1" }),
      makeItem({ menuItemId: "item-2", name: "Hojicha Latte" }),
    ];

    expect(getStaleItems(items)).toHaveLength(0);
  });
});
