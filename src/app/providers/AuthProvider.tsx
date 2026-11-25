import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "../../services/supabaseClient";
import { useAuthStore } from "../../features/auth/store/authStore";

/**
 * Hydrates the auth store from Supabase on mount and keeps it in sync via
 * `onAuthStateChange` (fires on sign-in, sign-out, and token refresh).
 * Missing/invalid Supabase configuration is a real, common state during
 * local setup (see .env.example) — surfaced as a clear full-page message
 * rather than a blank crash, since nothing auth-gated can function without it.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setConfigError = useAuthStore((s) => s.setConfigError);
  const configError = useAuthStore((s) => s.configError);

  useEffect(() => {
    let client;
    try {
      client = getSupabaseClient();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Supabase is not configured.");
      return undefined;
    }

    client.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => setSession(session));

    return () => subscription.unsubscribe();
  }, [setSession, setConfigError]);

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold">Configuration needed</h1>
          <p className="text-sm text-muted-foreground">{configError}</p>
        </div>
      </div>
    );
  }

  return children;
}
