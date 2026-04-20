import { colors, spacing, typography } from "../../theme";
import type { Cart } from "../../hooks/useCart";

interface CartSummaryProps {
  cart: Cart;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  };

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.border}`,
        paddingTop: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <div style={rowStyle}>
        <span>Subtotal</span>
        <span>{formatDollars(cart.subtotal)}</span>
      </div>
      <div style={rowStyle}>
        <span>Tax</span>
        <span>{formatDollars(cart.tax)}</span>
      </div>
      {cart.tip > 0 && (
        <div style={rowStyle}>
          <span>Tip</span>
          <span>{formatDollars(cart.tip)}</span>
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
        <span>{formatDollars(cart.total)}</span>
      </div>
    </div>
  );
}
