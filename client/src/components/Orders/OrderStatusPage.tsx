import { useParams, useSearchParams } from "react-router-dom";
import { useOrderStatus } from "../../hooks/useOrderStatus";
import { colors, spacing, typography, layout } from "../../theme";
import type { Order } from "./OrderConfirmation";

// Requirements: 7.2, 7.3
const STATUS_LABELS: Record<Order["status"], string> = {
  pending_payment: "Pending Payment",
  received: "Received",
  preparing: "Preparing",
  ready: "Ready for Pickup",
};

const STATUS_DESCRIPTIONS: Record<Order["status"], string> = {
  pending_payment: "Waiting for Venmo payment confirmation.",
  received: "Your order has been received and is queued.",
  preparing: "The team is preparing your order.",
  ready: "Your order is ready — head over to pick it up!",
};

// Ordered list of statuses for the progress indicator (Venmo-only shows pending_payment)
const CARD_STEPS: Order["status"][] = ["received", "preparing", "ready"];
const VENMO_STEPS: Order["status"][] = ["pending_payment", "received", "preparing", "ready"];

function StatusStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  const dotStyle: React.CSSProperties = {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: done || active ? colors.primary : colors.border,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
      <div style={dotStyle}>
        {done && (
          <span style={{ color: colors.surface, fontSize: "10px", fontWeight: 700 }}>✓</span>
        )}
      </div>
      <span
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.regular,
          color: active ? colors.textPrimary : done ? colors.textSecondary : colors.textDisabled,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  // Token is embedded in the URL (?token=...) so the link is shareable and
  // survives tab closes, device switches, and sessionStorage clearing.
  const accessToken = searchParams.get("token");

  const { order, loading, error } = useOrderStatus(id ?? null, accessToken);

  const containerStyle: React.CSSProperties = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  };

  if (!id) {
    return (
      <div style={containerStyle}>
        <p style={{ color: colors.error }}>No order ID provided.</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div style={containerStyle}>
        <p style={{ color: colors.error }}>Order access token missing. Please use the link from your confirmation page.</p>
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div style={containerStyle}>
        <p style={{ color: colors.textSecondary }}>Loading order status…</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div style={containerStyle}>
        <p style={{ color: colors.error }}>{error}</p>
      </div>
    );
  }

  if (!order) return null;

  const steps = order.paymentMethod === "venmo" ? VENMO_STEPS : CARD_STEPS;
  const currentIdx = steps.indexOf(order.status);

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <h1
          style={{
            fontSize: typography.fontSize.xl,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
          }}
        >
          Order Status
        </h1>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: `${spacing.xs} 0 0` }}>
          #{order.id.slice(-8).toUpperCase()}
        </p>
      </div>

      {/* Current status banner */}
      <div
        style={{
          ...cardStyle,
          backgroundColor:
            order.status === "ready" ? colors.success : colors.primary,
          border: "none",
          color: colors.surface,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold }}>
          {STATUS_LABELS[order.status]}
        </div>
        <div style={{ fontSize: typography.fontSize.sm, marginTop: spacing.xs, opacity: 0.9 }}>
          {STATUS_DESCRIPTIONS[order.status]}
        </div>
      </div>

      {/* Progress steps */}
      <div style={cardStyle}>
        {steps.map((step, idx) => (
          <StatusStep
            key={step}
            label={STATUS_LABELS[step]}
            active={idx === currentIdx}
            done={idx < currentIdx}
          />
        ))}
      </div>

      {/* Pickup time */}
      <div style={cardStyle}>
        <div
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: spacing.xs,
          }}
        >
          Pickup Time
        </div>
        <div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {new Date(order.pickupTime).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      </div>

      {error && (
        <p style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
          Could not refresh status: {error}
        </p>
      )}
    </div>
  );
}
