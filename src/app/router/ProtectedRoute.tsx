import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../features/auth/store/authStore";
import { ROUTES } from "../../constants/routes";
import { Skeleton } from "../../components/ui/skeleton";

/** Gates the routes nested under it on an authenticated session, preserving
 * the attempted location so LoginPage can send the user back after sign-in. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="container flex min-h-screen flex-col justify-center gap-3 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Inverse guard for /login and /signup — an already-authenticated user
 * shouldn't see the sign-in form again. */
export function PublicOnlyRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === "authenticated") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
