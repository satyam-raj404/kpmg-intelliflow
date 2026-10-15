// src/lib/brand.ts — SINGLE SOURCE OF TRUTH for KPMG branding
// The KPMG team will replace values in this file with licensed assets.

export const brand = {
  // Colors — official KPMG palette
  colors: {
    primary: "#00338D", // KPMG Blue (primary)
    primaryDark: "#002060", // KPMG Dark Blue (headers, footers)
    accent: "#009FDA", // KPMG Cyan (accents, hover states)
    teal: "#00A3A1", // KPMG Teal
    purple: "#470A68", // KPMG Purple
    success: "#009A44",
    warning: "#F5A623",
    danger: "#D0021B",
    neutral: {
      50: "#F5F5F5",
      100: "#E8E8E8",
      200: "#D1D1D1",
      500: "#757575",
      700: "#333333",
      900: "#1A1A1A",
    },
  },

  // Typography — Placeholder fonts. KPMG team will swap for licensed KPMG fonts.
  // KPMG's official stack is: "Arial" (body) + "KPMG Slab" (headings, proprietary)
  // For Lovable build, use Source Sans Pro + Georgia from Google Fonts as approximations.
  fonts: {
    heading: '"Georgia", "KPMG Slab", serif',
    body: '"Source Sans Pro", "Arial", "Helvetica", sans-serif',
    mono: '"JetBrains Mono", "Consolas", monospace',
  },

// Logo — official KPMG mark, supplied as WebP in /public.
  //   kpmg-logo.webp        navy mark, for light backgrounds
  //   kpmg-logo-white.webp  white mark (transparent bg), for the navy
  //                        sidebar and the login/signup panels
  // `aspect` is only a max-width guard so a mis-proportioned file cannot blow
  // out the sidebar layout; the mark is sized by height, so the two files do
  // not need identical dimensions.
  logo: {
    path: "/kpmg-logo.webp",
    pathWhite: "/kpmg-logo-white.webp",
    aspect: 2.8,
  },
} as const;

// Chart palette derived from brand colors — used by Recharts
export const chartPalette = [
  brand.colors.primary,
  brand.colors.accent,
  brand.colors.teal,
  brand.colors.purple,
  brand.colors.warning,
  brand.colors.success,
  brand.colors.danger,
  "#5B6BC0",
];

// Status color helpers
export const statusColor = {
  healthy: brand.colors.success,
  warning: brand.colors.warning,
  critical: brand.colors.danger,
  neutral: brand.colors.primary,
  info: brand.colors.accent,
} as const;
