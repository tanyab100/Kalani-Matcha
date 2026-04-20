import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getOrder, ApiError } from "../../services/api";
import { OrderConfirmation } from "./OrderConfirmation";
import type { Order } from "./OrderConfirmation";
import { colors, spacing, typography, layout } from "../../theme";

export function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !token) {
      setError(!orderId ? "No order ID provided." : "Order access token missing.");
      setLoading(false);
      return;
    }
    getOrder(orderId, token)
      .then((data) => setOrder(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("Access denied. Please use the link from your confirmation email.");
        } else if (err instanceof ApiError && err.status === 404) {
          setError("Order not found. Please check your order number.");
        } else {
          setError("Could not load your order. Please check your connection and try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [orderId, token]);

  const containerStyle: React.CSSProperties = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
    textAlign: "center",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          Loading your order...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ color: colors.error, fontSize: typography.fontSize.md }}>{error}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={containerStyle}>
        <div style={{ color: colors.error, fontSize: typography.fontSize.md }}>Order not found.</div>
      </div>
    );
  }

  return <OrderConfirmation order={order} />;
}
