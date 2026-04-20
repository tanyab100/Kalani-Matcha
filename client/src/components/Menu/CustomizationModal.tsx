import { useState } from "react";
import { colors, spacing, typography, layout } from "../../theme";
import type { MenuItem } from "../../types/menu";

interface CustomizationModalProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (item: MenuItem, selections: Record<string, string>, quantity: number) => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CustomizationModal({ item, onClose, onAddToCart }: CustomizationModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const computedPrice =
    item.basePrice +
    Object.entries(selections).reduce((sum, [groupId, optionId]) => {
      const group = item.customizations.find((g) => g.id === groupId);
      const option = group?.options.find((o) => o.id === optionId);
      return sum + (option?.priceDelta ?? 0);
    }, 0);

  const requiredGroups = item.customizations.filter((g) => g.required);
  const missingGroups = requiredGroups.filter((g) => !selections[g.id]);
  const isValid = missingGroups.length === 0;

  function handleSelect(groupId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [groupId]: optionId }));
    setValidationError(null);
  }

  function handleAddToCart() {
    if (!isValid) {
      setValidationError(
        `Please select: ${missingGroups.map((g) => g.label).join(", ")}`
      );
      return;
    }
    onAddToCart(item, selections, quantity);
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Customize ${item.name}`}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: spacing.md,
      }}
    >
      <div
        style={{
          backgroundColor: colors.surface,
          borderRadius: layout.borderRadius.lg,
          width: "100%",
          maxWidth: layout.maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: spacing.md,
            borderBottom: `1px solid ${colors.border}`,
            position: "sticky",
            top: 0,
            backgroundColor: colors.surface,
            zIndex: 1,
          }}
        >
          <div>
            <div
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              {item.name}
            </div>
            <div
              style={{
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.medium,
                color: colors.primary,
                marginTop: spacing.xs,
              }}
            >
              {formatPrice(computedPrice)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: "44px",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: `1px solid ${colors.border}`,
              borderRadius: layout.borderRadius.full,
              fontSize: typography.fontSize.lg,
              cursor: "pointer",
              color: colors.textSecondary,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Customization groups */}
        <div style={{ padding: spacing.md, flex: 1 }}>
          {item.customizations.map((group) => (
            <div key={group.id} style={{ marginBottom: spacing.lg }}>
              <div
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  marginBottom: spacing.sm,
                  display: "flex",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                {group.label}
                {group.required && (
                  <span
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.error,
                      border: `1px solid ${colors.error}`,
                      borderRadius: layout.borderRadius.full,
                      padding: `2px ${spacing.sm}`,
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
                {group.options.map((option) => {
                  const isSelected = selections[group.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(group.id, option.id)}
                      style={{
                        minHeight: "44px",
                        padding: `${spacing.sm} ${spacing.md}`,
                        borderRadius: layout.borderRadius.full,
                        border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        color: isSelected ? colors.surface : colors.textPrimary,
                        fontSize: typography.fontSize.sm,
                        cursor: "pointer",
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      {option.label}
                      {option.priceDelta !== 0 && (
                        <span style={{ marginLeft: spacing.xs, opacity: 0.85 }}>
                          ({option.priceDelta > 0 ? "+" : ""}
                          {formatPrice(option.priceDelta)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quantity selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
              }}
            >
              Quantity
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: layout.borderRadius.full,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.lg,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                −
              </button>
              <span
                style={{
                  minWidth: "32px",
                  textAlign: "center",
                  fontSize: typography.fontSize.md,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                }}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: layout.borderRadius.full,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  fontSize: typography.fontSize.lg,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
            <div
              role="alert"
              style={{
                color: colors.error,
                fontSize: typography.fontSize.sm,
                marginBottom: spacing.md,
              }}
            >
              {validationError}
            </div>
          )}

          {/* Add to Cart button */}
          <button
            onClick={handleAddToCart}
            disabled={false}
            style={{
              width: "100%",
              minHeight: "44px",
              padding: spacing.md,
              backgroundColor: isValid ? colors.primary : colors.border,
              color: isValid ? colors.surface : colors.textDisabled,
              border: "none",
              borderRadius: layout.borderRadius.md,
              fontSize: typography.fontSize.md,
              fontWeight: typography.fontWeight.semibold,
              cursor: isValid ? "pointer" : "not-allowed",
            }}
          >
            Add to Cart · {formatPrice(computedPrice * quantity)}
          </button>
        </div>
      </div>
    </div>
  );
}
