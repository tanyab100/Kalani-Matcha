import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { layout, colors, typography, spacing } from "../theme";
import { useAuthContext } from "../context/AuthContext";
import { useCartContext } from "../context/CartContext";
import { CartDrawer } from "./Cart/CartDrawer";

interface LayoutProps {
  children: ReactNode;
}

// Mobile-first single-column layout wrapper (Requirement 9.1)
export function Layout({ children }: LayoutProps) {
  const { customer } = useAuthContext();
  const isAdmin = customer?.role === "store_admin";
  const { cart } = useCartContext();
  const [cartOpen, setCartOpen] = useState(false);

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: colors.background,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
      }}
    >
      {/* app-container enforces single-column at ≤390px via CSS (Requirement 9.1) */}
      <div
        className="app-container"
        style={{
          maxWidth: layout.maxWidth,
          margin: "0 auto",
          padding: `0 ${layout.contentPadding}`,
          paddingBottom: spacing.xxl,
        }}
      >
        <nav
          aria-label="Site navigation"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${spacing.sm} 0`,
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: spacing.md,
            fontSize: typography.fontSize.sm,
          }}
        >
          {/* Left: admin links (only for admins) */}
          <div style={{ display: "flex", gap: spacing.md }}>
            {isAdmin && (
              <>
                <Link to="/admin/slots" style={{ color: colors.primary, textDecoration: "none", fontWeight: typography.fontWeight.semibold }}>
                  Slot Capacity
                </Link>
                <Link to="/admin/menu" style={{ color: colors.primary, textDecoration: "none", fontWeight: typography.fontWeight.semibold }}>
                  Menu
                </Link>
                <Link to="/admin/orders" style={{ color: colors.primary, textDecoration: "none", fontWeight: typography.fontWeight.semibold }}>
                  Orders
                </Link>
              </>
            )}
          </div>

          {/* Right: cart icon */}
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
            style={{
              position: "relative",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.textPrimary,
              fontSize: "22px",
              lineHeight: 1,
            }}
          >
            🛒
            {totalItems > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-4px",
                  backgroundColor: colors.primary,
                  color: colors.surface,
                  fontSize: typography.fontSize.xs,
                  fontWeight: typography.fontWeight.bold,
                  borderRadius: "999px",
                  minWidth: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                {totalItems}
              </span>
            )}
          </button>
        </nav>

        <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        {children}
      </div>
    </div>
  );
}
