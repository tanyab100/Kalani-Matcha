import { colors, spacing, typography, layout } from "../../theme";
import type { MenuItem } from "../../types/menu";

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isOutOfStock = !item.inStock;

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        borderRadius: layout.borderRadius.md,
        padding: spacing.md,
        border: `1px solid ${colors.border}`,
        opacity: isOutOfStock ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs }}>
            <span
              style={{
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.semibold,
                color: isOutOfStock ? colors.textDisabled : colors.textPrimary,
              }}
            >
              {item.name}
            </span>
            {isOutOfStock && (
              <span
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.textDisabled,
                  border: `1px solid ${colors.border}`,
                  borderRadius: layout.borderRadius.full,
                  padding: `2px ${spacing.sm}`,
                  whiteSpace: "nowrap",
                }}
              >
                Out of Stock
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: isOutOfStock ? colors.textDisabled : colors.textSecondary,
              margin: 0,
              lineHeight: typography.lineHeight.normal,
            }}
          >
            {item.description}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: spacing.sm, flexShrink: 0 }}>
          <span
            style={{
              fontSize: typography.fontSize.md,
              fontWeight: typography.fontWeight.medium,
              color: isOutOfStock ? colors.textDisabled : colors.textPrimary,
            }}
          >
            {formatPrice(item.basePrice)}
          </span>
          <button
            onClick={() => !isOutOfStock && onSelect(item)}
            disabled={isOutOfStock}
            style={{
              minWidth: "44px",
              minHeight: "44px",
              padding: `${spacing.sm} ${spacing.md}`,
              backgroundColor: isOutOfStock ? colors.border : colors.primary,
              color: isOutOfStock ? colors.textDisabled : colors.surface,
              border: "none",
              borderRadius: layout.borderRadius.md,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: isOutOfStock ? "not-allowed" : "pointer",
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
