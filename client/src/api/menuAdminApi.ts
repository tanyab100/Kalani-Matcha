/**
 * Admin menu API client.
 * All requests are authenticated via Bearer JWT stored in localStorage.
 * Requirements: 1.4, 2.3, 3.3, 4.4, 5.5, 6.5, 7.4
 */

import type {
  AdminMenuItem,
  AdminCustomizationGroup,
  AdminCustomizationOption,
  CreateMenuItemBody,
  UpdateMenuItemBody,
  CreateGroupBody,
  CreateOptionBody,
} from "../types/menu";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "matcha_auth_token";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body.error && typeof body.error === "object" ? body.error.message : body.message) ??
      res.statusText;
    throw new Error(message);
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Menu Items ────────────────────────────────────────────────────────────────

export function listAdminItems(): Promise<AdminMenuItem[]> {
  return adminRequest<AdminMenuItem[]>("/admin/menu/items");
}

export function createItem(body: CreateMenuItemBody): Promise<AdminMenuItem> {
  return adminRequest<AdminMenuItem>("/admin/menu/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateItem(id: string, body: UpdateMenuItemBody): Promise<AdminMenuItem> {
  return adminRequest<AdminMenuItem>(`/admin/menu/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function toggleInStock(id: string, value: boolean): Promise<AdminMenuItem> {
  return adminRequest<AdminMenuItem>(`/admin/menu/items/${id}/in-stock`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

export function toggleHidden(id: string, value: boolean): Promise<AdminMenuItem> {
  return adminRequest<AdminMenuItem>(`/admin/menu/items/${id}/hidden`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

export function toggleArchived(id: string, value: boolean): Promise<AdminMenuItem> {
  return adminRequest<AdminMenuItem>(`/admin/menu/items/${id}/archived`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

export function deleteItem(id: string): Promise<void> {
  return adminRequest<void>(`/admin/menu/items/${id}`, { method: "DELETE" });
}

// ── Customization Groups ──────────────────────────────────────────────────────

export function listGroups(itemId: string): Promise<AdminCustomizationGroup[]> {
  return adminRequest<AdminCustomizationGroup[]>(`/admin/menu/items/${itemId}/groups`);
}

export function createGroup(itemId: string, body: CreateGroupBody): Promise<AdminCustomizationGroup> {
  return adminRequest<AdminCustomizationGroup>(`/admin/menu/items/${itemId}/groups`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateGroup(
  id: string,
  body: Partial<CreateGroupBody>
): Promise<AdminCustomizationGroup> {
  return adminRequest<AdminCustomizationGroup>(`/admin/menu/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteGroup(id: string): Promise<void> {
  return adminRequest<void>(`/admin/menu/groups/${id}`, { method: "DELETE" });
}

// ── Customization Options ─────────────────────────────────────────────────────

export function createOption(
  groupId: string,
  body: CreateOptionBody
): Promise<AdminCustomizationOption> {
  return adminRequest<AdminCustomizationOption>(`/admin/menu/groups/${groupId}/options`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateOption(
  id: string,
  body: Partial<CreateOptionBody>
): Promise<AdminCustomizationOption> {
  return adminRequest<AdminCustomizationOption>(`/admin/menu/options/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteOption(id: string): Promise<void> {
  return adminRequest<void>(`/admin/menu/options/${id}`, { method: "DELETE" });
}
