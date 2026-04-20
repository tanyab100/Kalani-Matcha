import { useEffect, useState } from "react";
import { api } from "../../services/api";
import type { MenuItem } from "../../types/menu";
import { MenuItemCard } from "./MenuItemCard";
import { CustomizationModal } from "./CustomizationModal";
import { colors, spacing, typography, layout } from "../../theme";
import { useCartContext } from "../../context/CartContext";

type Category = "all" | "drinks" | "food";

const FILTER_TABS: { label: string; value: Category }[] = [
  { label: "All", value: "all" },
  { label: "Drinks", value: "drinks" },
  { label: "Food", value: "food" },
];

const CATEGORY_LABELS: Record<string, string> = {
  drinks: "Drinks",
  food: "Food",
  extras: "Extras",
};

export function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Category>("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const { addItem } = useCartContext();

  useEffect(() => {
    api
      .get<{ items: MenuItem[] }>("/menu")
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message ?? "Failed to load menu"))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(item: MenuItem) {
    setSelectedItem(item);
  }

  if (loading) {
    return (
      <div style={{ padding: spacing.xl, textAlign: "center", color: colors.textSecondary }}>
        Loading menu...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: spacing.xl, textAlign: "center", color: colors.error }}>
        {error}
      </div>
    );
  }

  const filteredItems =
    activeFilter === "all" ? items : items.filter((i) => i.category === activeFilter);

  return (
    <div style={{ paddingTop: spacing.md }}>
      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: spacing.sm,
          overflowX: "auto",
          paddingBottom: spacing.sm,
          marginBottom: spacing.md,
          scrollbarWidth: "none",
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: layout.borderRadius.full,
                border: `1px solid ${isActive ? colors.primary : colors.border}`,
                backgroundColor: isActive ? colors.primary : colors.surface,
                color: isActive ? colors.surface : colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                cursor: "pointer",
                whiteSpace: "nowrap",
                minHeight: "44px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Items list */}
      {activeFilter === "all" ? (
        <GroupedItems items={filteredItems} onSelect={handleSelect} />
      ) : (
        <ItemList items={filteredItems} onSelect={handleSelect} />
      )}

      {selectedItem && (
        <CustomizationModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={(item, selections, quantity) => {
            const resolvedOptions = item.customizations.flatMap((g) => g.options);
            const unitPrice =
              item.basePrice +
              Object.values(selections).reduce((sum, optId) => {
                const opt = resolvedOptions.find((o) => o.id === optId);
                return sum + (opt?.priceDelta ?? 0);
              }, 0);
            const customizationLabels = Object.entries(selections)
              .map(([groupId, optId]) => {
                const group = item.customizations.find((g) => g.id === groupId);
                const opt = group?.options.find((o) => o.id === optId);
                return opt?.label ?? optId;
              })
              .filter(Boolean);
            addItem({
              menuItemId: item.id,
              name: item.name,
              quantity,
              selectedCustomizations: selections,
              customizationLabels,
              unitPrice,
            });
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: typography.fontSize.sm,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
      }}
    >
      {label}
    </div>
  );
}

function ItemList({ items, onSelect }: { items: MenuItem[]; onSelect: (item: MenuItem) => void }) {
  if (items.length === 0) {
    return (
      <div style={{ color: colors.textSecondary, textAlign: "center", padding: spacing.xl }}>
        No items found.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {items.map((item) => (
        <MenuItemCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}

function GroupedItems({ items, onSelect }: { items: MenuItem[]; onSelect: (item: MenuItem) => void }) {
  const categories: Array<"drinks" | "food"> = ["drinks", "food"];

  return (
    <div>
      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat}>
            <CategoryHeader label={CATEGORY_LABELS[cat]} />
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {catItems.map((item) => (
                <MenuItemCard key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
