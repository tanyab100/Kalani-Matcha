import { useEffect, useState } from "react";
import { colors, spacing, typography, layout } from "../../theme";

export interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedCustomizations: Record<string, string>;
  customizationLabels?: string[];
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
  pickupTime: string; // ISO 8601
  status: "pending_payment" | "received" | "preparing" | "ready";
  paymentMethod: "card" | "venmo";
  createdAt: string;
  idempotencyKey: string;
}

export interface OrderConfirmationData {
  orderId: string;
  pickupTime: string;
  items: Array<{
    name: string;
    customizations: string[];
    quantity: number;
    linePrice: number;
  }>;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

/**
 * Pure function that transforms an Order into structured display data.
 * Used by the component and by property tests (P18).
 */
export function renderOrderConfirmation(order: Order): OrderConfirmationData {
  const pickupDate = new Date(order.pickupTime);
  const pickupTime = pickupDate.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const items = order.items.map((item) => ({
    name: item.name,
    customizations: item.customizationLabels ?? [],
    quantity: item.quantity,
    linePrice: item.unitPrice * item.quantity,
  }));

  return {
    orderId: order.id.slice(-8).toUpperCase(),
    pickupTime,
    items,
    subtotal: order.subtotal,
    tax: order.tax,
    tip: order.tip,
    total: order.total,
  };
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface OrderConfirmationProps {
  order: Order;
}

export function OrderConfirmation({ order }: OrderConfirmationProps) {
  const data = renderOrderConfirmation(order);

  const containerStyle: React.CSSProperties = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  };

  const successBannerStyle: React.CSSProperties = {
    backgroundColor: colors.success,
    color: colors.surface,
    borderRadius: layout.borderRadius.md,
    padding: spacing.lg,
    textAlign: "center",
    marginBottom: spacing.lg,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: spacing.xs,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: `1px solid ${colors.border}`,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  };

  return (
    <div style={containerStyle}>
      {/* Success banner */}
      <div style={successBannerStyle}>
        <div style={{ fontSize: typography.fontSize.xxl, marginBottom: spacing.xs }}>✓</div>
        <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold }}>
          Order Confirmed!
        </div>
        <div style={{ fontSize: typography.fontSize.sm, marginTop: spacing.xs, opacity: 0.9 }}>
          {order.paymentMethod === "venmo"
            ? "Complete your Venmo payment to finalize your order."
            : "Your order has been received."}
        </div>
      </div>

      {/* Order number + pickup time */}
      <div style={cardStyle}>
        <div style={{ marginBottom: spacing.md }}>
          <div style={labelStyle}>Order Number</div>
          <div style={valueStyle}>#{data.orderId}</div>
        </div>
        <div>
          <div style={labelStyle}>Pickup Time</div>
          <div style={valueStyle}>{data.pickupTime}</div>
        </div>
      </div>

      {/* Itemized summary */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}
        >
          Order Summary
        </div>

        {data.items.map((item, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: spacing.md,
              paddingBottom: spacing.md,
              borderBottom:
                idx < data.items.length - 1 ? `1px solid ${colors.border}` : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
                marginBottom: spacing.xs,
              }}
            >
              <span>
                {item.quantity}× {item.name}
              </span>
              <span>{formatDollars(item.linePrice)}</span>
            </div>
            {item.customizations.length > 0 && (
              <div
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.textSecondary,
                  paddingLeft: spacing.sm,
                }}
              >
                {item.customizations.join(", ")}
              </div>
            )}
          </div>
        ))}

        {/* Totals */}
        <div style={dividerStyle}>
          <div style={rowStyle}>
            <span>Subtotal</span>
            <span>{formatDollars(data.subtotal)}</span>
          </div>
          <div style={rowStyle}>
            <span>Tax</span>
            <span>{formatDollars(data.tax)}</span>
          </div>
          {data.tip > 0 && (
            <div style={rowStyle}>
              <span>Tip</span>
              <span>{formatDollars(data.tip)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: typography.fontSize.md,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              marginTop: spacing.sm,
              paddingTop: spacing.sm,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <span>Total</span>
            <span>{formatDollars(data.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
