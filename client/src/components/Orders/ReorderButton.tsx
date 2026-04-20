import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type CartItem } from "../../hooks/useCart";
import { useCartContext } from "../../context/CartContext";
import { useAuthContext } from "../../context/AuthContext";
import { api } from "../../services/api";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaleCustomizationInfo {
  name: string;
  menuItemId: string;
  staleOptionLabels: string[];
}

interface ReorderPayload {
  items: CartItem[];
  unavailableItems: string[];
  staleCustomizationItems: StaleCustomizationInfo[];
}

interface ReorderButtonProps {
  orderId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReorderButton({ orderId }: ReorderButtonProps) {
  const { token } = useAuthContext();
  const { replaceCart } = useCartContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleReorder = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const payload = await api.post<ReorderPayload>(
        `/orders/${orderId}/reorder`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Mark stale-customization items so checkout can block them
      const itemsWithFlags: CartItem[] = payload.items.map((item) => ({
        ...item,
        hasStaleCustomization: payload.staleCustomizationItems.some(
          (s) => s.menuItemId === item.menuItemId,
        ),
      }));

      replaceCart(itemsWithFlags);

      // Build warning messages
      const newWarnings: string[] = [];

      if (payload.unavailableItems.length > 0) {
        newWarnings.push(
          `Removed from cart (no longer available): ${payload.unavailableItems.join(", ")}.`,
        );
      }

      for (const stale of payload.staleCustomizationItems) {
        newWarnings.push(
          `${stale.name}: ${stale.staleOptionLabels.join(", ")} ${stale.staleOptionLabels.length === 1 ? "is" : "are"} no longer available — update before checkout.`,
        );
      }

      if (newWarnings.length > 0) {
        // Show warnings briefly before navigating so the user sees them
        setWarnings(newWarnings);
        setTimeout(() => navigate("/cart"), 2500);
      } else {
        navigate("/cart");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reorder. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: spacing.sm }}>
      {/* Warning banners */}
      {warnings.map((w, i) => (
        <div
          key={i}
          role="alert"
          style={{
            backgroundColor: "#fff3cd",
            border: `1px solid ${colors.warning}`,
            borderRadius: layout.borderRadius.sm,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            fontSize: typography.fontSize.sm,
            color: "#664d03",
          }}
        >
          {w}
        </div>
      ))}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: "#f8d7da",
            border: `1px solid ${colors.error}`,
            borderRadius: layout.borderRadius.sm,
            padding: spacing.sm,
            marginBottom: spacing.sm,
            fontSize: typography.fontSize.sm,
            color: "#842029",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleReorder}
        disabled={loading || !token}
        aria-label="Reorder"
        style={{
          minWidth: touchTarget.minSize,
          minHeight: touchTarget.minSize,
          padding: `${spacing.sm} ${spacing.md}`,
          backgroundColor: loading || !token ? colors.textDisabled : colors.primary,
          color: colors.surface,
          border: "none",
          borderRadius: layout.borderRadius.md,
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          cursor: loading || !token ? "not-allowed" : "pointer",
          transition: "background-color 0.15s",
        }}
      >
        {loading ? "Adding to cart…" : "Reorder"}
      </button>
    </div>
  );
}
