import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../../context/AuthContext";
import {
  listAdminItems,
  createItem,
  updateItem,
  toggleInStock,
  toggleHidden,
  toggleArchived,
  deleteItem,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  createOption,
  updateOption,
  deleteOption,
} from "../../../api/menuAdminApi";
import type { AdminMenuItem, CreateMenuItemBody } from "../../../types/menu";
import { MenuItemRow } from "./MenuItemRow";
import { MenuItemForm } from "./MenuItemForm";
import { CustomizationGroupPanel } from "./CustomizationGroupPanel";
import { colors, spacing, typography, layout } from "../../../theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "drinks" | "food" | "extras";

const CATEGORIES: Category[] = ["drinks", "food", "extras"];

function categoryLabel(cat: Category): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MenuAdminPage() {
  const { token, customer } = useAuthContext();
  const navigate = useNavigate();

  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item for CustomizationGroupPanel
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Create item modal state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!token || !customer) {
      navigate("/menu", { replace: true });
    }
  }, [token, customer, navigate]);

  // Load items on mount
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    listAdminItems()
      .then((data) => setItems(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load menu items.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUpdate = (updated: AdminMenuItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const handleCreate = async (body: CreateMenuItemBody) => {
    setCreating(true);
    try {
      const created = await createItem(body);
      setItems((prev) => [...prev, created]);
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (body: CreateMenuItemBody) => {
    if (!editingItem) return;
    setEditSubmitting(true);
    try {
      const updated = await updateItem(editingItem.id, body);
      handleUpdate(updated);
      setEditingItem(null);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRowSelect = (item: AdminMenuItem) => {
    setSelectedItemId((prev) => (prev === item.id ? null : item.id));
  };

  // ── Group items by category ──────────────────────────────────────────────────

  const grouped = CATEGORIES.reduce<Record<Category, AdminMenuItem[]>>(
    (acc, cat) => {
      acc[cat] = items.filter((it) => it.category === cat);
      return acc;
    },
    { drinks: [], food: [], extras: [] }
  );

  // ── Styles ───────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    maxWidth: "800px",
    margin: "0 auto",
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    flexWrap: "wrap",
    gap: spacing.sm,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  };

  const createButtonStyle: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.primary,
    color: colors.surface,
    border: "none",
    borderRadius: layout.borderRadius.sm,
    cursor: "pointer",
    minHeight: "36px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottom: `2px solid ${colors.border}`,
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: spacing.md,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.lg,
    maxWidth: "480px",
    width: "100%",
    fontFamily: typography.fontFamily,
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  };

  const expandButtonStyle: React.CSSProperties = {
    padding: "4px 10px",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    background: colors.background,
    color: colors.primary,
    border: `1px solid ${colors.primary}`,
    borderRadius: layout.borderRadius.sm,
    cursor: "pointer",
    marginLeft: spacing.sm,
    minHeight: "28px",
  };

  // ── Early returns ────────────────────────────────────────────────────────────

  if (!token || !customer) return null;

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          Loading menu items…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div
          role="alert"
          style={{ color: colors.error, fontSize: typography.fontSize.md }}
        >
          {error}
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {/* Page header */}
      <div style={headerStyle}>
        <div style={titleStyle}>Menu Management</div>
        <button
          style={createButtonStyle}
          onClick={() => setShowCreateForm(true)}
          aria-label="Create new menu item"
        >
          + Create Item
        </button>
      </div>

      {/* Category sections */}
      {CATEGORIES.map((cat) => (
        <section key={cat} aria-label={`${categoryLabel(cat)} category`}>
          <div style={sectionTitleStyle}>
            {categoryLabel(cat)}{" "}
            <span
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.regular,
                color: colors.textSecondary,
              }}
            >
              ({grouped[cat].length})
            </span>
          </div>

          {grouped[cat].length === 0 && (
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                marginBottom: spacing.sm,
              }}
            >
              No items in this category.
            </div>
          )}

          {grouped[cat].map((item) => (
            <div key={item.id}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.xs }}>
                <div style={{ flex: 1 }}>
                  <MenuItemRow
                    item={item}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onEdit={(it) => setEditingItem(it)}
                    toggleInStock={toggleInStock}
                    toggleHidden={toggleHidden}
                    toggleArchived={toggleArchived}
                    deleteItem={deleteItem}
                  />
                </div>
                <button
                  style={expandButtonStyle}
                  onClick={() => handleRowSelect(item)}
                  aria-expanded={selectedItemId === item.id}
                  aria-label={
                    selectedItemId === item.id
                      ? `Collapse customizations for ${item.name}`
                      : `Expand customizations for ${item.name}`
                  }
                >
                  {selectedItemId === item.id ? "▲" : "▼"}
                </button>
              </div>

              {selectedItemId === item.id && (
                <CustomizationGroupPanel
                  itemId={item.id}
                  api={{
                    listGroups,
                    createGroup,
                    updateGroup,
                    deleteGroup,
                    createOption,
                    updateOption,
                    deleteOption,
                  }}
                />
              )}
            </div>
          ))}
        </section>
      ))}

      {/* Create item modal */}
      {showCreateForm && (
        <div
          style={modalOverlayStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-item-title"
        >
          <div style={modalStyle}>
            <div id="create-item-title" style={modalTitleStyle}>
              Create Menu Item
            </div>
            <MenuItemForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              isSubmitting={creating}
            />
          </div>
        </div>
      )}

      {/* Edit item modal */}
      {editingItem && (
        <div
          style={modalOverlayStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-item-title"
        >
          <div style={modalStyle}>
            <div id="edit-item-title" style={modalTitleStyle}>
              Edit Menu Item
            </div>
            <MenuItemForm
              initialValues={{
                name: editingItem.name,
                description: editingItem.description,
                basePrice: editingItem.basePrice,
                category: editingItem.category,
              }}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditingItem(null)}
              isSubmitting={editSubmitting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
