import { Moon, Sun } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useUiStore } from "../../../store/uiStore";

export function ThemeToggle() {
  const resolvedTheme = useUiStore((s) => s.resolvedTheme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
    >
      {resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
