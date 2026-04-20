import { useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  email: string;
  role: "customer" | "store_admin";
}

export interface UseAuthReturn {
  customer: Customer | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN_KEY = "matcha_auth_token";
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Customer | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as Record<string, unknown>;
    // Reject expired tokens — force re-login
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    if (typeof payload.id === "string" && typeof payload.email === "string") {
      const role = payload.role === "store_admin" ? "store_admin" : "customer";
      return { id: payload.id, email: payload.email, role };
    }
    return null;
  } catch {
    return null;
  }
}

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function authRequest(
  path: string,
  email: string,
  password: string
): Promise<{ token: string; customer: Customer }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.message as string) ?? "Authentication failed");
  }

  return res.json() as Promise<{ token: string; customer: Customer }>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [customer, setCustomer] = useState<Customer | null>(() => {
    const t = loadToken();
    return t ? decodeJwtPayload(t) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const data = await authRequest("/auth/login", email, password);
    saveToken(data.token);
    setToken(data.token);
    setCustomer(data.customer ?? decodeJwtPayload(data.token));
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await authRequest("/auth/register", email, password);
    saveToken(data.token);
    setToken(data.token);
    setCustomer(data.customer ?? decodeJwtPayload(data.token));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setCustomer(null);
  }, []);

  return {
    customer,
    token,
    isAuthenticated: token !== null && customer !== null,
    login,
    register,
    logout,
  };
}
