export const ROUTES = {
  dashboard: "/",
  monthlyLogs: "/monthly-logs",
  history: "/history",
  reports: "/reports",
  login: "/login",
  signup: "/signup",
} as const;

export const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: "Dashboard" },
  { to: ROUTES.monthlyLogs, label: "Monthly Logs" },
  { to: ROUTES.history, label: "History" },
  { to: ROUTES.reports, label: "Reports" },
] as const;
