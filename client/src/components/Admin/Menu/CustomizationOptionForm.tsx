import { useState } from "react";
import { colors, spacing, typography, layout } from "../../../theme";
import type { CreateOptionBody } from "../../../types/menu";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CustomizationOptionFormProps {
  initialValues?: Partial<CreateOptionBody>;
  onSubmit: (body: CreateOptionBody) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

interface FormErrors {
  label?: string;
  priceDelta?: string;
  sortOrder?: string;
}

function validate(fields: { label: string; priceDelta: string; sortOrder: string }): FormErrors {
  const errors: FormErrors = {};

  if (!fields.label.trim()) {
    errors.label = "Label is required.";
  }

  if (fields.priceDelta === "") {
    errors.priceDelta = "Price delta is required.";
  } else {
    const parsed = Number(fields.priceDelta);
    if (!Number.isInteger(parsed)) {
      errors.priceDelta = "Price delta must be an integer (in cents, may be negative).";
    }
  }

  if (fields.sortOrder === "") {
    errors.sortOrder = "Sort order is required.";
  } else {
    const parsed = Number(fields.sortOrder);
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.sortOrder = "Sort order must be a non-negative integer.";
    }
  }

  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomizationOptionForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CustomizationOptionFormProps) {
  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [priceDelta, setPriceDelta] = useState(
    initialValues?.priceDelta !== undefined ? String(initialValues.priceDelta) : "0"
  );
  const [sortOrder, setSortOrder] = useState(
    initialValues?.sortOrder !== undefined ? String(initialValues.sortOrder) : "0"
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate({ label, priceDelta, sortOrder });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        label: label.trim(),
        priceDelta: Number(priceDelta),
        sortOrder: Number(sortOrder),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred. Please try again.";
      setApiError(msg);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const formStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    display: "flex",
    flexDirection: "column",
    gap: spacing.md,
  };

  const fieldGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: spacing.xs,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    padding: "8px 10px",
    fontSize: typography.fontSize.sm,
    border: `1px solid ${hasError ? colors.error : colors.border}`,
    borderRadius: layout.borderRadius.sm,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    minHeight: "36px",
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  });

  const errorStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.error,
  };

  const actionsStyle: React.CSSProperties = {
    display: "flex",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.xs,
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.surface,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.sm,
    cursor: isSubmitting ? "not-allowed" : "pointer",
    minHeight: "36px",
    opacity: isSubmitting ? 0.6 : 1,
  };

  const submitButtonStyle: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.primary,
    color: colors.surface,
    border: "none",
    borderRadius: layout.borderRadius.sm,
    cursor: isSubmitting ? "not-allowed" : "pointer",
    minHeight: "36px",
    opacity: isSubmitting ? 0.6 : 1,
  };

  const apiErrorStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: "#fff5f5",
    border: `1px solid ${colors.error}`,
    borderRadius: layout.borderRadius.sm,
  };

  return (
    <form style={formStyle} onSubmit={handleSubmit} noValidate>
      {/* Label */}
      <div style={fieldGroupStyle}>
        <label htmlFor="option-label" style={labelStyle}>
          Label <span style={{ color: colors.error }}>*</span>
        </label>
        <input
          id="option-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={inputStyle(!!errors.label)}
          aria-describedby={errors.label ? "option-label-error" : undefined}
          aria-invalid={!!errors.label}
          disabled={isSubmitting}
          placeholder="e.g. Oat Milk"
        />
        {errors.label && (
          <span id="option-label-error" style={errorStyle} role="alert">
            {errors.label}
          </span>
        )}
      </div>

      {/* Price Delta */}
      <div style={fieldGroupStyle}>
        <label htmlFor="option-price-delta" style={labelStyle}>
          Price Delta (cents)
        </label>
        <input
          id="option-price-delta"
          type="number"
          step={1}
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
          style={inputStyle(!!errors.priceDelta)}
          aria-describedby={errors.priceDelta ? "option-price-delta-error" : undefined}
          aria-invalid={!!errors.priceDelta}
          disabled={isSubmitting}
          placeholder="e.g. 50 or -25"
        />
        {errors.priceDelta && (
          <span id="option-price-delta-error" style={errorStyle} role="alert">
            {errors.priceDelta}
          </span>
        )}
      </div>

      {/* Sort Order */}
      <div style={fieldGroupStyle}>
        <label htmlFor="option-sort-order" style={labelStyle}>
          Sort Order <span style={{ color: colors.error }}>*</span>
        </label>
        <input
          id="option-sort-order"
          type="number"
          min={0}
          step={1}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={inputStyle(!!errors.sortOrder)}
          aria-describedby={errors.sortOrder ? "option-sort-order-error" : undefined}
          aria-invalid={!!errors.sortOrder}
          disabled={isSubmitting}
        />
        {errors.sortOrder && (
          <span id="option-sort-order-error" style={errorStyle} role="alert">
            {errors.sortOrder}
          </span>
        )}
      </div>

      {/* API error */}
      {apiError && (
        <div style={apiErrorStyle} role="alert">
          {apiError}
        </div>
      )}

      {/* Actions */}
      <div style={actionsStyle}>
        <button
          type="button"
          style={cancelButtonStyle}
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          style={submitButtonStyle}
          disabled={isSubmitting}
          aria-label="Save option"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
