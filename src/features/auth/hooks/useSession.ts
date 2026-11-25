import { useAuthStore } from "../store/authStore";

/** Convenience read-only view of the auth store for components that only
 * need to know who's signed in, without depending on the store shape. */
export function useSession() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  return { user, status, isAuthenticated: status === "authenticated" };
}
