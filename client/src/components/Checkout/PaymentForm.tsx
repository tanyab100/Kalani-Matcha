import { useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "../../services/payment";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";

// ── Types ────────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError?: (error: string) => void;
}

// ── Inner form (must be inside <Elements>) ───────────────────────────────────

function PaymentFormInner({
  onSuccess,
  onError,
}: Omit<PaymentFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't loaded yet
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL is required by Stripe but we handle success inline
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        // Descriptive error from Stripe — cart is NOT cleared (Req 6.3)
        const message =
          error.message ?? "Payment failed. Please try again.";
        setErrorMessage(message);
        onError?.(message);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent.id);
      } else {
        // Unexpected state
        const message = "Payment could not be completed. Please try again.";
        setErrorMessage(message);
        onError?.(message);
      }
    } catch (err: unknown) {
      // Network timeout or unexpected error — cart preserved (Req 6.3)
      const message =
        err instanceof Error && err.message
          ? err.message
          : "A network error occurred. Please check your connection and try again.";
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Payment form">
      {/* Stripe hosted card fields (Req 6.4) */}
      <div style={{ marginBottom: spacing.md }}>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Descriptive error message (Req 6.3) */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            backgroundColor: "#fff5f5",
            border: `1px solid ${colors.error}`,
            borderRadius: layout.borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.md,
            color: colors.error,
            fontSize: typography.fontSize.sm,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Submit button with loading state (Req 6.2) */}
      <button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        aria-busy={isLoading}
        style={{
          width: "100%",
          minHeight: touchTarget.minSize,
          backgroundColor:
            !stripe || !elements || isLoading
              ? colors.textDisabled
              : colors.primary,
          color: colors.surface,
          border: "none",
          borderRadius: layout.borderRadius.md,
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.semibold,
          cursor:
            !stripe || !elements || isLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          transition: "background-color 0.2s ease",
        }}
      >
        {/* Loading spinner (Req 6.2) */}
        {isLoading && (
          <span
            role="status"
            aria-label="Processing payment"
            style={{
              display: "inline-block",
              width: "16px",
              height: "16px",
              border: `2px solid ${colors.surface}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        )}
        {isLoading ? "Processing…" : "Pay Now"}
      </button>

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}

// ── Public component (wraps with <Elements>) ─────────────────────────────────

const stripePromise = getStripe();

/**
 * PaymentForm wraps Stripe Elements and renders the hosted payment fields.
 *
 * - Shows a loading spinner while `stripe.confirmPayment` is in progress (Req 6.2)
 * - Displays descriptive Stripe error messages on failure (Req 6.3)
 * - Does NOT clear the cart on failure — cart preservation is the caller's
 *   responsibility; this component simply does not call clearCart (Req 6.3)
 * - Uses Stripe's hosted PaymentElement for PCI-compliant card capture (Req 6.4)
 */
export function PaymentForm({ clientSecret, onSuccess, onError }: PaymentFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: colors.primary,
            colorBackground: colors.surface,
            colorText: colors.textPrimary,
            colorDanger: colors.error,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            borderRadius: layout.borderRadius.md,
          },
        },
      }}
    >
      <PaymentFormInner onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}
