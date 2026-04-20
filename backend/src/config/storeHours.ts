/**
 * Store operating hours configuration.
 * Used to filter valid pickup slots — slots must fall within these hours.
 * Requirements: 5.3, 11.1
 */

export interface DayHours {
  open: number;  // hour in 24h format (e.g. 9 = 9:00 AM)
  close: number; // hour in 24h format (e.g. 17 = 5:00 PM), exclusive
}

export interface StoreHoursConfig {
  /** IANA timezone identifier for the store location */
  timezone: string;
  /** Operating hours per day of week. 0 = Sunday, 6 = Saturday. */
  hours: Record<number, DayHours | null>; // null = closed that day
}

/** Store pickup address displayed to customers at checkout. */
export const STORE_ADDRESS = "2836 El Capitan Drive, Pleasanton, CA 94566";

/**
 * Nami Matcha store hours.
 * Open Monday–Sunday, 9:00 AM – 5:00 PM Pacific Time.
 */
export const storeHours: StoreHoursConfig = {
  timezone: "America/Los_Angeles",
  hours: {
    0: { open: 9, close: 17 }, // Sunday
    1: { open: 9, close: 17 }, // Monday
    2: { open: 9, close: 17 }, // Tuesday
    3: { open: 9, close: 17 }, // Wednesday
    4: { open: 9, close: 17 }, // Thursday
    5: { open: 9, close: 17 }, // Friday
    6: { open: 9, close: 17 }, // Saturday
  },
};

/**
 * Returns true if the given UTC date falls within store operating hours.
 */
export function isWithinStoreHours(date: Date, config: StoreHoursConfig = storeHours): boolean {
  // Convert to store local time
  const localStr = date.toLocaleString("en-US", { timeZone: config.timezone, hour12: false });
  const local = new Date(localStr);

  const dayOfWeek = local.getDay();
  const hour = local.getHours();
  const minute = local.getMinutes();

  const dayHours = config.hours[dayOfWeek];
  if (!dayHours) return false; // store is closed this day

  const timeInMinutes = hour * 60 + minute;
  const openInMinutes = dayHours.open * 60;
  const closeInMinutes = dayHours.close * 60;

  // Slot must start at or after open and strictly before close
  return timeInMinutes >= openInMinutes && timeInMinutes < closeInMinutes;
}
