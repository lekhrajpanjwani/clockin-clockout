import { Outlet } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../features/settings/components/ThemeToggle";

/** Centered card shell shared by the sign-in and sign-up pages (Phase 4). */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg font-bold tracking-tight">Punchcard</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
