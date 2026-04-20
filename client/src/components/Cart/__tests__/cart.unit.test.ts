import { describe, it, expect } from "vitest";
import {
  addItemToCart,
  removeItemFromCart,
  updateItemQuantity,
  computeCartTotals,
  customizationKey,
  TAX_RATE,
  type CartItem,
} from "../../../hooks/useCart";

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

// ── addItemToCart ─────────────────────────────────────────────────────────────

describe("addItemToCart", () => {
  it("adding an item to an empty cart results in a cart with one item", () => {
    const item = makeItem();
    const result = addItemToCart([], item);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(item);
  });

  it("adding a new item (different menuItemId) to a non-empty cart appends it", () => {
    const existing = makeItem({ menuItemId: "item-1" });
    const newItem = makeItem({ menuItemId: "item-2", name: "Hojicha" });
    const result = addItemToCart([existing], newItem);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(newItem);
  });

  it("adding the same item (same menuItemId + same customizations) merges quantities", () => {
    const existing = makeItem({ menuItemId: "item-1", quantity: 2 });
    const duplicate = makeItem({ menuItemId: "item-1", quantity: 3 });
    const result = addItemToCart([existing], duplicate);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it("adding the same menuItemId but different customizations creates a separate line item", () => {
    const existing = makeItem({
      menuItemId: "item-1",
      selectedCustomizations: { size: "small" },
    });
    const different = makeItem({
      menuItemId: "item-1",
      selectedCustomizations: { size: "large" },
    });
    const result = addItemToCart([existing], different);
    expect(result).toHaveLength(2);
  });

  it("adding an item with quantity 2 to an existing line with quantity 1 results in quantity 3", () => {
    const existing = makeItem({ quantity: 1 });
    const added = makeItem({ quantity: 2 });
    const result = addItemToCart([existing], added);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });
});

// ── removeItemFromCart ────────────────────────────────────────────────────────

describe("removeItemFromCart", () => {
  it("removing an item that exists removes it from the list", () => {
    const item = makeItem({ menuItemId: "item-1" });
    const key = customizationKey(item.selectedCustomizations);
    const result = removeItemFromCart([item], "item-1", key);
    expect(result).toHaveLength(0);
  });

  it("removing an item that does not exist leaves the cart unchanged", () => {
    const item = makeItem({ menuItemId: "item-1" });
    const result = removeItemFromCart([item], "item-99", "[]");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(item);
  });

  it("removing one line item when multiple exist only removes the matching one", () => {
    const item1 = makeItem({ menuItemId: "item-1" });
    const item2 = makeItem({ menuItemId: "item-2" });
    const key = customizationKey(item1.selectedCustomizations);
    const result = removeItemFromCart([item1, item2], "item-1", key);
    expect(result).toHaveLength(1);
    expect(result[0].menuItemId).toBe("item-2");
  });

  it("removing by menuItemId + custKey only removes the exact match (not other customizations of same item)", () => {
    const small = makeItem({ menuItemId: "item-1", selectedCustomizations: { size: "small" } });
    const large = makeItem({ menuItemId: "item-1", selectedCustomizations: { size: "large" } });
    const smallKey = customizationKey(small.selectedCustomizations);
    const result = removeItemFromCart([small, large], "item-1", smallKey);
    expect(result).toHaveLength(1);
    expect(result[0].selectedCustomizations).toEqual({ size: "large" });
  });
});

// ── updateItemQuantity ────────────────────────────────────────────────────────

describe("updateItemQuantity", () => {
  it("updating quantity to a positive number updates the item", () => {
    const item = makeItem({ quantity: 1 });
    const key = customizationKey(item.selectedCustomizations);
    const result = updateItemQuantity([item], item.menuItemId, key, 5);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it("updating quantity to 0 removes the item", () => {
    const item = makeItem({ quantity: 3 });
    const key = customizationKey(item.selectedCustomizations);
    const result = updateItemQuantity([item], item.menuItemId, key, 0);
    expect(result).toHaveLength(0);
  });

  it("updating quantity to a negative number removes the item", () => {
    const item = makeItem({ quantity: 3 });
    const key = customizationKey(item.selectedCustomizations);
    const result = updateItemQuantity([item], item.menuItemId, key, -1);
    expect(result).toHaveLength(0);
  });

  it("updating a non-existent item leaves the cart unchanged", () => {
    const item = makeItem({ menuItemId: "item-1" });
    const result = updateItemQuantity([item], "item-99", "[]", 5);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(item);
  });
});

// ── computeCartTotals ─────────────────────────────────────────────────────────

describe("computeCartTotals", () => {
  it("empty cart returns subtotal=0, tax=0, total=tip", () => {
    const { subtotal, tax, total } = computeCartTotals([], TAX_RATE, 200);
    expect(subtotal).toBe(0);
    expect(tax).toBe(0);
    expect(total).toBe(200);
  });

  it("single item: subtotal = unitPrice * quantity, tax = Math.round(subtotal * TAX_RATE), total = subtotal + tax + tip", () => {
    const item = makeItem({ unitPrice: 500, quantity: 2 });
    const tip = 100;
    const { subtotal, tax, total } = computeCartTotals([item], TAX_RATE, tip);
    expect(subtotal).toBe(1000);
    expect(tax).toBe(Math.round(1000 * TAX_RATE));
    expect(total).toBe(subtotal + tax + tip);
  });

  it("tip of 0 (default): total = subtotal + tax", () => {
    const item = makeItem({ unitPrice: 400, quantity: 1 });
    const { subtotal, tax, total } = computeCartTotals([item], TAX_RATE, 0);
    expect(total).toBe(subtotal + tax);
  });

  it("tip > 0: total includes tip", () => {
    const item = makeItem({ unitPrice: 400, quantity: 1 });
    const tip = 150;
    const { subtotal, tax, total } = computeCartTotals([item], TAX_RATE, tip);
    expect(total).toBe(subtotal + tax + tip);
  });
});

// ── customizationKey ──────────────────────────────────────────────────────────

describe("customizationKey", () => {
  it("same customizations in different insertion order produce the same key", () => {
    const key1 = customizationKey({ size: "large", milk: "oat" });
    const key2 = customizationKey({ milk: "oat", size: "large" });
    expect(key1).toBe(key2);
  });

  it("different customizations produce different keys", () => {
    const key1 = customizationKey({ size: "small" });
    const key2 = customizationKey({ size: "large" });
    expect(key1).not.toBe(key2);
  });

  it("empty customizations produce a consistent key", () => {
    const key1 = customizationKey({});
    const key2 = customizationKey({});
    expect(key1).toBe(key2);
  });
});
