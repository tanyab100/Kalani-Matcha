/**
 * Standardized API error codes — mirrors backend/src/types/errors.ts.
 * Components pattern-match on these codes to drive UI behavior:
 *   - SLOT_UNAVAILABLE → re-render TimeSlotPicker with prompt
 *   - SLOT_CAPACITY_EXCEEDED → prompt customer to pick a different slot
 *   - UNAUTHORIZED → show AuthModal
 *   - PAYMENT_FAILED → show retry / different payment method UI
 *   - PAYMENT_TIMEOUT → show timeout error; cart is preserved in sessionStorage
 *
 * Requirements: 5.6, 5.10, 6.3
 */
export const ErrorCode = {
  // Slot errors
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  SLOT_CAPACITY_EXCEEDED: "SLOT_CAPACITY_EXCEEDED",

  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Payment errors
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_TIMEOUT: "PAYMENT_TIMEOUT",

  // Cart / item errors
  CART_ITEM_UNAVAILABLE: "CART_ITEM_UNAVAILABLE",
  INVALID_CUSTOMIZATION: "INVALID_CUSTOMIZATION",

  // General errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
