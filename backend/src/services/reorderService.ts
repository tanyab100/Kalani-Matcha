import type { CartItem } from "../types/order";
import type { MenuItem } from "../types/menu";

export interface PastOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedCustomizations: Record<string, string>; // groupId -> optionId
  unitPrice: number;
}

export interface UnavailableItem {
  name: string;
  menuItemId: string;
}

export interface StaleCustomizationItem {
  name: string;
  menuItemId: string;
  /** Human-readable labels of the customization options that are no longer available */
  staleOptionLabels: string[];
}

export interface ReorderCartResult {
  cartItems: CartItem[];
  unavailableItems: UnavailableItem[];
  staleCustomizationItems: StaleCustomizationItem[];
}

/**
 * Pure function: rebuilds a cart from a past order using current menu data.
 *
 * - Items whose menu entry is missing or out of stock are excluded and reported as unavailable.
 * - Items with stale customizations (options no longer in the menu) are included in the cart
 *   but also reported in staleCustomizationItems so the client can prompt the user.
 * - Prices are recalculated from current menu data (base_price + sum of price_delta for selected options).
 *
 * Requirements: 8.3, 8.4, 8.5, 8.6
 */
export function buildReorderCart(
  pastItems: PastOrderItem[],
  currentMenuItems: MenuItem[]
): ReorderCartResult {
  const menuMap = new Map<string, MenuItem>(currentMenuItems.map((m) => [m.id, m]));

  const cartItems: CartItem[] = [];
  const unavailableItems: UnavailableItem[] = [];
  const staleCustomizationItems: StaleCustomizationItem[] = [];

  for (const pastItem of pastItems) {
    const current = menuMap.get(pastItem.menuItemId);

    // Requirement 8.4: item no longer exists or is out of stock → unavailable
    if (!current || !current.inStock) {
      unavailableItems.push({ name: pastItem.name, menuItemId: pastItem.menuItemId });
      continue;
    }

    // Build a flat map of all current options: optionId -> priceDelta
    const optionPriceMap = new Map<string, number>();
    // Build a set of all valid optionIds per group for stale-check
    const groupOptionMap = new Map<string, Set<string>>();
    for (const group of current.customizations) {
      const optionIds = new Set<string>();
      for (const opt of group.options) {
        optionPriceMap.set(opt.id, opt.priceDelta);
        optionIds.add(opt.id);
      }
      groupOptionMap.set(group.id, optionIds);
    }

    // Requirement 8.6: check for stale customizations — collect labels of removed options
    // Build a map of optionId -> label for all current options so we can name what's missing
    const optionLabelMap = new Map<string, string>();
    for (const group of current.customizations) {
      for (const opt of group.options) {
        optionLabelMap.set(opt.id, opt.label);
      }
    }

    // Also need the past option labels — stored in the snapshot's customization data isn't
    // available here, so we fall back to the group label when the option is gone entirely.
    // We build a map of groupId -> groupLabel for readable fallback names.
    const groupLabelMap = new Map<string, string>(
      current.customizations.map((g) => [g.id, g.label])
    );

    const staleOptionLabels: string[] = [];
    for (const [groupId, optionId] of Object.entries(pastItem.selectedCustomizations)) {
      const validOptions = groupOptionMap.get(groupId);
      if (!validOptions || !validOptions.has(optionId)) {
        // Use the group label as context (e.g. "Milk type") since the option label is gone
        const groupLabel = groupLabelMap.get(groupId) ?? "customization";
        staleOptionLabels.push(groupLabel);
      }
    }

    if (staleOptionLabels.length > 0) {
      staleCustomizationItems.push({ name: current.name, menuItemId: current.id, staleOptionLabels });
    }

    // Requirement 8.5: recalculate price from current menu data
    let unitPrice = current.basePrice;
    for (const optionId of Object.values(pastItem.selectedCustomizations)) {
      const delta = optionPriceMap.get(optionId);
      if (delta !== undefined) {
        unitPrice += delta;
      }
    }

    // Requirement 8.3: include item in cart (even if stale — client will prompt user)
    cartItems.push({
      menuItemId: current.id,
      name: current.name,
      quantity: pastItem.quantity,
      selectedCustomizations: pastItem.selectedCustomizations,
      unitPrice,
    });
  }

  return { cartItems, unavailableItems, staleCustomizationItems };
}
