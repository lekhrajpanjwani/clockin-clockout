import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Service-role client — bypasses RLS. Only ever used server-side, only after
 * `verifyJwt` has already established the caller's identity; every query
 * built with this client must filter by that verified `user_id` explicitly.
 * Never expose `SUPABASE_SERVICE_ROLE` to the browser.
 */
export function getAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars must be set");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
