import { useState, useEffect, useCallback } from "react";
import { colors, spacing, typography, layout } from "../../../theme";
import type {
  AdminCustomizationGroup,
  AdminCustomizationOption,
  CreateGroupBody,
  CreateOptionBody,
} from "../../../types/menu";
import { CustomizationGroupForm } from "./CustomizationGroupForm";
import { CustomizationOptionForm } from "./CustomizationOptionForm";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CustomizationGroupPanelApi {
  listGroups: (itemId: string) => Promise<AdminCustomizationGroup[]>;
  createGroup: (itemId: string, body: CreateGroupBody) => Promise<AdminCustomizationGroup>;
  updateGroup: (id: string, body: Partial<CreateGroupBody>) => Promise<AdminCustomizationGroup>;
  deleteGroup: (id: string) => Promise<void>;
  createOption: (groupId: string, body: CreateOptionBody) => Promise<AdminCustomizationOption>;
  updateOption: (id: string, body: Partial<CreateOptionBody>) => Promise<AdminCustomizationOption>;
  deleteOption: (id: string) => Promise<void>;
}

export interface CustomizationGroupPanelProps {
  itemId: string;
  api: CustomizationGroupPanelApi;
}

// ── Inline form state ─────────────────────────────────────────────────────────

type GroupFormState =
  | { type: "add" }
  | { type: "edit"; group: AdminCustomizationGroup };

