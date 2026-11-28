import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Semantic status colors — deliberately separate from the brand
        // `primary` accent so state (live / completed) never competes
        // visually with an actionable button. See docs/05-ui-mockups.md.
        track: "var(--track)",
        "primary-soft": "var(--primary-soft)",
        "primary-ink": "var(--primary-ink)",
        status: {
          live: "var(--status-live)",
          "live-fill": "var(--status-live-fill)",
          "live-bg": "var(--status-live-bg)",
          break: "var(--status-break)",
          "break-fill": "var(--status-break-fill)",
          "break-bg": "var(--status-break-bg)",
          bad: "var(--status-bad)",
          good: "var(--status-good)",
          "good-bg": "var(--status-good-bg)",
          warn: "var(--status-warn)",
          "warn-bg": "var(--status-warn-bg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "0.75rem",
        sm: "0.5rem",
      },
      fontFamily: {
        // One family everywhere; times and totals use tabular figures.
        display: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-dot": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
