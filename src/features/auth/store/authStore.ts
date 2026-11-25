import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Set when Supabase itself couldn't be reached/configured — distinct from
   * "unauthenticated", which just means no signed-in user. */
  configError: string | null;
  setSession: (session: Session | null) => void;
  setConfigError: (message: string) => void;
}

/**
 * Deliberately NOT persisted: Supabase's own client already persists the
 * session (see services/supabaseClient.ts). This store is just the
 * in-memory, React-reactive mirror of it, kept in sync by AuthProvider's
 * `onAuthStateChange` subscription — a second persisted copy would be a
 * second source of truth that could drift from the real one.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  session: null,
  user: null,
  configError: null,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      status: session ? "authenticated" : "unauthenticated",
      configError: null,
    }),
  setConfigError: (message) => set({ configError: message, status: "unauthenticated" }),
}));
