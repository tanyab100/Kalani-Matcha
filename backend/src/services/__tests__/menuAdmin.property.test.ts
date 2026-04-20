// Feature: seasonal-menu-management, Property tests for pure service functions

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterPublicItems,
  sortAdminItems,
  applyCreateDefaults,
  toggleHidden,
  toggleArchived,
  sortByOrder,
} from "../menuAdminService";
import type {
  AdminMenuItem,
  AdminCustomizationGroup,
  AdminCustomizationOption,
  CreateMenuItemBody,
} from "../../types/menu";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const categoryArb = fc.constantFrom(
  "drinks" as const,
  "food" as const,
  "extras" as const
);

const adminMenuItemArb: fc.Arbitrary<AdminMenuItem> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 50 }),
  basePrice: fc.integer({ min: 0, max: 5000 }),
  category: categoryArb,
  inStock: fc.boolean(),
  customizations: fc.constant([]),
  hidden: fc.boolean(),
  archived: fc.boolean(),
});

const visibleAdminMenuItemArb: fc.Arbitrary<AdminMenuItem> = adminMenuItemArb.map(
  (item) => ({ ...item, hidden: false, archived: false })
);

const createMenuItemBodyArb: fc.Arbitrary<CreateMenuItemBody> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.oneof(fc.string({ minLength: 0, maxLength: 50 }), fc.constant(undefined)),
  basePrice: fc.integer({ min: 0, max: 5000 }),
  category: categoryArb,
});

const adminGroupArb: fc.Arbitrary<AdminCustomizationGroup> = fc.record({
  id: fc.uuid(),
  menuItemId: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  required: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 100 }),
  options: fc.constant([]),
});

const adminOptionArb: fc.Arbitrary<AdminCustomizationOption> = fc.record({
  id: fc.uuid(),
  customizationGroupId: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  priceDelta: fc.integer({ min: -500, max: 500 }),
  sortOrder: fc.integer({ min: 0, max: 100 }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("menuAdminService property tests", () => {
  // Feature: seasonal-menu-management, Property 1: Public menu excludes hidden and archived items
  // Validates: Requirements 5.4, 6.3, 11.1, 11.2
  it("Property 1: filterPublicItems excludes hidden and archived items", () => {
    fc.assert(
      fc.property(
        fc.array(adminMenuItemArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const result = filterPublicItems(items);
          for (const item of result) {
            expect(item.hidden).toBe(false);
            expect(item.archived).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 2: Public menu preserves inStock field
  // Validates: Requirements 4.5, 11.3
  it("Property 2: filterPublicItems preserves inStock field on visible items", () => {
    fc.assert(
      fc.property(
        fc.array(visibleAdminMenuItemArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const result = filterPublicItems(items);
          // All visible items pass through
          expect(result).toHaveLength(items.length);
          // inStock is preserved exactly
          for (let i = 0; i < items.length; i++) {
            expect(result[i].inStock).toBe(items[i].inStock);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 3: Admin list includes all items regardless of flags
  // Validates: Requirements 1.1, 1.4
  it("Property 3: sortAdminItems includes all items regardless of hidden/archived flags", () => {
    fc.assert(
      fc.property(
        fc.array(adminMenuItemArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const result = sortAdminItems(items);
          expect(result).toHaveLength(items.length);
          // Every original item id appears in the result
          const resultIds = new Set(result.map((i) => i.id));
          for (const item of items) {
            expect(resultIds.has(item.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 4: Admin list sort order
  // Validates: Requirements 1.4
  it("Property 4: sortAdminItems orders by category ASC then name ASC", () => {
    fc.assert(
      fc.property(
        fc.array(adminMenuItemArb, { minLength: 0, maxLength: 20 }),
        (items) => {
          const result = sortAdminItems(items);
          for (let i = 1; i < result.length; i++) {
            const prev = result[i - 1];
            const curr = result[i];
            const catCmp = prev.category.localeCompare(curr.category);
            if (catCmp === 0) {
              // Same category: name must be non-decreasing
              expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
            } else {
              // Different category: must be ascending
              expect(catCmp).toBeLessThan(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 5: Created item has correct defaults
  // Validates: Requirements 2.2
  it("Property 5: applyCreateDefaults sets inStock=true, hidden=false, archived=false", () => {
    fc.assert(
      fc.property(createMenuItemBodyArb, (payload) => {
        const result = applyCreateDefaults(payload);
        expect(result.inStock).toBe(true);
        expect(result.hidden).toBe(false);
        expect(result.archived).toBe(false);
        // Original fields are preserved
        expect(result.name).toBe(payload.name);
        expect(result.basePrice).toBe(payload.basePrice);
        expect(result.category).toBe(payload.category);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 7: Hide/unhide round-trip
  // Validates: Requirements 5.2, 5.3
  it("Property 7: toggleHidden round-trip restores original hidden state", () => {
    fc.assert(
      fc.property(adminMenuItemArb, (item) => {
        const hidden = toggleHidden(item, true);
        expect(hidden.hidden).toBe(true);

        const unhidden = toggleHidden(hidden, false);
        expect(unhidden.hidden).toBe(false);

        // All other fields are unchanged
        expect(unhidden.id).toBe(item.id);
        expect(unhidden.name).toBe(item.name);
        expect(unhidden.archived).toBe(item.archived);
        expect(unhidden.inStock).toBe(item.inStock);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 8: Archive/restore round-trip
  // Validates: Requirements 6.2, 6.5
  it("Property 8: toggleArchived round-trip restores original archived state", () => {
    fc.assert(
      fc.property(adminMenuItemArb, (item) => {
        const archived = toggleArchived(item, true);
        expect(archived.archived).toBe(true);

        const restored = toggleArchived(archived, false);
        expect(restored.archived).toBe(false);

        // All other fields are unchanged
        expect(restored.id).toBe(item.id);
        expect(restored.name).toBe(item.name);
        expect(restored.hidden).toBe(item.hidden);
        expect(restored.inStock).toBe(item.inStock);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: seasonal-menu-management, Property 9: Sort order for groups and options
  // Validates: Requirements 8.1, 9.1
  it("Property 9a: sortByOrder orders customization groups by sortOrder ASC", () => {
    fc.assert(
      fc.property(
        fc.array(adminGroupArb, { minLength: 0, maxLength: 20 }),
        (groups) => {
          const result = sortByOrder(groups);
          expect(result).toHaveLength(groups.length);
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].sortOrder).toBeLessThanOrEqual(result[i].sortOrder);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 9b: sortByOrder orders customization options by sortOrder ASC", () => {
    fc.assert(
      fc.property(
        fc.array(adminOptionArb, { minLength: 0, maxLength: 20 }),
        (options) => {
          const result = sortByOrder(options);
          expect(result).toHaveLength(options.length);
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].sortOrder).toBeLessThanOrEqual(result[i].sortOrder);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
