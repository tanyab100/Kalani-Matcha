import { useState } from "react";
import { colors, spacing, typography, layout, touchTarget } from "../../../theme";
import type { AdminMenuItem } from "../../../types/menu";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MenuItemRowProps {
  item: AdminMenuItem;
  /** Called with the updated item after a successful toggle/restore/archive */
  onUpdate: (updated: AdminMenuItem) => void;
  /** Called with the item id after a successful delete */
  onDelete: (id: string) => void;
  /** Called when the edit button is clicked */
  onEdit: (item: AdminMenuItem) => void;
  /** API function to toggle in-stock status */
  toggleInStock: (id: string, value: boolean) => Promise<AdminMenuItem>;
  /** API function to toggle hidden status */
  toggleHidden: (id: string, value: boolean) => Promise<AdminMenuItem>;
  /** API function to toggle archived status */
  toggleArchived: (id: string, value: boolean) => Promise<AdminMenuItem>;
  /** API function to delete an item */
  deleteItem: (id: string) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function categoryLabel(category: AdminMenuItem["category"]): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MenuItemRow({
  item,
  onUpdate,
  onDelete,
  onEdit,
  toggleInStock,
  toggleHidden,
  toggleArchived,
  deleteItem,
}: MenuItemRowProps) {
  const [toggling, setToggling] = useState<"inStock" | "hidden" | "archived" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Optimistic toggle handlers ─────────────────────────────────────────────

  const handleToggleInStock = async () => {
    if (toggling) return;
    const newValue = !item.inStock;
    // Optimistic update
    onUpdate({ ...item, inStock: newValue });
    setToggling("inStock");
    setError(null);
    try {
      const updated = await toggleInStock(item.id, newValue);
      onUpdate(updated);
    } catch {
      // Revert on failure
      onUpdate({ ...item, inStock: item.inStock });
      setError("Failed to update in-stock status.");
    } finally {
      setToggling(null);
    }
  };

  const handleToggleHidden = async () => {
    if (toggling) return;
    const newValue = !item.hidden;
    onUpdate({ ...item, hidden: newValue });
    setToggling("hidden");
    setError(null);
    try {
      const updated = await toggleHidden(item.id, newValue);
      onUpdate(updated);
    } catch {
      onUpdate({ ...item, hidden: item.hidden });
      setError("Failed to update hidden status.");
    } finally {
      setToggling(null);
    }
  };

  const handleToggleArchived = async () => {
    if (toggling) return;
    const newValue = !item.archived;
    onUpdate({ ...item, archived: newValue });
    setToggling("archived");
    setError(null);
    try {
      const updated = await toggleArchived(item.id, newValue);
      onUpdate(updated);
    } catch {
      onUpdate({ ...item, archived: item.archived });
      setError("Failed to update archived status.");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteItem(item.id);
      onDelete(item.id);
    } catch {
      setError("Failed to delete item.");
      setDeleting(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const isArchived = item.archived;
  const isHidden = item.hidden && !isArchived;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: isArchived
      ? colors.background
      : isHidden
        ? "#f0f0f0"
        : colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.sm,
    opacity: isArchived ? 0.65 : 1,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: isArchived ? colors.textSecondary : colors.textPrimary,
    textDecoration: isArchived ? "line-through" : "none",
    flex: "1 1 160px",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const metaStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    display: "flex",
    gap: spacing.sm,
    flexWrap: "wrap",
    alignItems: "center",
    flex: "0 0 auto",
  };

  const badgeBase: React.CSSProperties = {
    display: "inline-block",
    fontSize: typography.fontSize.xs,
    borderRadius: layout.borderRadius.full,
    padding: "2px 8px",
    fontWeight: typography.fontWeight.medium,
  };

  const archivedBadgeStyle: React.CSSProperties = {
    ...badgeBase,
    background: colors.textDisabled,
    color: colors.surface,
  };

  const hiddenBadgeStyle: React.CSSProperties = {
    ...badgeBase,
    background: colors.warning,
    color: colors.textPrimary,
  };

  const controlsStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
    flex: "0 0 auto",
  };

  const toggleBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    padding: "4px 10px",
    borderRadius: layout.borderRadius.full,
    border: "none",
    cursor: toggling ? "not-allowed" : "pointer",
    minHeight: touchTarget.minSize,
    minWidth: touchTarget.minSize,
    transition: "background 0.15s",
  };

  const inStockToggleStyle: React.CSSProperties = {
    ...toggleBase,
    background: item.inStock ? colors.success : colors.border,
    color: item.inStock ? colors.surface : colors.textPrimary,
    opacity: toggling === "inStock" ? 0.6 : 1,
  };

  const hiddenToggleStyle: React.CSSProperties = {
    ...toggleBase,
    background: item.hidden ? colors.warning : colors.border,
    color: item.hidden ? colors.textPrimary : colors.textPrimary,
    opacity: toggling === "hidden" ? 0.6 : 1,
  };

  const actionButtonBase: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    padding: "4px 10px",
    borderRadius: layout.borderRadius.sm,
    border: `1px solid ${colors.border}`,
    cursor: "pointer",
    minHeight: touchTarget.minSize,
    background: colors.surface,
    color: colors.textPrimary,
  };

  const archiveButtonStyle: React.CSSProperties = {
    ...actionButtonBase,
    opacity: toggling === "archived" ? 0.6 : 1,
    cursor: toggling === "archived" ? "not-allowed" : "pointer",
  };

  const editButtonStyle: React.CSSProperties = {
    ...actionButtonBase,
    background: colors.primary,
    color: colors.surface,
    border: "none",
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...actionButtonBase,
    background: colors.error,
    color: colors.surface,
    border: "none",
    opacity: deleting ? 0.6 : 1,
    cursor: deleting ? "not-allowed" : "pointer",
  };

  return (
    <div style={rowStyle} aria-label={`Menu item: ${item.name}`}>
      {/* Name */}
      <span style={nameStyle} title={item.name}>
        {item.name}
      </span>

      {/* Meta: category, price, status badges */}
      <span style={metaStyle}>
        <span>{categoryLabel(item.category)}</span>
        <span>{formatPrice(item.basePrice)}</span>
        {isArchived && <span style={archivedBadgeStyle}>Archived</span>}
        {isHidden && <span style={hiddenBadgeStyle}>Hidden</span>}
      </span>

      {/* Controls */}
      <div style={controlsStyle}>
        {/* In-stock toggle — always visible */}
        <button
          style={inStockToggleStyle}
          onClick={handleToggleInStock}
          disabled={!!toggling}
          aria-pressed={item.inStock}
          aria-label={item.inStock ? "Mark out of stock" : "Mark in stock"}
          title={item.inStock ? "In stock — click to mark out of stock" : "Out of stock — click to mark in stock"}
        >
          {item.inStock ? "In Stock" : "Out of Stock"}
        </button>

        {/* Hide/unhide toggle — only for non-archived items (Req 5.1) */}
        {!isArchived && (
          <button
            style={hiddenToggleStyle}
            onClick={handleToggleHidden}
            disabled={!!toggling}
            aria-pressed={item.hidden}
            aria-label={item.hidden ? "Unhide item" : "Hide item"}
            title={item.hidden ? "Hidden — click to unhide" : "Visible — click to hide"}
          >
            {item.hidden ? "Unhide" : "Hide"}
          </button>
        )}

        {/* Archive / Restore (Req 6.1, 6.4) */}
        <button
          style={archiveButtonStyle}
          onClick={handleToggleArchived}
          disabled={!!toggling}
          aria-label={isArchived ? "Restore item" : "Archive item"}
          title={isArchived ? "Restore this item" : "Archive this item"}
        >
          {isArchived ? "Restore" : "Archive"}
        </button>

        {/* Edit button (Req 3.1) */}
        <button
          style={editButtonStyle}
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.name}`}
        >
          Edit
        </button>

        {/* Delete button (Req 7.1) */}
        <button
          style={deleteButtonStyle}
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete ${item.name}`}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {/* Inline error */}
      {error && (
        <div
          role="alert"
          style={{
            width: "100%",
            fontSize: typography.fontSize.xs,
            color: colors.error,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
