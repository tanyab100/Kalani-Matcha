// Shared design tokens for the matcha ordering app
// Mobile-first, optimized for 390px screens (Requirement 9.1)

export const colors = {
  // Brand
  primary: "#2d6a4f",
  primaryLight: "#52b788",
  primaryDark: "#1b4332",
  accent: "#95d5b2",

  // Neutrals
  background: "#f8f9fa",
  surface: "#ffffff",
  border: "#dee2e6",
  textPrimary: "#212529",
  textSecondary: "#6c757d",
  textDisabled: "#adb5bd",

  // Feedback
  error: "#dc3545",
  success: "#198754",
  warning: "#ffc107",
  info: "#0dcaf0",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
} as const;

export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    xxl: "24px",
    display: "32px",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const breakpoints = {
  // Mobile-first: base styles target 390px
  mobile: "390px",
  tablet: "768px",
  desktop: "1024px",
} as const;

// Minimum touch target size per Requirement 9.1
export const touchTarget = {
  minSize: "44px",
} as const;

export const layout = {
  maxWidth: "480px",
  contentPadding: spacing.md,
  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px",
  },
} as const;
