import { isWithinStoreHours, StoreHoursConfig, storeHours } from "../config/storeHours";

export interface PickupSlot {
  id: string;
  time: string; // ISO string
  capacity: number;
  usedCapacity: number;
}

/**
 * Pure function that filters pickup slots to only those available for ordering.
 * Requirements: 5.3, 5.4, 5.5
 *
 * A slot is valid if:
 *  1. slot.time >= now + 10 minutes  (prep time rule)
 *  2. slot.usedCapacity < slot.capacity  (capacity rule)
 *  3. slot.time falls within configured store operating hours
 */
export function filterPickupSlots(
  slots: PickupSlot[],
  now: Date,
  config: StoreHoursConfig = storeHours
): PickupSlot[] {
  const cutoff = new Date(now.getTime() + 10 * 60 * 1000);

  return slots.filter((slot) => {
    const slotDate = new Date(slot.time);
    return (
      slotDate >= cutoff &&
      slot.usedCapacity < slot.capacity &&
      isWithinStoreHours(slotDate, config)
    );
  });
}
