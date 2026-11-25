import { NavLink, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { NetworkErrorBanner } from "../components/feedback/NetworkErrorBanner";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../features/settings/components/ThemeToggle";
import { UserMenu } from "../features/auth/components/UserMenu";
import { NAV_ITEMS } from "../constants/routes";
import { useUiStore } from "../store/uiStore";
import { cn } from "../utils/cn";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="min-h-screen">
      <NetworkErrorBanner />

      <header className="bg-background/80 sticky top-0 z-30 border-b border-border backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Toggle navigation"
              onClick={toggleSidebar}
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <BrandMark />
            <span className="font-display text-lg font-bold tracking-tight">Punchcard</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="container flex gap-8 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <NavLinks />
          </div>
        </aside>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20 bg-black/40 md:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.2 }}
                className="fixed inset-y-0 left-0 z-20 w-64 border-r border-border bg-background p-4 pt-20 md:hidden"
              >
                <NavLinks onNavigate={() => setSidebarOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
