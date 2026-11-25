import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { ProtectedRoute, PublicOnlyRoute } from "./app/router/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ROUTES } from "./constants/routes";

// Secondary pages are route-level code-split (React Router `lazy`) so the
// Dashboard — the page opened most — doesn't pay for tables/charts up front.
export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.login, element: <LoginPage /> },
          { path: ROUTES.signup, element: <SignupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardPage /> },
          {
            path: ROUTES.monthlyLogs,
            lazy: () => import("./pages/MonthlyLogsPage").then((m) => ({ Component: m.MonthlyLogsPage })),
          },
          {
            path: ROUTES.history,
            lazy: () => import("./pages/HistoryPage").then((m) => ({ Component: m.HistoryPage })),
          },
          {
            path: ROUTES.reports,
            lazy: () => import("./pages/ReportsPage").then((m) => ({ Component: m.ReportsPage })),
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
