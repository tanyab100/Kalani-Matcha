import { colors, spacing, typography, layout, touchTarget } from "../../theme";

export const VENMO_HANDLE = "u/Shania-Ahmed";

export const VENMO_URL = "https://venmo.com/u/Shania-Ahmed";

/**
 * Returns the plain Venmo profile URL with no pre-filled amount or memo.
 * Requirements: 6.7, 6.8
 */
export function buildVenmoDeepLink(): string {
  return VENMO_URL;
}

interface VenmoPaymentButtonProps {
  totalCents: number;
  /** Memo text to pre-fill in Venmo (e.g. "Order ABC12345"). Shown to customer. */
  memo: string;
  onVenmoSelected: () => void;
  /** When true, the button is disabled (e.g. stale customizations must be resolved first). */
  disabled?: boolean;
}

/**
 * Displays a "Pay via Venmo" button styled with Venmo's brand color.
 * When clicked, calls onVenmoSelected() then opens the Venmo deep-link.
 * Requirements: 6.7, 6.8
 */
export function VenmoPaymentButton({ totalCents, memo, onVenmoSelected, disabled = false }: VenmoPaymentButtonProps) {
  function handleClick() {
    if (disabled) return;
    onVenmoSelected();
    window.open(buildVenmoDeepLink(), "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Pay via Venmo"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        width: "100%",
        minHeight: touchTarget.minSize,
        padding: `${spacing.sm} ${spacing.md}`,
        backgroundColor: disabled ? colors.textDisabled : "#008CFF",
        color: "#ffffff",
        border: "none",
        borderRadius: layout.borderRadius.md,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: typography.fontFamily,
      }}
    >
      {/* Venmo logo mark (simplified "V") */}
      <span aria-hidden="true" style={{ fontSize: typography.fontSize.lg, lineHeight: 1 }}>
        V
      </span>
      Pay via Venmo
    </button>
  );
}
