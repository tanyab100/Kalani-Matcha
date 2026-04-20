import { useState, type FormEvent } from "react";
import { useAuthContext } from "../../context/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthModalProps {
  onSuccess: () => void;
  onGuest: () => void;
  onClose?: () => void;
}

type Tab = "signin" | "register";

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "16px",
  },
  modal: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  title: {
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "16px",
    color: "#1a1a1a",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
    borderBottom: "2px solid #e5e5e5",
  },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px",
    border: "none",
    background: "none",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    color: active ? "#2d6a4f" : "#666",
    borderBottom: active ? "2px solid #2d6a4f" : "2px solid transparent",
    marginBottom: "-2px",
    fontSize: "15px",
    minHeight: "44px",
  }),
  field: {
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    marginBottom: "4px",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box" as const,
    minHeight: "44px",
  },
  error: {
    color: "#c0392b",
    fontSize: "13px",
    marginBottom: "12px",
    padding: "8px 12px",
    background: "#fdf0ef",
    borderRadius: "6px",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px",
    background: "#2d6a4f",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
    marginBottom: "10px",
  },
  guestBtn: {
    width: "100%",
    padding: "12px",
    background: "none",
    color: "#2d6a4f",
    border: "1px solid #2d6a4f",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
    marginBottom: "8px",
  },
  divider: {
    textAlign: "center" as const,
    color: "#999",
    fontSize: "13px",
    margin: "12px 0",
  },
  closeBtn: {
    position: "absolute" as const,
    top: "12px",
    right: "16px",
    background: "none",
    border: "none",
    fontSize: "22px",
    cursor: "pointer",
    color: "#666",
    minHeight: "44px",
    minWidth: "44px",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthModal({ onSuccess, onGuest, onClose }: AuthModalProps) {
  const { login, register } = useAuthContext();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === "signin") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}>
      <div style={{ ...styles.modal, position: "relative" }}>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        )}

        <div style={styles.title}>
          {tab === "signin" ? "Sign in to your account" : "Create an account"}
        </div>

        <div style={styles.tabs}>
          <button style={styles.tab(tab === "signin")} onClick={() => { setTab("signin"); setError(null); }}>
            Sign In
          </button>
          <button style={styles.tab(tab === "register")} onClick={() => { setTab("register"); setError(null); }}>
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && <div style={styles.error} role="alert">{error}</div>}

          <div style={styles.field}>
            <label style={styles.label} htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              style={styles.input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              style={styles.input}
              type="password"
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button style={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div style={styles.divider}>or</div>

        <button style={styles.guestBtn} onClick={onGuest}>
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
