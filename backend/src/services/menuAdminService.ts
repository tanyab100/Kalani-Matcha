import type { AdminMenuItem, CreateMenuItemBody } from "../types/menu";

/**
 * Pure function: filters a list of menu items to only those visible on the public menu.
 *
 * An item is visible when both `hidden = false` and `archived = false`.
 *
 * Requirements: 5.4, 6.3, 11.1, 11.2
 */
export function filterPublicItems(items: AdminMenuItem[]): AdminMenuItem[] {
  return items.filter((item) => !item.hidden && !item.archived);
}

/**
 * Pure function: sorts admin menu items by category ASC then name ASC.
 *
 * Does not mutate the input array.
 *
 * Requirements: 1.4
 */
export function sortAdminItems(items: AdminMenuItem[]): AdminMenuItem[] {
  return [...items].sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Pure function: merges default field values onto a create payload.
 *
 * Ensures every newly created item starts with `inStock: true`, `hidden: false`,
 * and `archived: false` regardless of what the caller provided.
 *
 * Requirements: 2.2
 */
export function applyCreateDefaults(
  payload: CreateMenuItemBody
): CreateMenuItemBody & { inStock: true; hidden: false; archived: false } {
  return {
    ...payload,
    inStock: true,
    hidden: false,
    archived: false,
  };
}

/**
 * Pure function: returns a new item with `hidden` set to the given value.
 *
 * Requirements: 5.2, 5.3
 */
export function toggleHidden(item: AdminMenuItem, value: boolean): AdminMenuItem {
  return { ...item, hidden: value };
}

/**
 * Pure function: returns a new item with `archived` set to the given value.
 *
 * Requirements: 6.2, 6.5
 */
export function toggleArchived(item: AdminMenuItem, value: boolean): AdminMenuItem {
  return { ...item, archived: value };
}

/**
 * Pure function: sorts customization groups or options by `sortOrder` ASC.
 *
 * Works for both `AdminCustomizationGroup[]` and `AdminCustomizationOption[]`
 * since both carry a `sortOrder` field. Does not mutate the input array.
 *
 * Requirements: 8.1, 9.1
 */
export function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}
