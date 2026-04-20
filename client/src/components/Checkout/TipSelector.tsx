import { useState } from "react";
import { formatPrice } from "../../utils/pricing";
import { colors, spacing, typography, layout, touchTarget } from "../../theme";

interface TipSelectorProps {
  subtotalCents: number;
  tipCents: number;
  onTipChange: (tipCents: number) => void;
}

const PRESET_PERCENTAGES = [10, 15, 20] as const;

export function TipSelector({ subtotalCents, tipCents, onTipChange }: TipSelectorProps) {
  // Track whether the user is in custom-input mode
  const [customValue, setCustomValue] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const handlePreset = (pct: number) => {
    setIsCustom(false);
    setCustomValue("");
    const tip = Math.round(subtotalCents * (pct / 100));
    onTipChange(tip);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomValue(raw);
    const dollars = parseFloat(raw);
    if (!isNaN(dollars) && dollars >= 0) {
      onTipChange(Math.round(dollars * 100));
    } else if (raw === "" || raw === "0") {
      onTipChange(0);
    }
  };

  const handleCustomFocus = () => {
    setIsCustom(true);
  };

  const isPresetActive = (pct: number) => {
    if (isCustom) return false;
    return tipCents === Math.round(subtotalCents * (pct / 100));
  };

  return (
    <div style={{ marginTop: spacing.md }}>
      <span
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          display: "block",
          marginBottom: spacing.sm,
        }}
      >
        Add a Tip
      </span>

      {/* Preset buttons */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.sm }}>
        {PRESET_PERCENTAGES.map((pct) => (
          <button
            key={pct}
            onClick={() => handlePreset(pct)}
            aria-pressed={isPresetActive(pct)}
            style={{
              flex: 1,
              minHeight: touchTarget.minSize,
              padding: `${spacing.xs} ${spacing.sm}`,
              backgroundColor: isPresetActive(pct) ? colors.primary : colors.background,
              color: isPresetActive(pct) ? colors.surface : colors.textPrimary,
              border: `1px solid ${isPresetActive(pct) ? colors.primary : colors.border}`,
              borderRadius: layout.borderRadius.md,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: "pointer",
            }}
          >
            {pct}%
          </button>
        ))}

        {/* No tip button */}
        <button
          onClick={() => { setIsCustom(false); setCustomValue(""); onTipChange(0); }}
          aria-pressed={!isCustom && tipCents === 0}
          style={{
            flex: 1,
            minHeight: touchTarget.minSize,
            padding: `${spacing.xs} ${spacing.sm}`,
            backgroundColor: (!isCustom && tipCents === 0) ? colors.primary : colors.background,
            color: (!isCustom && tipCents === 0) ? colors.surface : colors.textPrimary,
            border: `1px solid ${(!isCustom && tipCents === 0) ? colors.primary : colors.border}`,
            borderRadius: layout.borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: "pointer",
          }}
        >
          None
        </button>
      </div>

      {/* Custom amount input */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        <span style={{ fontSize: typography.fontSize.md, color: colors.textSecondary }}>$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Custom amount"
          value={customValue}
          onFocus={handleCustomFocus}
          onChange={handleCustomChange}
          aria-label="Custom tip amount in dollars"
          style={{
            flex: 1,
            minHeight: touchTarget.minSize,
            padding: `${spacing.xs} ${spacing.sm}`,
            border: `1px solid ${isCustom ? colors.primary : colors.border}`,
            borderRadius: layout.borderRadius.md,
            fontSize: typography.fontSize.md,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            outline: "none",
          }}
        />
      </div>

      {/* Tip display */}
      {tipCents > 0 && (
        <p
          style={{
            marginTop: spacing.xs,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
          }}
        >
          Tip: {formatPrice(tipCents)}
        </p>
      )}
    </div>
  );
}
