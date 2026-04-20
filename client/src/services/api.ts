/**
 * Typed fetch wrappers for backend routes.
 * Uses the native fetch API (no axios or other HTTP clients).
 *
 * Error handling:
 * - Backend returns { error: { code, message } } for all errors.
 * - ApiError exposes `.code` so components can pattern-match on ErrorCode constants.
 * - SLOT_UNAVAILABLE / SLOT_CAPACITY_EXCEEDED → re-render TimeSlotPicker (Req 5.6)
 * - PAYMENT_FAILED → show retry / different payment method UI (Req 5.10)
 * - PAYMENT_TIMEOUT → show timeout error; cart preserved in sessionStorage (Req 6.3)
 * - UNAUTHORIZED → dispatch auth:unauthorized event → AuthModal shown
 */

import { ErrorCode } from "../types/errors";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the slot is no longer available (stale selection). Req 5.6 */
  isSlotUnavailable(): boolean {
    return this.code === ErrorCode.SLOT_UNAVAILABLE;
  }

  /** True when the slot is fully booked. Req 5.6 */
  isSlotCapacityExceeded(): boolean {
    return this.code === ErrorCode.SLOT_CAPACITY_EXCEEDED;
  }

  /** True for any slot conflict — prompt customer to re-select. Req 5.6 */
  isSlotConflict(): boolean {
    return this.isSlotUnavailable() || this.isSlotCapacityExceeded();
  }

  /** True when payment was declined or failed. Req 5.10 */
  isPaymentFailed(): boolean {
    return this.code === ErrorCode.PAYMENT_FAILED;
  }

  /** True on network timeout during payment — cart must be preserved. Req 6.3 */
  isPaymentTimeout(): boolean {
    return this.code === ErrorCode.PAYMENT_TIMEOUT;
  }

  /** True when the session is unauthenticated. */
  isUnauthorized(): boolean {
    return this.code === ErrorCode.UNAUTHORIZED;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    // Support both legacy flat shape { error: string } and new nested shape
    // { error: { code, message } } so the transition is non-breaking.
    let code: string;
    let message: string;
    if (body.error && typeof body.error === "object") {
      code = body.error.code ?? "UNKNOWN_ERROR";
      message = body.error.message ?? res.statusText;
    } else {
      code = body.error ?? "UNKNOWN_ERROR";
      message = body.message ?? res.statusText;
    }

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    throw new ApiError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

import type { PickupSlot } from "../types/menu";

export function getPickupSlots(): Promise<PickupSlot[]> {
  return request<{ slots: PickupSlot[] }>("/pickup-slots").then((data) => data.slots);
}

export interface VenmoOrderPayload {
  cart: {
    items: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      selectedCustomizations: Record<string, string>;
    }>;
    tip: number;
  };
  pickupSlotId: string;
  idempotencyKey: string;
  guestEmail?: string;
}

export interface VenmoOrderResponse {
  order: {
    id: string;
    status: string;
    paymentMethod: string;
    /** Memo text to include in the Venmo payment note (e.g. "Order ABC12345") */
    paymentReference?: string;
    total: number;
    pickupTime: string;
    [key: string]: unknown;
  };
  /** One-time plaintext access token — store in sessionStorage for polling. */
  accessToken: string;
}

export function createVenmoOrder(payload: VenmoOrderPayload): Promise<VenmoOrderResponse> {
  return request<VenmoOrderResponse>("/checkout/venmo-order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "GET", ...options }),

  post: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),

  patch: <T>(path: string, body: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
};

import type { Order } from "../components/Orders/OrderConfirmation";

export interface OrderWithToken {
  orderId: string;
  accessToken: string;
}

export function getOrder(id: string, token: string): Promise<Order> {
  const params = new URLSearchParams({ token });
  return request<{ order: Order }>(`/orders/${id}?${params}`).then((data) => data.order);
}

/**
 * Exchanges a one-time redirect token (from the webhook response) for the
 * order ID and access token. Called once after card payment confirmation.
 */
export function exchangeRedirectToken(redirectToken: string): Promise<OrderWithToken> {
  return request<OrderWithToken>("/orders/exchange-redirect-token", {
    method: "POST",
    body: JSON.stringify({ redirectToken }),
  });
}

export { ApiError, ErrorCode };
