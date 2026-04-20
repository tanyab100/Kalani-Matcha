import { useEffect, useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { api, ApiError } from "../../services/api";
import { colors, spacing, typography, layout } from "../../theme";
import type { CartItem } from "./OrderConfirmation";
import { ReorderButton } from "./ReorderButton";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryOrder {
  id: string;
  createdAt: string;
  total: number;
  items: CartItem[];
}

export interface OrderDetailData {
  orderId: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    customizations: string[];
  }>;
  total: string;
}

// ── Pure transform ────────────────────────────────────────────────────────────

/**
 * Pure function that sorts a list of past orders by createdAt descending
 * (most recent first), without omitting any orders.
 * Used by the component and by property tests (Property 19).
 */
export function sortOrderHistory(orders: HistoryOrder[]): HistoryOrder[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Pure function that transforms a HistoryOrder into structured display data.
 * Used by the component and by property tests (Property 20).
 */
export function renderOrderDetail(order: HistoryOrder): OrderDetailData {
  const date = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const items = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    customizations: Object.values(item.selectedCustomizations),
  }));

  return {
    orderId: order.id.slice(-8).toUpperCase(),
    date,
    items,
    total: `$${(order.total / 100).toFixed(2)}`,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderHistoryPage() {
  const { token } = useAuthContext();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    api
      .get<{ orders: HistoryOrder[] }>("/orders/history", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((data) => setOrders(data.orders))
      .catch((err) => {
        // 401 is handled globally via auth:unauthorized event in api.ts
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error("Failed to load order history", err);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const pageStyle: React.CSSProperties = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  };

  const orderHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  };

  const orderIdStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    fontFamily: "monospace",
  };

  const dateStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  };

  const totalStyle: React.CSSProperties = {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: `1px solid ${colors.border}`,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  };

  const itemRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  };

  const customizationStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  };

  const emptyStyle: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    marginTop: spacing.xl,
    textAlign: "center",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          Loading order history…
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={titleStyle}>Order History</div>
      {orders.length === 0 ? (
        <div style={emptyStyle}>No past orders yet.</div>
      ) : (
        orders.map((order) => {
          const detail = renderOrderDetail(order);
          return (
            <div key={order.id} style={cardStyle}>
              {/* Order header: ID + date on left, total on right */}
              <div style={orderHeaderStyle}>
                <div>
                  <div style={orderIdStyle}>#{detail.orderId}</div>
                  <div style={dateStyle}>{detail.date}</div>
                </div>
                <div style={totalStyle}>{detail.total}</div>
              </div>

              {/* Items list */}
              <div style={dividerStyle}>
                {detail.items.map((item, idx) => (
                  <div key={idx}>
                    <div style={itemRowStyle}>
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                    </div>
                    {item.customizations.length > 0 && (
                      <div style={customizationStyle}>
                        {item.customizations.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ReorderButton */}
              <div style={{ marginTop: spacing.sm }}>
                <ReorderButton orderId={order.id} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
