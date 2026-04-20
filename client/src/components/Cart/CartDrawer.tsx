import { useNavigate } from "react-router-dom";
import { useCartContext } from "../../context/CartContext";
import { customizationKey } from "../../hooks/useCart";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";
import { CartSummary } from "./CartSummary";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, removeItem, updateQuantity } = useCartContext();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  return (
    // Overlay
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 0,
          width: "100%",
          maxWidth: layout.maxWidth,
          backgroundColor: colors.surface,
          borderRadius: `${layout.borderRadius.lg} ${layout.borderRadius.lg} 0 0`,
          maxHeight: "85vh",
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
            alignItems: "center",
            padding: spacing.md,
            borderBottom: `1px solid ${colors.border}`,
            position: "sticky",
            top: 0,
            backgroundColor: colors.surface,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            Your Cart
          </span>
          <button
            onClick={onClose}
            aria-label="Close cart"
            style={{
              minWidth: touchTarget.minSize,
              minHeight: touchTarget.minSize,
              background: "none",
              border: "none",
              fontSize: typography.fontSize.xl,
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: spacing.md, flex: 1 }}>
          {cart.items.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: colors.textSecondary,
                fontSize: typography.fontSize.md,
                padding: `${spacing.xl} 0`,
              }}
            >
              Your cart is empty
            </p>
          ) : (
            <>
              {cart.items.map((item) => {
                const custKey = customizationKey(item.selectedCustomizations);
                const customizationLabels = item.customizationLabels?.join(", ") ?? "";
                const linePrice = item.unitPrice * item.quantity;

                return (
                  <div
                    key={`${item.menuItemId}-${custKey}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: spacing.xs,
                      paddingBottom: spacing.md,
                      marginBottom: spacing.md,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Name + remove */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span
                        style={{
                          fontSize: typography.fontSize.md,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                          flex: 1,
                        }}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => removeItem(item.menuItemId, custKey)}
                        aria-label={`Remove ${item.name}`}
                        style={{
                          minWidth: touchTarget.minSize,
                          minHeight: touchTarget.minSize,
                          background: "none",
                          border: "none",
                          fontSize: typography.fontSize.lg,
                          color: colors.textSecondary,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Customizations */}
                    {customizationLabels && (
                      <span
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textSecondary,
                        }}
                      >
                        {customizationLabels}
                      </span>
                    )}

                    {/* Quantity controls + line price */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, custKey, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          style={{
                            minWidth: touchTarget.minSize,
                            minHeight: touchTarget.minSize,
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: layout.borderRadius.md,
                            fontSize: typography.fontSize.lg,
                            color: colors.textPrimary,
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
                            fontSize: typography.fontSize.md,
                            fontWeight: typography.fontWeight.medium,
                            minWidth: "24px",
                            textAlign: "center",
                          }}
                        >
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, custKey, item.quantity + 1)}
                          aria-label="Increase quantity"
                          style={{
                            minWidth: touchTarget.minSize,
                            minHeight: touchTarget.minSize,
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            borderRadius: layout.borderRadius.md,
                            fontSize: typography.fontSize.lg,
                            color: colors.textPrimary,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          +
                        </button>
                      </div>
                      <span
                        style={{
                          fontSize: typography.fontSize.md,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                        }}
                      >
                        {formatDollars(linePrice)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <CartSummary cart={cart} />

              <button
                onClick={handleCheckout}
                style={{
                  width: "100%",
                  minHeight: touchTarget.minSize,
                  marginTop: spacing.md,
                  padding: `${spacing.md} ${spacing.lg}`,
                  backgroundColor: colors.primary,
                  color: colors.surface,
                  border: "none",
                  borderRadius: layout.borderRadius.md,
                  fontSize: typography.fontSize.md,
                  fontWeight: typography.fontWeight.semibold,
                  cursor: "pointer",
                }}
              >
                Checkout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
