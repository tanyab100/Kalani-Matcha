// Feature: matcha-ordering-app, Property 21: Reorder cart construction

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildReorderCart,
  type PastOrderItem,
} from "../reorderService";
import type { MenuItem, CustomizationGroup, CustomizationOption } from "../../types/menu";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const customizationOptionArb: fc.Arbitrary<CustomizationOption> = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  priceDelta: fc.integer({ min: -100, max: 300 }),
});

const customizationGroupArb: fc.Arbitrary<CustomizationGroup> = fc
  .record({
    id: fc.uuid(),
    label: fc.string({ minLength: 1, maxLength: 20 }),
    required: fc.boolean(),
    options: fc.array(customizationOptionArb, { minLength: 1, maxLength: 4 }),
  });

const menuItemArb: fc.Arbitrary<MenuItem> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 50 }),
  basePrice: fc.integer({ min: 100, max: 2000 }),
  category: fc.constantFrom("drinks" as const, "food" as const, "extras" as const),
  inStock: fc.boolean(),
  customizations: fc.array(customizationGroupArb, { minLength: 0, maxLength: 3 }),
});

/**
 * Build a PastOrderItem that references a real MenuItem with valid customization selections.
 * Returns [pastItem, menuItem] so the test can use both.
 */
const pastItemWithMenuItemArb: fc.Arbitrary<[PastOrderItem, MenuItem]> = menuItemArb.chain(
  (menuItem) => {
    // Build a selectedCustomizations map using real group/option ids from the menu item
    const customizationsArb =
      menuItem.customizations.length === 0
        ? fc.constant({} as Record<string, string>)
        : fc.record(
            Object.fromEntries(
              menuItem.customizations.map((group) => [
                group.id,
                fc.constantFrom(...group.options.map((o) => o.id)),
              ])
            )
          );

    return customizationsArb.map((selectedCustomizations) => {
      const pastItem: PastOrderItem = {
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: 1,
        selectedCustomizations,
        unitPrice: menuItem.basePrice,
      };
      return [pastItem, menuItem] as [PastOrderItem, MenuItem];
    });
  }
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Reorder cart construction property tests", () => {
  // Feature: matcha-ordering-app, Property 21: Reorder cart construction
  // Validates: Requirements 8.3, 8.4, 8.5
  it("Property 21a: available items are included in the cart with original customizations", () => {
    fc.assert(
      fc.property(
        fc.array(pastItemWithMenuItemArb, { minLength: 1, maxLength: 5 }),
        (pairs) => {
          // Only use in-stock items for this sub-property
          const inStockPairs = pairs.map(([past, menu]) => [
            past,
            { ...menu, inStock: true },
          ] as [PastOrderItem, MenuItem]);

          const pastItems = inStockPairs.map(([p]) => p);
          const menuItems = inStockPairs.map(([, m]) => m);

          const { cartItems, unavailableItems } = buildReorderCart(pastItems, menuItems);

          // All items should be in the cart (none unavailable)
          expect(unavailableItems).toHaveLength(0);
          expect(cartItems).toHaveLength(pastItems.length);

          // Each cart item preserves original customizations
          for (let i = 0; i < pastItems.length; i++) {
            expect(cartItems[i].menuItemId).toBe(pastItems[i].menuItemId);
            expect(cartItems[i].selectedCustomizations).toEqual(
              pastItems[i].selectedCustomizations
            );
            expect(cartItems[i].quantity).toBe(pastItems[i].quantity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 21b: unavailable items (out-of-stock or missing) are excluded from the cart", () => {
    fc.assert(
      fc.property(
        fc.array(pastItemWithMenuItemArb, { minLength: 1, maxLength: 5 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (pairs, availabilityFlags) => {
          // Assign availability based on flags (cycling if needed)
          const annotatedPairs = pairs.map(([past, menu], i) => [
            past,
            { ...menu, inStock: availabilityFlags[i % availabilityFlags.length] },
          ] as [PastOrderItem, MenuItem]);

          const pastItems = annotatedPairs.map(([p]) => p);
          const menuItems = annotatedPairs.map(([, m]) => m);

          const { cartItems, unavailableItems } = buildReorderCart(pastItems, menuItems);

          const expectedAvailable = annotatedPairs.filter(([, m]) => m.inStock);
          const expectedUnavailable = annotatedPairs.filter(([, m]) => !m.inStock);

          // Correct counts
          expect(cartItems).toHaveLength(expectedAvailable.length);
          expect(unavailableItems).toHaveLength(expectedUnavailable.length);

          // Unavailable item ids match
          const unavailableIds = new Set(unavailableItems.map((u) => u.menuItemId));
          for (const [, menu] of expectedUnavailable) {
            expect(unavailableIds.has(menu.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 21c: item prices reflect current menu prices, not historical prices", () => {
    fc.assert(
      fc.property(
        fc.array(pastItemWithMenuItemArb, { minLength: 1, maxLength: 5 }),
        (pairs) => {
          // All items in stock; give each menu item a different basePrice than the past item
          const inStockPairs = pairs.map(([past, menu]) => {
            const newBasePrice = menu.basePrice + 50; // guaranteed different from original
            return [
              past,
              { ...menu, inStock: true, basePrice: newBasePrice },
            ] as [PastOrderItem, MenuItem];
          });

          const pastItems = inStockPairs.map(([p]) => p);
          const menuItems = inStockPairs.map(([, m]) => m);

          const { cartItems } = buildReorderCart(pastItems, menuItems);

          expect(cartItems).toHaveLength(pastItems.length);

          for (let i = 0; i < cartItems.length; i++) {
            const currentMenu = menuItems[i];
            const cartItem = cartItems[i];

            // Compute expected price: currentBasePrice + sum of priceDelta for selected options
            let expectedPrice = currentMenu.basePrice;
            for (const optionId of Object.values(cartItem.selectedCustomizations)) {
              for (const group of currentMenu.customizations) {
                const opt = group.options.find((o) => o.id === optionId);
                if (opt) {
                  expectedPrice += opt.priceDelta;
                }
              }
            }

            expect(cartItem.unitPrice).toBe(expectedPrice);
            // Price must NOT equal the historical price (which was basePrice without the +50 offset)
            // unless the delta happens to cancel it out — so we just verify it matches current menu
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
