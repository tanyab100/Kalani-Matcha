import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";
import { colors, spacing, typography, layout } from "../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  customizationLabels?: string[];
}

interface AdminOrder {
  id: string;
  status: "pending_payment" | "received" | "preparing" | "ready";
  payment_method: "card" | "venmo";
  payment_reference: string | null;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  items_snapshot: AdminOrderItem[];
  guest_email: string | null;
  customer_id: string | null;
  created_at: string;
  payment_confirmed_at: string | null;
  slot_time: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

const STATUS_LABELS: Record<AdminOrder["status"], string> = {
  pending_payment: "Pending Payment",
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
};

const STATUS_COLORS: Record<AdminOrder["status"], string> = {
  pending_payment: colors.warning,
  received: colors.info,
  preparing: colors.primary,
  ready: colors.success,
};

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OrdersPage() {
  const { token, customer } = useAuthContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AdminOrder["status"]>("all");

  useEffect(() => {
    if (!token || customer?.role !== "store_admin") {
      navigate("/menu", { replace: true });
    }
  }, [token, customer, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirmPayment(orderId: string) {
    if (!token) return;
    setConfirming(orderId);
    try {
      const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed");
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, status: "received" } : o)
      );
    } catch {
      alert("Failed to confirm payment. Please try again.");
    } finally {
      setConfirming(null);
    }
  }

  async function updateStatus(orderId: string, status: AdminOrder["status"]) {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, status } : o)
      );
    } catch {
      alert("Failed to update status. Please try again.");
    }
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const pageStyle: React.CSSProperties = {
    maxWidth: "800px",
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

  const badgeStyle = (status: AdminOrder["status"]): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: layout.borderRadius.full,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    backgroundColor: STATUS_COLORS[status],
    color: status === "pending_payment" ? colors.textPrimary : colors.surface,
  });

  if (!token || customer?.role !== "store_admin") return null;

  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg, flexWrap: "wrap", gap: spacing.sm }}>
        <div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
          Orders
        </div>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          {orders.length} total
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" }}>
        {(["all", "pending_payment", "received", "preparing", "ready"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: `${spacing.xs} ${spacing.md}`,
              borderRadius: layout.borderRadius.full,
              border: `1px solid ${filter === f ? colors.primary : colors.border}`,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              color: filter === f ? colors.surface : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              cursor: "pointer",
              fontWeight: typography.fontWeight.medium,
            }}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
            {f !== "all" && (
              <span style={{ marginLeft: spacing.xs, opacity: 0.8 }}>
                ({orders.filter((o) => o.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: colors.textSecondary }}>Loading orders…</div>}
      {error && <div style={{ color: colors.error }}>{error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ color: colors.textSecondary, textAlign: "center", padding: spacing.xl }}>
          No orders found.
        </div>
      )}

      {filtered.map((order) => (
        <div key={order.id} style={cardStyle}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm, flexWrap: "wrap", gap: spacing.xs }}>
            <div>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                #{order.id.slice(-8).toUpperCase()}
              </span>
              <span style={{ marginLeft: spacing.sm, fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                {formatTime(order.created_at)}
              </span>
            </div>
            <span style={badgeStyle(order.status)}>{STATUS_LABELS[order.status]}</span>
          </div>

          {/* Customer + pickup */}
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
            {order.guest_email ?? "Registered customer"}
            {order.slot_time && (
              <span style={{ marginLeft: spacing.sm }}>· Pickup: {formatTime(order.slot_time)}</span>
            )}
          </div>

          {/* Items */}
          <div style={{ marginBottom: spacing.sm }}>
            {order.items_snapshot.map((item, i) => (
              <div key={i} style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginBottom: "2px" }}>
                {item.quantity}× {item.name}
                {item.customizationLabels && item.customizationLabels.length > 0 && (
                  <span style={{ color: colors.textSecondary, marginLeft: spacing.xs }}>
                    ({item.customizationLabels.join(", ")})
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Total + payment */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {order.payment_method === "venmo" ? "Venmo" : "Card"} · {formatDollars(order.total)}
              {order.payment_reference && (
                <span style={{ marginLeft: spacing.xs, fontWeight: typography.fontWeight.semibold }}>
                  · {order.payment_reference}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
              {order.status === "pending_payment" && order.payment_method === "venmo" && (
                <button
                  onClick={() => confirmPayment(order.id)}
                  disabled={confirming === order.id}
                  style={{
                    padding: "4px 12px",
                    fontSize: typography.fontSize.xs,
                    fontWeight: typography.fontWeight.semibold,
                    backgroundColor: colors.success,
                    color: colors.surface,
                    border: "none",
                    borderRadius: layout.borderRadius.sm,
                    cursor: confirming === order.id ? "not-allowed" : "pointer",
                    opacity: confirming === order.id ? 0.6 : 1,
                  }}
                >
                  {confirming === order.id ? "Confirming…" : "Confirm Payment"}
                </button>
              )}
              {order.status === "received" && (
                <button onClick={() => updateStatus(order.id, "preparing")}
                  style={{ padding: "4px 12px", fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, backgroundColor: colors.primary, color: colors.surface, border: "none", borderRadius: layout.borderRadius.sm, cursor: "pointer" }}>
                  Mark Preparing
                </button>
              )}
              {order.status === "preparing" && (
                <button onClick={() => updateStatus(order.id, "ready")}
                  style={{ padding: "4px 12px", fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, backgroundColor: colors.success, color: colors.surface, border: "none", borderRadius: layout.borderRadius.sm, cursor: "pointer" }}>
                  Mark Ready
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
