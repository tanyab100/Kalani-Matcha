import { STORE } from "../../config/store";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";

/**
 * "Get Directions" button — opens Google Maps (app on mobile, browser on desktop).
 * Used on OrderConfirmation and OrderStatusPage.
 */
export function GetDirectionsButton() {
  return (
    <div style={{ marginTop: spacing.md }}>
      <p
        style={{
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
          margin: 0,
          marginBottom: spacing.xs,
        }}
      >
        Pickup at: {STORE.address}
      </p>
      <button
        onClick={() => window.open(STORE.mapsUrl, "_blank", "noopener,noreferrer")}
        style={{
          minHeight: touchTarget.minSize,
          padding: `${spacing.sm} ${spacing.md}`,
          backgroundColor: colors.surface,
          color: colors.primary,
          border: `1px solid ${colors.primary}`,
          borderRadius: layout.borderRadius.md,
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.medium,
          cursor: "pointer",
          width: "100%",
        }}
      >
        Get Directions ↗
      </button>
    </div>
  );
}
