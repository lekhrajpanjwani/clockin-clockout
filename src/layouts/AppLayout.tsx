import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, CalendarDays, History, LayoutDashboard, type LucideIcon } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { NetworkErrorBanner } from "../components/feedback/NetworkErrorBanner";
import { ThemeToggle } from "../features/settings/components/ThemeToggle";
import { UserMenu } from "../features/auth/components/UserMenu";
import { NAV_ITEMS, ROUTES } from "../constants/routes";
import { cn } from "../utils/cn";

const ICONS: Record<string, LucideIcon> = {
  [ROUTES.dashboard]: LayoutDashboard,
  [ROUTES.monthlyLogs]: CalendarDays,
  [ROUTES.history]: History,
  [ROUTES.reports]: BarChart3,
};

/** Short labels for the phone tab bar. */
const SHORT: Record<string, string> = {
  [ROUTES.dashboard]: "Today",
  [ROUTES.monthlyLogs]: "Month",
  [ROUTES.history]: "History",
  [ROUTES.reports]: "Reports",
};

/** Desktop: a slim icon rail with hover labels. Phone: a top bar plus a
 * bottom tab bar within thumb reach (no slide-out drawer). */
export function AppLayout() {
  return (
    <div className="min-h-screen">
      <NetworkErrorBanner />

      {/* Desktop rail */}
      <aside className="bg-card/70 fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-1.5 border-r border-border py-4 backdrop-blur md:flex">
        <NavLink to={ROUTES.dashboard} aria-label="Punchcard home" className="mb-4 rounded-[11px]">
          <BrandMark className="h-9 w-9" />
        </NavLink>
        <nav aria-label="Main" className="flex flex-col items-center gap-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.to] ?? LayoutDashboard;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-11 w-11 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-primary-soft text-primary-ink"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-[calc(100%+10px)] whitespace-nowrap rounded-sm bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu compact />
      </aside>

      {/* Phone top bar */}
      <header className="bg-background/85 sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border px-4 backdrop-blur md:hidden">
        <NavLink to={ROUTES.dashboard} className="flex items-center gap-2.5" aria-label="Punchcard home">
          <BrandMark className="h-8 w-8" />
          <span className="text-base font-semibold tracking-tight">Punchcard</span>
        </NavLink>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu compact />
        </div>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pl-[calc(72px+2.5rem)] md:pr-10 md:pt-8">
        <div className="mx-auto max-w-[1240px]">
          <Outlet />
        </div>
      </main>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="bg-card/90 fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.to] ?? LayoutDashboard;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.dashboard}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium",
                  isActive ? "text-primary-ink" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-[22px]" aria-hidden="true" />
              {SHORT[item.to] ?? item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
