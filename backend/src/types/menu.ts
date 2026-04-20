export interface CustomizationOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface CustomizationGroup {
  id: string;
  label: string;
  required: boolean;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: "drinks" | "food" | "extras";
  inStock: boolean;
  customizations: CustomizationGroup[];
}

// Admin-only extended types

/** Admin view of a menu item — includes hidden and archived flags. */
export interface AdminMenuItem extends MenuItem {
  hidden: boolean;
  archived: boolean;
}

/** Admin view of a customization group — includes sortOrder. */
export interface AdminCustomizationGroup {
  id: string;
  menuItemId: string;
  label: string;
  required: boolean;
  sortOrder: number;
  options: AdminCustomizationOption[];
}

/** Admin view of a customization option — includes sortOrder. */
export interface AdminCustomizationOption {
  id: string;
  customizationGroupId: string;
  label: string;
  priceDelta: number;
  sortOrder: number;
}

/** Request body for creating a menu item. */
export interface CreateMenuItemBody {
  name: string;
  description?: string;
  basePrice: number;
  category: "drinks" | "food" | "extras";
}

/** Request body for updating a menu item (all fields optional). */
export interface UpdateMenuItemBody {
  name?: string;
  description?: string;
  basePrice?: number;
  category?: "drinks" | "food" | "extras";
}

/** Request body for creating a customization group. */
export interface CreateGroupBody {
  label: string;
  required: boolean;
  sortOrder: number;
}

/** Request body for creating a customization option. */
export interface CreateOptionBody {
  label: string;
  priceDelta: number; // integer cents, may be negative
  sortOrder: number;
}
