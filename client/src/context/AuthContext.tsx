import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type UseAuthReturn } from "../hooks/useAuth";

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<UseAuthReturn | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useAuthContext(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
