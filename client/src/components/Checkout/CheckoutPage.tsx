import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartContext } from "../../context/CartContext";import { calculateTax, calculateTotal, canProceedToCheckout, formatPrice } from "../../utils/pricing";
import { TipSelector } from "./TipSelector";
import { VenmoPaymentButton, VENMO_HANDLE, buildVenmoDeepLink } from "./VenmoPaymentButton";
import { createVenmoOrder, exchangeRedirectToken } from "../../services/api";
import { colors, spacing, typography, layout } from "../../theme";
import { STORE } from "../../config/store";


/**
 * Pure function that renders the checkout summary data structure.
 * Extracted so it can be tested independently (Property 12).
 */
export function renderCheckoutSummary(cart: ReturnType<typeof useCartContext>["cart"]) {
  const subtotal = cart.subtotal;
  const tax = calculateTax(subtotal, 0.1025);
  const tip = cart.tip;
  const total = calculateTotal(subtotal, tax, tip);
  return {
    items: cart.items.map((item) => ({
      id: item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      linePrice: item.unitPrice * item.quantity,
      customizations: (item.customizationLabels ?? []).join(", "),
    })),
    subtotal,
    tax,
    tip,
    total,
  };
}

export function CheckoutPage() {
  const { cart, setTip } = useCartContext();
  const navigate = useNavigate();
  const [venmoError, setVenmoError] = useState<string | null>(null);
  const [venmoLoading, setVenmoLoading] = useState(false);
  const [venmoOrderDetails, setVenmoOrderDetails] = useState<{
    orderId: string;
    total: number;
    memo: string;
  } | null>(null);

  /**
   * Called by PaymentForm after Stripe confirms payment.
   * The webhook will have created a redirect token; we receive it via Stripe's
   * return_url or inline confirmation flow, then exchange it once for the
   * order access token and navigate to the status page.
   */
  async function handleCardPaymentSuccess(redirectToken: string) {
    try {
      const { orderId, accessToken } = await exchangeRedirectToken(redirectToken);
      navigate(`/orders/${orderId}?token=${encodeURIComponent(accessToken)}`);
    } catch {
      navigate("/menu");
    }
  }
  void handleCardPaymentSuccess; // wired to PaymentForm in task 7

  // Redirect to menu if cart is empty (Requirement 5.11)
  useEffect(() => {
    if (!canProceedToCheckout(cart)) {
      navigate("/menu", { replace: true });
    }
  }, [cart, navigate]);

  if (!canProceedToCheckout(cart)) {
    return null;
  }

  const staleItems = cart.items.filter((i) => i.hasStaleCustomization);

  const summary = renderCheckoutSummary(cart);

  return (
    <div
      style={{
        maxWidth: layout.maxWidth,
        margin: "0 auto",
        padding: spacing.md,
      }}
    >
      <h1
        style={{
          fontSize: typography.fontSize.xl,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          marginBottom: spacing.lg,
        }}
      >
        Checkout
      </h1>

      {/* Stale customization warning — blocks checkout until resolved */}
      {staleItems.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: layout.borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            fontSize: typography.fontSize.sm,
            color: "#664d03",
          }}
        >
          <strong>Some items need to be updated before checkout:</strong>
          <ul style={{ margin: `${spacing.xs} 0 0`, paddingLeft: spacing.md }}>
            {staleItems.map((item) => (
              <li key={item.menuItemId} style={{ marginBottom: spacing.xs }}>
                <strong>{item.name}</strong> — remove and re-add to choose updated options
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pickup address */}
      <section
        aria-label="Pickup location"
        style={{
          backgroundColor: colors.surfaceAlt ?? "#f5f5f5",
          border: `1px solid ${colors.border}`,
          borderRadius: layout.borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <p
          style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing.xs,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Pickup location
        </p>
        <p
          style={{
            fontSize: typography.fontSize.md,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.sm,
          }}
        >
          {STORE.address}
        </p>
        <a
          href={STORE.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.primary,
            textDecoration: "none",
            fontWeight: typography.fontWeight.medium,
          }}
        >
          Open in Maps ↗
        </a>
      </section>

      {/* Order summary */}
      <section aria-label="Order summary">
        <h2
          style={{
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}
        >
          Order Summary
        </h2>

        {summary.items.map((item) => (
          <div
            key={item.id + item.customizations}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: spacing.sm,
              paddingBottom: spacing.sm,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: typography.fontSize.md,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  display: "block",
                }}
              >
                {item.quantity}× {item.name}
              </span>
              {item.customizations && (
                <span
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textSecondary,
                  }}
                >
                  {item.customizations}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: typography.fontSize.md,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
                marginLeft: spacing.md,
              }}
            >
              {formatPrice(item.linePrice)}
            </span>
          </div>
        ))}

        {/* Totals */}
        <div style={{ marginTop: spacing.md }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            <span>Subtotal</span>
            <span data-testid="checkout-subtotal">{formatPrice(summary.subtotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            <span>Tax</span>
            <span data-testid="checkout-tax">{formatPrice(summary.tax)}</span>
          </div>
          {summary.tip > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              <span>Tip</span>
              <span data-testid="checkout-tip">{formatPrice(summary.tip)}</span>
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
            <span data-testid="checkout-total">{formatPrice(summary.total)}</span>
          </div>
        </div>
      </section>

      {/* Tip selector */}
      <TipSelector
        subtotalCents={summary.subtotal}
        tipCents={summary.tip}
        onTipChange={setTip}
      />

      {/* Venmo payment option */}
      <section aria-label="Venmo payment" style={{ marginTop: spacing.lg }}>
        <h2
          style={{
            fontSize: typography.fontSize.md,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            marginBottom: spacing.md,
          }}
        >
          Pay with Venmo
        </h2>

        {venmoError && (
          <p
            role="alert"
            style={{
              color: colors.error,
              fontSize: typography.fontSize.sm,
              marginBottom: spacing.sm,
            }}
          >
            {venmoError}
          </p>
        )}

        {venmoLoading && (
          <p
            aria-live="polite"
            style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}
          >
            Creating your order…
          </p>
        )}

        {/* Step 1: show the Pay button — clicking creates the order then shows instructions */}
        {!venmoOrderDetails && !venmoLoading && (
          <VenmoPaymentButton
            totalCents={summary.total}
            memo="Matcha Order"
            disabled={staleItems.length > 0}
            onVenmoSelected={async () => {
              setVenmoLoading(true);
              setVenmoError(null);
              try {
                const idempotencyKey =
                  sessionStorage.getItem("matcha_idempotency_key") ??
                  crypto.randomUUID();
                sessionStorage.setItem("matcha_idempotency_key", idempotencyKey);

                const { order, accessToken } = await createVenmoOrder({
                  cart: {
                    items: cart.items.map((i) => ({
                      menuItemId: i.menuItemId,
                      name: i.name,
                      quantity: i.quantity,
                      selectedCustomizations: i.selectedCustomizations,
                    })),
                    tip: cart.tip,
                  },
                  pickupSlotId: "",   // TODO: wire up TimeSlotPicker selection
                  idempotencyKey,
                });

                const memo = order.paymentReference ?? `Order ${order.id.slice(0, 8).toUpperCase()}`;
                setVenmoOrderDetails({ orderId: order.id, total: order.total, memo });
                // Navigate to order status with token in URL — survives tab close / device switch
                if (accessToken) {
                  navigate(`/orders/${order.id}?token=${encodeURIComponent(accessToken)}`);
                }
              } catch (err: unknown) {
                const msg =
                  err instanceof Error ? err.message : "Failed to create Venmo order.";
                setVenmoError(msg);
              } finally {
                setVenmoLoading(false);
              }
            }}
          />
        )}

        {/* Step 2: show payment instructions with all details the customer needs */}
        {venmoOrderDetails && (
          <div
            data-testid="venmo-instructions"
            style={{
              backgroundColor: "#e8f4ff",
              border: "1px solid #008CFF",
              borderRadius: layout.borderRadius.md,
              padding: spacing.md,
            }}
          >
            <p style={{ margin: 0, marginBottom: spacing.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Complete your Venmo payment
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              <tbody>
                <tr>
                  <td style={{ paddingBottom: spacing.xs, color: colors.textSecondary, width: "40%" }}>Amount</td>
                  <td style={{ paddingBottom: spacing.xs, fontWeight: typography.fontWeight.semibold }}>{formatPrice(venmoOrderDetails.total)}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: spacing.xs, color: colors.textSecondary }}>Venmo handle</td>
                  <td style={{ paddingBottom: spacing.xs, fontWeight: typography.fontWeight.semibold }}>@{VENMO_HANDLE}</td>
                </tr>
                <tr>
                  <td style={{ paddingBottom: spacing.xs, color: colors.textSecondary }}>Memo</td>
                  <td style={{ paddingBottom: spacing.xs, fontWeight: typography.fontWeight.semibold }}>{venmoOrderDetails.memo}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ margin: 0, marginTop: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Your order will only be confirmed after a staff member verifies your payment. Include the memo above so we can match it to your order.
            </p>
            <a
              href={buildVenmoDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                marginTop: spacing.md,
                textAlign: "center",
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor: "#008CFF",
                color: "#ffffff",
                borderRadius: layout.borderRadius.md,
                textDecoration: "none",
                fontWeight: typography.fontWeight.semibold,
                fontSize: typography.fontSize.md,
              }}
            >
              Open Venmo App
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