type OptionFormState =
  | { type: "add"; groupId: string }
  | { type: "edit"; groupId: string; option: AdminCustomizationOption };

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomizationGroupPanel({ itemId, api }: CustomizationGroupPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [groups, setGroups] = useState<AdminCustomizationGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groupForm, setGroupForm] = useState<GroupFormState | null>(null);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const [optionForm, setOptionForm] = useState<OptionFormState | null>(null);
  const [optionSubmitting, setOptionSubmitting] = useState(false);

  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);

  // Load groups on mount
  const loadGroups = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.listGroups(itemId);
      setGroups([...data].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load customization groups.");
    } finally {
      setLoading(false);
    }
  }, [api, itemId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // ── Group handlers ──────────────────────────────────────────────────────────

  const handleAddGroup = async (body: CreateGroupBody) => {
    setGroupSubmitting(true);
    try {
      const created = await api.createGroup(itemId, body);
      setGroups((prev) =>
        [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setGroupForm(null);
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleEditGroup = async (id: string, body: CreateGroupBody) => {
    setGroupSubmitting(true);
    try {
      const updated = await api.updateGroup(id, body);
      setGroups((prev) =>
        prev.map((g) => (g.id === id ? updated : g)).sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setGroupForm(null);
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group: AdminCustomizationGroup) => {
    if (!window.confirm(`Delete group "${group.label}"? This cannot be undone.`)) return;
    setDeletingGroupId(group.id);
    try {
      await api.deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete group.");
    } finally {
      setDeletingGroupId(null);
    }
  };

  // ── Option handlers ─────────────────────────────────────────────────────────

  const handleAddOption = async (groupId: string, body: CreateOptionBody) => {
    setOptionSubmitting(true);
    try {
      const created = await api.createOption(groupId, body);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                options: [...g.options, created].sort((a, b) => a.sortOrder - b.sortOrder),
              }
            : g
        )
      );
      setOptionForm(null);
    } finally {
      setOptionSubmitting(false);
    }
  };

  const handleEditOption = async (
    groupId: string,
    optionId: string,
    body: CreateOptionBody
  ) => {
    setOptionSubmitting(true);
    try {
      const updated = await api.updateOption(optionId, body);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                options: g.options
                  .map((o) => (o.id === optionId ? updated : o))
                  .sort((a, b) => a.sortOrder - b.sortOrder),
              }
            : g
        )
      );
      setOptionForm(null);
    } finally {
      setOptionSubmitting(false);
    }
  };

  const handleDeleteOption = async (groupId: string, option: AdminCustomizationOption) => {
    if (!window.confirm(`Delete option "${option.label}"? This cannot be undone.`)) return;
    setDeletingOptionId(option.id);
    try {
      await api.deleteOption(option.id);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, options: g.options.filter((o) => o.id !== option.id) }
            : g
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete option.");
    } finally {
      setDeletingOptionId(null);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    fontFamily: typography.fontFamily,
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.md,
    overflow: "hidden",
    marginTop: spacing.sm,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: colors.background,
    cursor: "pointer",
    userSelect: "none",
    borderBottom: expanded ? `1px solid ${colors.border}` : "none",
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  };

  const chevronStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform 0.15s ease",
  };

  const bodyStyle: React.CSSProperties = {
    padding: spacing.md,
    display: "flex",
    flexDirection: "column",
    gap: spacing.md,
  };

  const groupCardStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  };

  const groupHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  };

  const groupLabelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  };

  const groupMetaStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  };

  const groupActionsStyle: React.CSSProperties = {
    display: "flex",
    gap: spacing.xs,
  };

  const optionRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: layout.borderRadius.sm,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  };

  const optionLabelStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  };

  const optionMetaStyle: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  };

  const iconButtonStyle = (danger = false, disabled = false): React.CSSProperties => ({
    padding: "4px 8px",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    background: "transparent",
    color: danger ? colors.error : colors.primary,
    border: `1px solid ${danger ? colors.error : colors.primary}`,
    borderRadius: layout.borderRadius.sm,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    minHeight: "28px",
  });

  const addButtonStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.primary,
    color: colors.surface,
    border: "none",
    borderRadius: layout.borderRadius.sm,
    cursor: "pointer",
    minHeight: "32px",
    alignSelf: "flex-start",
  };

  const inlineFormWrapperStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: layout.borderRadius.sm,
    padding: spacing.md,
    backgroundColor: "#f0f7f4",
  };

  const errorStyle: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: "#fff5f5",
    border: `1px solid ${colors.error}`,
    borderRadius: layout.borderRadius.sm,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={panelStyle}>
      {/* Panel header — toggles expand */}
      <div
        style={headerStyle}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
        }}
      >
        <span style={headerTitleStyle}>Customization Groups</span>
        <span style={chevronStyle} aria-hidden="true">▼</span>
      </div>

      {expanded && (
        <div style={bodyStyle}>
          {loading && (
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Loading…
            </span>
          )}

          {loadError && (
            <div style={errorStyle} role="alert">
              {loadError}
            </div>
          )}

          {!loading && !loadError && groups.length === 0 && (
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              No customization groups yet.
            </span>
          )}

          {/* Group list */}
          {groups.map((group) => (
            <div key={group.id} style={groupCardStyle}>
              <div style={groupHeaderStyle}>
                <span style={groupLabelStyle}>{group.label}</span>
                <div style={groupActionsStyle}>
                  <button
                    style={iconButtonStyle(false, groupSubmitting)}
                    onClick={() => {
                      setGroupForm({ type: "edit", group });
                      setOptionForm(null);
                    }}
                    disabled={groupSubmitting || deletingGroupId === group.id}
                    aria-label={`Edit group ${group.label}`}
                  >
                    Edit
                  </button>
                  <button
                    style={iconButtonStyle(true, deletingGroupId === group.id)}
                    onClick={() => handleDeleteGroup(group)}
                    disabled={deletingGroupId === group.id || groupSubmitting}
                    aria-label={`Delete group ${group.label}`}
                  >
                    {deletingGroupId === group.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              <div style={groupMetaStyle}>
                {group.required ? "Required" : "Optional"} · Sort: {group.sortOrder}
              </div>

              {/* Edit group form */}
              {groupForm?.type === "edit" && groupForm.group.id === group.id && (
                <div style={inlineFormWrapperStyle}>
                  <CustomizationGroupForm
                    initialValues={{
                      label: group.label,
                      required: group.required,
                      sortOrder: group.sortOrder,
                    }}
                    onSubmit={(body) => handleEditGroup(group.id, body)}
                    onCancel={() => setGroupForm(null)}
                    isSubmitting={groupSubmitting}
                  />
                </div>
              )}

              {/* Options */}
              {[...group.options]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((option) => (
                  <div key={option.id}>
                    <div style={optionRowStyle}>
                      <div>
                        <span style={optionLabelStyle}>{option.label}</span>
                        <span style={{ ...optionMetaStyle, marginLeft: spacing.sm }}>
                          {option.priceDelta >= 0 ? `+${option.priceDelta}¢` : `${option.priceDelta}¢`}
                          {" · "}Sort: {option.sortOrder}
                        </span>
                      </div>
                      <div style={groupActionsStyle}>
                        <button
                          style={iconButtonStyle(false, optionSubmitting)}
                          onClick={() => {
                            setOptionForm({ type: "edit", groupId: group.id, option });
                            setGroupForm(null);
                          }}
                          disabled={optionSubmitting || deletingOptionId === option.id}
                          aria-label={`Edit option ${option.label}`}
                        >
                          Edit
                        </button>
                        <button
                          style={iconButtonStyle(true, deletingOptionId === option.id)}
                          onClick={() => handleDeleteOption(group.id, option)}
                          disabled={deletingOptionId === option.id || optionSubmitting}
                          aria-label={`Delete option ${option.label}`}
                        >
                          {deletingOptionId === option.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    {/* Edit option form */}
                    {optionForm?.type === "edit" &&
                      optionForm.groupId === group.id &&
                      optionForm.option.id === option.id && (
                        <div style={{ ...inlineFormWrapperStyle, marginTop: spacing.xs }}>
                          <CustomizationOptionForm
                            initialValues={{
                              label: option.label,
                              priceDelta: option.priceDelta,
                              sortOrder: option.sortOrder,
                            }}
                            onSubmit={(body) => handleEditOption(group.id, option.id, body)}
                            onCancel={() => setOptionForm(null)}
                            isSubmitting={optionSubmitting}
                          />
                        </div>
                      )}
                  </div>
                ))}

              {/* Add option form */}
              {optionForm?.type === "add" && optionForm.groupId === group.id && (
                <div style={{ ...inlineFormWrapperStyle, marginTop: spacing.xs }}>
                  <CustomizationOptionForm
                    onSubmit={(body) => handleAddOption(group.id, body)}
                    onCancel={() => setOptionForm(null)}
                    isSubmitting={optionSubmitting}
                  />
                </div>
              )}

              {/* Add option button */}
              {!(optionForm?.type === "add" && optionForm.groupId === group.id) && (
                <button
                  style={{ ...iconButtonStyle(), marginTop: spacing.xs }}
                  onClick={() => {
                    setOptionForm({ type: "add", groupId: group.id });
                    setGroupForm(null);
                  }}
                  aria-label={`Add option to group ${group.label}`}
                >
                  + Add Option
                </button>
              )}
            </div>
          ))}

          {/* Add group form */}
          {groupForm?.type === "add" && (
            <div style={inlineFormWrapperStyle}>
              <CustomizationGroupForm
                onSubmit={handleAddGroup}
                onCancel={() => setGroupForm(null)}
                isSubmitting={groupSubmitting}
              />
            </div>
          )}

          {/* Add group button */}
          {groupForm?.type !== "add" && (
            <button
              style={addButtonStyle}
              onClick={() => {
                setGroupForm({ type: "add" });
                setOptionForm(null);
              }}
              aria-label="Add customization group"
            >
              + Add Group
            </button>
          )}
        </div>
      )}
    </div>
  );
}
