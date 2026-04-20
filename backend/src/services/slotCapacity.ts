import { pool } from "../db/pool";
import { createError } from "../middleware/errorHandler";

/**
 * Calculates the total capacity units for a single order.
 * Each item contributes its quantity as capacity units.
 * Requirements: 11.2, 11.4
 */
export function calculateOrderCapacityUnits(
  items: Array<{ quantity: number }>
): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Calculates the total slot usage across all confirmed orders.
 * Slot usage = sum of item quantities across all orders.
 * Requirements: 11.4
 */
export function calculateSlotUsage(
  orders: Array<{ items: Array<{ quantity: number }> }>
): number {
  return orders.reduce(
    (total, order) => total + calculateOrderCapacityUnits(order.items),
    0
  );
}

/**
 * Returns true if the slot can accept an order with the given capacity units.
 * Allowed if usedCapacity + orderUnits <= capacity.
 * Requirements: 11.2
 */
export function canAcceptOrder(
  slot: { capacity: number; usedCapacity: number },
  orderUnits: number
): boolean {
  return slot.usedCapacity + orderUnits <= slot.capacity;
}

/**
 * Validates that a slot has enough remaining capacity for the given order units.
 * Throws a 409 AppError with SLOT_CAPACITY_EXCEEDED if over capacity.
 * Requirements: 11.2, 11.4
 */
export async function validateSlotCapacity(
  slotId: string,
  orderUnits: number
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT capacity, used_capacity FROM pickup_slots WHERE id = $1`,
    [slotId]
  );

  if (rows.length === 0) {
    throw createError("Pickup slot not found", 404, "SLOT_NOT_FOUND");
  }

  const slot = {
    capacity: rows[0].capacity as number,
    usedCapacity: rows[0].used_capacity as number,
  };

  if (!canAcceptOrder(slot, orderUnits)) {
    throw createError(
      "This pickup slot is at capacity. Please select a different time.",
      409,
      "SLOT_CAPACITY_EXCEEDED"
    );
  }
}
