import { useEffect, useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { api, ApiError } from "../../services/api";
import { colors, spacing, typography, layout } from "../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSlot {
  id: string;
  slot_time: string;
  capacity: number;
  used_capacity: number;
  available: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPast(slotTime: string): boolean {
  return new Date(slotTime).getTime() < Date.now();
}

function formatSlotTime(slotTime: string): string {
  return new Date(slotTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlotCapacityPage() {
  const { token } = useAuthContext();
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Map of slotId -> draft capacity string (for inline editing)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Map of slotId -> save status
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;

    api
      .get<{ slots: AdminSlot[] }>("/admin/pickup-slots", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((data) => {
        setSlots(data.slots);
        // Initialise drafts with current capacity values
        const initial: Record<string, string> = {};
        data.slots.forEach((s) => {
          initial[s.id] = String(s.capacity);
        });
        setDrafts(initial);
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          setError("Failed to load pickup slots.");
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (slot: AdminSlot) => {
    const newCapacity = parseInt(drafts[slot.id] ?? "", 10);
    if (isNaN(newCapacity) || newCapacity < 0) {
      setSaveError((prev) => ({ ...prev, [slot.id]: "Capacity must be a non-negative number." }));
      return;
    }

    setSaving((prev) => ({ ...prev, [slot.id]: true }));
    setSaveError((prev) => ({ ...prev, [slot.id]: "" }));
    setSaveSuccess((prev) => ({ ...prev, [slot.id]: false }));

    try {
      await api.patch(
        `/admin/pickup-slots/${slot.id}/capacity`,
        { capacity: newCapacity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, capacity: newCapacity } : s))
      );
      setSaveSuccess((prev) => ({ ...prev, [slot.id]: true }));
      setTimeout(() => setSaveSuccess((prev) => ({ ...prev, [slot.id]: false })), 2000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed.";
      setSaveError((prev) => ({ ...prev, [slot.id]: msg }));
    } finally {
      setSaving((prev) => ({ ...prev, [slot.id]: false }));
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    maxWidth: layout.maxWidth,
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  };

  const slotTimeStyle: React.CSSProperties = {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  };

  const metaRowStyle: React.CSSProperties = {
    display: "flex",
    gap: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginRight: spacing.xs,
  };

  const inputStyle: React.CSSProperties = {
    width: "72px",
    padding: "6px 10px",
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.sm,
    fontSize: typography.fontSize.sm,
    outline: "none",
    minHeight: "36px",
  };

  const saveButtonStyle: React.CSSProperties = {
    marginLeft: spacing.sm,
    padding: "6px 14px",
    background: colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: layout.borderRadius.sm,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: "pointer",
    minHeight: "36px",
  };

  const pastBadgeStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.full,
    padding: "2px 8px",
    marginLeft: spacing.sm,
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          Loading slots…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ color: colors.error, fontSize: typography.fontSize.md }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={titleStyle}>Pickup Slot Capacity</div>

      {slots.length === 0 && (
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          No pickup slots found.
        </div>
      )}

      {slots.map((slot) => {
        const past = isPast(slot.slot_time);
        return (
          <div key={slot.id} style={cardStyle}>
            <div style={slotTimeStyle}>
              {formatSlotTime(slot.slot_time)}
              {past && <span style={pastBadgeStyle}>Past</span>}
            </div>

            <div style={metaRowStyle}>
              <span>
                <span style={labelStyle}>Used:</span>
                {slot.used_capacity} / {slot.capacity}
              </span>
              <span>
                <span style={labelStyle}>Available:</span>
                {slot.available ? "Yes" : "No"}
              </span>
            </div>

            {past ? (
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Capacity: {slot.capacity} (read-only)
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: spacing.xs }}>
                  <label
                    htmlFor={`capacity-${slot.id}`}
                    style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
                  >
                    Capacity:
                  </label>
                  <input
                    id={`capacity-${slot.id}`}
                    type="number"
                    min={0}
                    style={inputStyle}
                    value={drafts[slot.id] ?? String(slot.capacity)}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [slot.id]: e.target.value }))
                    }
                    aria-label={`Capacity for slot at ${formatSlotTime(slot.slot_time)}`}
                  />
                  <button
                    style={{
                      ...saveButtonStyle,
                      opacity: saving[slot.id] ? 0.7 : 1,
                      cursor: saving[slot.id] ? "not-allowed" : "pointer",
                    }}
                    onClick={() => handleSave(slot)}
                    disabled={saving[slot.id]}
                    aria-label={`Save capacity for slot at ${formatSlotTime(slot.slot_time)}`}
                  >
                    {saving[slot.id] ? "Saving…" : "Save"}
                  </button>
                </div>

                {saveSuccess[slot.id] && (
                  <div style={{ color: colors.success, fontSize: typography.fontSize.xs, marginTop: spacing.xs }}>
                    Saved successfully.
                  </div>
                )}
                {saveError[slot.id] && (
                  <div style={{ color: colors.error, fontSize: typography.fontSize.xs, marginTop: spacing.xs }} role="alert">
                    {saveError[slot.id]}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
