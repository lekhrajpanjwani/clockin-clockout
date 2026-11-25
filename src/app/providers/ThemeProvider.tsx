import { useEffect } from "react";
import { useUiStore } from "../../store/uiStore";

/** Keeps `document.documentElement`'s `dark` class (which Tailwind's
 * `darkMode: ["class"]` and every CSS variable in global.css key off of) in
 * sync with the persisted preference, and reacts live to OS-level theme
 * changes when the user has chosen "system". The inline script in
 * index.html sets the class before first paint to avoid a flash; this is
 * what keeps it correct after that. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mql.matches);
      const listener = (e: MediaQueryListEvent) => apply(e.matches);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }

    apply(theme === "dark");
    return undefined;
  }, [theme]);

  // Re-sync `resolvedTheme` (used by non-CSS consumers like the Sonner
  // toaster) whenever `theme` changes, including on first mount.
  useEffect(() => {
    setTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return children;
}
