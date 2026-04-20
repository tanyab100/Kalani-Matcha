import { useState } from "react";
import { colors, spacing, typography, layout } from "../../../theme";
import type { CreateMenuItemBody } from "../../../types/menu";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MenuItemFormProps {
  initialValues?: Partial<CreateMenuItemBody>;
  onSubmit: (body: CreateMenuItemBody) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  category?: string;
  basePrice?: string;
}

const VALID_CATEGORIES: CreateMenuItemBody["category"][] = ["drinks", "food", "extras"];

function validate(fields: {
  name: string;
  category: string;
  basePrice: string;
}): FormErrors {
  const errors: FormErrors = {};

  if (!fields.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!fields.category) {
    errors.category = "Category is required.";
  } else if (!VALID_CATEGORIES.includes(fields.category as CreateMenuItemBody["category"])) {
    errors.category = "Category must be one of: drinks, food, extras.";
  }

  if (fields.basePrice === "" || fields.basePrice === undefined) {
    errors.basePrice = "Price is required.";
  } else {
    const parsed = Number(fields.basePrice);
    if (!Number.isInteger(parsed) || parsed < 0) {
      errors.basePrice = "Price must be a non-negative whole number (in cents).";
    }
  }

  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MenuItemForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: MenuItemFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    initialValues?.basePrice !== undefined ? String(initialValues.basePrice) : ""
  );
  const [category, setCategory] = useState<string>(initialValues?.category ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    const fieldErrors = validate({ name, category, basePrice });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        basePrice: Number(basePrice),
        category: category as CreateMenuItemBody["category"],
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

  const textareaStyle: React.CSSProperties = {
    ...inputStyle(false),
    minHeight: "80px",
    resize: "vertical",
  };

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
      {/* Name */}
      <div style={fieldGroupStyle}>
        <label htmlFor="menu-item-name" style={labelStyle}>
          Name <span style={{ color: colors.error }}>*</span>
        </label>
        <input
          id="menu-item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle(!!errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
          disabled={isSubmitting}
          placeholder="e.g. Matcha Latte"
        />
        {errors.name && (
          <span id="name-error" style={errorStyle} role="alert">
            {errors.name}
          </span>
        )}
      </div>

      {/* Description */}
      <div style={fieldGroupStyle}>
        <label htmlFor="menu-item-description" style={labelStyle}>
          Description
        </label>
        <textarea
          id="menu-item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={textareaStyle}
          disabled={isSubmitting}
          placeholder="Optional description…"
        />
      </div>

      {/* Base Price */}
      <div style={fieldGroupStyle}>
        <label htmlFor="menu-item-price" style={labelStyle}>
          Base Price (cents) <span style={{ color: colors.error }}>*</span>
        </label>
        <input
          id="menu-item-price"
          type="number"
          min={0}
          step={1}
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          style={inputStyle(!!errors.basePrice)}
          aria-describedby={errors.basePrice ? "price-error" : undefined}
          aria-invalid={!!errors.basePrice}
          disabled={isSubmitting}
          placeholder="e.g. 550"
        />
        {errors.basePrice && (
          <span id="price-error" style={errorStyle} role="alert">
            {errors.basePrice}
          </span>
        )}
      </div>

      {/* Category */}
      <div style={fieldGroupStyle}>
        <label htmlFor="menu-item-category" style={labelStyle}>
          Category <span style={{ color: colors.error }}>*</span>
        </label>
        <select
          id="menu-item-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle(!!errors.category)}
          aria-describedby={errors.category ? "category-error" : undefined}
          aria-invalid={!!errors.category}
          disabled={isSubmitting}
        >
          <option value="">Select a category…</option>
          <option value="drinks">Drinks</option>
          <option value="food">Food</option>
          <option value="extras">Extras</option>
        </select>
        {errors.category && (
          <span id="category-error" style={errorStyle} role="alert">
            {errors.category}
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
          aria-label="Save menu item"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
