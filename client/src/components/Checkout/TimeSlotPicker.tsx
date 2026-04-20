import { useEffect, useState } from "react";
import { getPickupSlots } from "../../services/api";
import type { PickupSlot } from "../../types/menu";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";

interface TimeSlotPickerProps {
  selectedSlotId: string | null;
  onSelect: (slot: PickupSlot) => void;
  staleSlotError?: boolean;
}

function formatSlotTime(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatSlotDate(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function TimeSlotPicker({ selectedSlotId, onSelect, staleSlotError }: TimeSlotPickerProps) {
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPickupSlots()
      .then(setSlots)
      .catch((err) => setError(err.message ?? "Failed to load pickup slots"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          padding: spacing.md,
          textAlign: "center",
          color: colors.textSecondary,
          fontSize: typography.fontSize.sm,
        }}
      >
        Loading available times...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: spacing.md,
          textAlign: "center",
          color: colors.error,
          fontSize: typography.fontSize.sm,
        }}
      >
        {error}
      </div>
    );
  }

  const availableSlots = slots
    .filter((s) => s.available)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div>
      <div
        style={{
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          marginBottom: spacing.sm,
        }}
      >
        Select Pickup Time
      </div>

      {staleSlotError && (
        <div
          role="alert"
          style={{
            padding: spacing.sm,
            marginBottom: spacing.md,
            backgroundColor: "#fff3cd",
            border: `1px solid ${colors.warning}`,
            borderRadius: layout.borderRadius.md,
            color: "#856404",
            fontSize: typography.fontSize.sm,
          }}
        >
          Your previously selected time is no longer available. Please choose a new pickup time.
        </div>
      )}

      {availableSlots.length === 0 ? (
        <div
          style={{
            padding: spacing.md,
            textAlign: "center",
            color: colors.textSecondary,
            fontSize: typography.fontSize.sm,
          }}
        >
          No pickup times available right now. Please check back soon.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing.sm,
          }}
        >
          {availableSlots.map((slot) => {
            const isSelected = slot.id === selectedSlotId;
            return (
              <button
                key={slot.id}
                onClick={() => onSelect(slot)}
                aria-pressed={isSelected}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: `${spacing.sm} ${spacing.md}`,
                  minHeight: touchTarget.minSize,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  color: isSelected ? colors.surface : colors.textPrimary,
                  border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                  borderRadius: layout.borderRadius.md,
                  cursor: "pointer",
                  fontSize: typography.fontSize.md,
                  fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.regular,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <span>{formatSlotDate(slot.time)}</span>
                <span style={{ fontWeight: typography.fontWeight.medium }}>
                  {formatSlotTime(slot.time)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
