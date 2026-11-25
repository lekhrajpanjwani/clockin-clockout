import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

interface UiState {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  sidebarOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: ThemePreference): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

/** Global, persisted UI preferences. Kept separate from `features/*` stores —
 * theme and sidebar state belong to the app shell, not to any one feature. */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: resolve("system"),
      sidebarOpen: false,
      setTheme: (theme) => set({ theme, resolvedTheme: resolve(theme) }),
      toggleTheme: () => {
        const next = get().resolvedTheme === "dark" ? "light" : "dark";
        set({ theme: next, resolvedTheme: next });
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "ui-store",
      // Only the theme is a genuine cross-session preference; the mobile
      // nav drawer is transient UI state and should always start closed.
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
