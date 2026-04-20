import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomizationOption {
  id: string;
  label: string;
  priceDelta: number;
}

interface CustomizationGroup {
  id: string;
  label: string;
  required: boolean;
  options: CustomizationOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: "drinks" | "food" | "extras";
  inStock: boolean;
  customizations: CustomizationGroup[];
}

// ── Pure functions under test ─────────────────────────────────────────────────

function groupByCategory(items: MenuItem[]): Map<string, MenuItem[]> {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
  }
  return map;
}

function renderItemDetail(item: MenuItem): {
  name: string;
  description: string;
  price: number;
  customizationLabels: string[];
} {
  return {
    name: item.name,
    description: item.description,
    price: item.basePrice,
    customizationLabels: item.customizations.map((g) => g.label),
  };
}

function canAddToCart(item: MenuItem): boolean {
  return item.inStock;
}

function filterByCategory(items: MenuItem[], category: string): MenuItem[] {
  return items.filter((i) => i.category === category);
}

function computeItemPrice(
  item: MenuItem,
  selections: Record<string, string>
): number {
  return (
    item.basePrice +
    Object.entries(selections).reduce((sum, [groupId, optionId]) => {
      const group = item.customizations.find((g) => g.id === groupId);
      const option = group?.options.find((o) => o.id === optionId);
      return sum + (option?.priceDelta ?? 0);
    }, 0)
  );
}

function validateCustomizations(
  item: MenuItem,
  selections: Record<string, string>
): string[] {
  return item.customizations
    .filter((g) => g.required && !selections[g.id])
    .map((g) => g.id);
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const categoryArb = fc.constantFrom(
  "drinks",
  "food",
  "extras"
) as fc.Arbitrary<"drinks" | "food" | "extras">;

const customizationOptionArb = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  priceDelta: fc.integer({ min: -200, max: 500 }),
});

const customizationGroupArb = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  required: fc.boolean(),
  options: fc.array(customizationOptionArb, { minLength: 1, maxLength: 5 }),
});

const menuItemArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  basePrice: fc.integer({ min: 100, max: 2000 }),
  category: categoryArb,
  inStock: fc.boolean(),
  customizations: fc.array(customizationGroupArb, {
    minLength: 0,
    maxLength: 4,
  }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Menu property tests", () => {
  // Feature: matcha-ordering-app, Property 2: Menu category grouping
  // Validates: Requirements 2.1
  it("Property 2: groupByCategory — every item appears in exactly one group matching its category", () => {
    fc.assert(
      fc.property(fc.array(menuItemArb), (items) => {
        const grouped = groupByCategory(items);

        // Total items across all groups equals input length
        const totalGrouped = Array.from(grouped.values()).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        expect(totalGrouped).toBe(items.length);

        // Every item appears in the group matching its category
        for (const item of items) {
          const group = grouped.get(item.category);
          expect(group).toBeDefined();
          expect(group!.filter((i) => i === item).length).toBe(1);
        }

        // Every group key matches the category of its items
        for (const [key, groupItems] of grouped.entries()) {
          for (const item of groupItems) {
            expect(item.category).toBe(key);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 3: Item detail completeness
  // Validates: Requirements 2.2
  it("Property 3: renderItemDetail — output contains name, description, price, and all customization group labels", () => {
    fc.assert(
      fc.property(menuItemArb, (item) => {
        const detail = renderItemDetail(item);

        expect(detail.name).toBe(item.name);
        expect(detail.description).toBe(item.description);
        expect(detail.price).toBe(item.basePrice);
        expect(detail.customizationLabels).toEqual(
          item.customizations.map((g) => g.label)
        );
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 4: Out-of-stock items cannot be added to cart
  // Validates: Requirements 2.3
  it("Property 4: canAddToCart — returns false for out-of-stock items, true for in-stock items", () => {
    fc.assert(
      fc.property(menuItemArb, (item) => {
        const result = canAddToCart(item);
        expect(result).toBe(item.inStock);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 5: Category filter correctness
  // Validates: Requirements 2.4
  it("Property 5: filterByCategory — returns exactly those items whose category matches", () => {
    fc.assert(
      fc.property(fc.array(menuItemArb), categoryArb, (items, category) => {
        const filtered = filterByCategory(items, category);

        // All returned items match the category
        for (const item of filtered) {
          expect(item.category).toBe(category);
        }

        // No matching items are omitted
        const expected = items.filter((i) => i.category === category);
        expect(filtered.length).toBe(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 6: Customization price calculation
  // Validates: Requirements 3.2
  it("Property 6: computeItemPrice — equals basePrice + sum of selected priceDelta values", () => {
    fc.assert(
      fc.property(
        menuItemArb.filter((item) => item.customizations.length > 0),
        (item) => {
          // Build a valid selection: pick the first option from each group
          const selections: Record<string, string> = {};
          for (const group of item.customizations) {
            selections[group.id] = group.options[0].id;
          }

          const expectedPrice =
            item.basePrice +
            item.customizations.reduce(
              (sum, group) => sum + group.options[0].priceDelta,
              0
            );

          expect(computeItemPrice(item, selections)).toBe(expectedPrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: matcha-ordering-app, Property 7: Mandatory customization validation
  // Validates: Requirements 3.3
  it("Property 7: validateCustomizations — returns non-empty array when required groups have no selection", () => {
    fc.assert(
      fc.property(
        menuItemArb.filter((item) =>
          item.customizations.some((g) => g.required)
        ),
        (item) => {
          // Provide empty selections — all required groups are missing
          const missing = validateCustomizations(item, {});

          const requiredIds = item.customizations
            .filter((g) => g.required)
            .map((g) => g.id);

          expect(missing.length).toBeGreaterThan(0);
          // Every required group ID should appear in the missing list
          for (const id of requiredIds) {
            expect(missing).toContain(id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
