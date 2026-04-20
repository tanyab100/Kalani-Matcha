import { useState, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedCustomizations: Record<string, string>; // groupId -> optionId
  customizationLabels?: string[]; // human-readable option labels, e.g. ["Oat Milk", "50%"]
  unitPrice: number; // resolved at add-to-cart time, in cents
  hasStaleCustomization?: boolean; // set by reorder when a past customization is no longer available
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  tip: number;   // in cents, defaults to 0
  total: number; // subtotal + tax + tip
}

// ── Constants ────────────────────────────────────────────────────────────────

export const TAX_RATE = 0.1025;

const STORAGE_KEY = "matcha_cart";

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Stable key derived from a customizations map. */
export function customizationKey(selectedCustomizations: Record<string, string>): string {
  return JSON.stringify(Object.entries(selectedCustomizations).sort());
}

/**
 * Compute subtotal, tax, and total for a list of cart items.
 * All values are in cents.
 */
export function computeCartTotals(
  items: CartItem[],
  taxRate: number,
  tip: number,
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax + tip;
  return { subtotal, tax, total };
}

/**
 * Add an item to the cart, merging with an existing line if the same
 * menuItemId + customizations combination already exists.
 */
export function addItemToCart(items: CartItem[], newItem: CartItem): CartItem[] {
  const key = customizationKey(newItem.selectedCustomizations);
  const existingIndex = items.findIndex(
    (i) =>
      i.menuItemId === newItem.menuItemId &&
      customizationKey(i.selectedCustomizations) === key,
  );

  if (existingIndex !== -1) {
    return items.map((item, idx) =>
      idx === existingIndex
        ? { ...item, quantity: item.quantity + newItem.quantity }
        : item,
    );
  }

  return [...items, newItem];
}

/**
 * Remove a specific line item identified by menuItemId + customizationKey.
 */
export function removeItemFromCart(
  items: CartItem[],
  menuItemId: string,
  custKey: string,
): CartItem[] {
  return items.filter(
    (i) =>
      !(i.menuItemId === menuItemId && customizationKey(i.selectedCustomizations) === custKey),
  );
}

/**
 * Update the quantity of a specific line item.
 * Removes the item if the new quantity is <= 0.
 */
export function updateItemQuantity(
  items: CartItem[],
  menuItemId: string,
  custKey: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) {
    return removeItemFromCart(items, menuItemId, custKey);
  }
  return items.map((item) =>
    item.menuItemId === menuItemId &&
    customizationKey(item.selectedCustomizations) === custKey
      ? { ...item, quantity }
      : item,
  );
}

// ── sessionStorage helpers ───────────────────────────────────────────────────

function loadCart(): Cart {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Cart;
    }
  } catch {
    // ignore parse errors
  }
  return emptyCart();
}

function saveCart(cart: Cart): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

function emptyCart(): Cart {
  return { items: [], subtotal: 0, tax: 0, tip: 0, total: 0 };
}

function buildCart(items: CartItem[], tip: number): Cart {
  const { subtotal, tax, total } = computeCartTotals(items, TAX_RATE, tip);
  return { items, subtotal, tax, tip, total };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseCartReturn {
  cart: Cart;
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string, custKey: string) => void;
  updateQuantity: (menuItemId: string, custKey: string, quantity: number) => void;
  setTip: (tip: number) => void;
  clearCart: () => void;
  replaceCart: (items: CartItem[]) => void;
}

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<Cart>(loadCart);

  // Persist to sessionStorage on every change
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addItem = (item: CartItem) => {
    setCart((prev) => {
      const newItems = addItemToCart(prev.items, item);
      return buildCart(newItems, prev.tip);
    });
  };

  const removeItem = (menuItemId: string, custKey: string) => {
    setCart((prev) => {
      const newItems = removeItemFromCart(prev.items, menuItemId, custKey);
      return buildCart(newItems, prev.tip);
    });
  };

  const updateQuantity = (menuItemId: string, custKey: string, quantity: number) => {
    setCart((prev) => {
      const newItems = updateItemQuantity(prev.items, menuItemId, custKey, quantity);
      return buildCart(newItems, prev.tip);
    });
  };

  const setTip = (tip: number) => {
    setCart((prev) => buildCart(prev.items, tip));
  };

  const clearCart = () => {
    setCart(emptyCart());
  };

  const replaceCart = (items: CartItem[]) => {
    setCart(buildCart(items, 0));
  };

  return { cart, addItem, removeItem, updateQuantity, setTip, clearCart, replaceCart };
}
