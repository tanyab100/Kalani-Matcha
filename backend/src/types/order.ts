export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedCustomizations: Record<string, string>; // groupId -> optionId
  customizationLabels?: string[]; // human-readable option labels
  unitPrice: number; // cents
}

export interface Order {
  id: string;
  customerId: string | null;
  guestEmail?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  pickupSlotId: string;
  pickupTime: string;
  status: "pending_payment" | "received" | "preparing" | "ready";
  paymentMethod: "card" | "venmo";
  /** Memo text shown to the customer for Venmo payment (e.g. "Order ABC12345") */
  paymentReference?: string;
  /** ISO timestamp when Store_Admin confirmed Venmo payment */
  paymentConfirmedAt?: string;
  /** Identifier of the admin who confirmed payment (for audit trail) */
  paymentConfirmedBy?: string;
  createdAt: string;
  idempotencyKey: string;
  paymentIntentId?: string;
}

export interface CreateOrderInput {
  customerId?: string | null;
  guestEmail?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  pickupSlotId: string;
  paymentMethod: "card" | "venmo";
  idempotencyKey: string;
  paymentIntentId?: string;
}
