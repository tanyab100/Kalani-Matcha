import { colors, spacing, typography, layout } from "../../../theme";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeleteConfirmDialog({
  isOpen,
  itemName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  // ── Styles ──────────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: spacing.md,
  };

  const dialogStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.lg,
    maxWidth: "400px",
    width: "100%",
    fontFamily: typography.fontFamily,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.lineHeight.normal,
  };

  const itemNameStyle: React.CSSProperties = {
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  };

  const actionsStyle: React.CSSProperties = {
    display: "flex",
    gap: spacing.sm,
    justifyContent: "flex-end",
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.surface,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.sm,
    cursor: isDeleting ? "not-allowed" : "pointer",
    minHeight: "36px",
    opacity: isDeleting ? 0.6 : 1,
  };

  const deleteButtonStyle: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.error,
    color: colors.surface,
    border: "none",
    borderRadius: layout.borderRadius.sm,
    cursor: isDeleting ? "not-allowed" : "pointer",
    minHeight: "36px",
    opacity: isDeleting ? 0.6 : 1,
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <div style={dialogStyle}>
        <div id="delete-dialog-title" style={titleStyle}>
          Delete Item
        </div>
        <p style={messageStyle}>
          Are you sure you want to delete{" "}
          <span style={itemNameStyle}>"{itemName}"</span>? This action cannot be undone.
        </p>
        <div style={actionsStyle}>
          <button
            style={cancelButtonStyle}
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Cancel deletion"
          >
            Cancel
          </button>
          <button
            style={deleteButtonStyle}
            onClick={onConfirm}
            disabled={isDeleting}
            aria-label={`Confirm delete ${itemName}`}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
