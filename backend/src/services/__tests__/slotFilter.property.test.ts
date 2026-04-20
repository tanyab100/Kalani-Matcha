// Feature: matcha-ordering-app, Property 13: Valid pickup slot filter

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterPickupSlots, PickupSlot } from "../slotFilter";
import { isWithinStoreHours, StoreHoursConfig } from "../../config/storeHours";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Generate a timestamp within a reasonable range (±30 days from epoch anchor) */
const timestampArb = fc.integer({ min: 0, max: 60 * 24 * 60 * 60 * 1000 }).map(
  (offsetMs) => new Date(Date.UTC(2025, 0, 1) + offsetMs)
);

const pickupSlotArb = fc
  .record({
    id: fc.uuid(),
    time: timestampArb.map((d) => d.toISOString()),
    capacity: fc.integer({ min: 1, max: 20 }),
    usedCapacity: fc.integer({ min: 0, max: 20 }),
  });

/** A fixed store hours config open every day 9–17 Pacific — deterministic for tests */
const testConfig: StoreHoursConfig = {
  timezone: "America/Los_Angeles",
  hours: {
    0: { open: 9, close: 17 },
    1: { open: 9, close: 17 },
    2: { open: 9, close: 17 },
    3: { open: 9, close: 17 },
    4: { open: 9, close: 17 },
    5: { open: 9, close: 17 },
    6: { open: 9, close: 17 },
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Slot filter property tests", () => {
  /**
   * Property 13: Valid pickup slot filter
   * Validates: Requirements 5.3, 5.4, 5.5
   */
  it("Property 13: filterPickupSlots — every returned slot satisfies all three conditions, and no valid slot is excluded", () => {
    fc.assert(
      fc.property(
        fc.array(pickupSlotArb, { minLength: 0, maxLength: 20 }),
        timestampArb,
        (slots, now) => {
          const cutoff = new Date(now.getTime() + 10 * 60 * 1000);
          const result = filterPickupSlots(slots, now, testConfig);

          // ── Soundness: every returned slot satisfies all three conditions ──
          for (const slot of result) {
            const slotDate = new Date(slot.time);

            // (a) slot.time >= now + 10 minutes
            expect(slotDate.getTime()).toBeGreaterThanOrEqual(cutoff.getTime());

            // (b) usedCapacity < capacity
            expect(slot.usedCapacity).toBeLessThan(slot.capacity);

            // (c) falls within store operating hours
            expect(isWithinStoreHours(slotDate, testConfig)).toBe(true);
          }

          // ── Completeness: no valid slot is excluded ──
          const validSlots = slots.filter((slot) => {
            const slotDate = new Date(slot.time);
            return (
              slotDate.getTime() >= cutoff.getTime() &&
              slot.usedCapacity < slot.capacity &&
              isWithinStoreHours(slotDate, testConfig)
            );
          });

          expect(result.length).toBe(validSlots.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
