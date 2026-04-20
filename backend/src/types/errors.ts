/**
 * Standardized API error codes used across backend route handlers.
 * These codes are returned in JSON responses as { error: { code, message } }.
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
