import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "./supabaseAdmin";

/**
 * Checks and increments a fixed-window rate-limit counter via the
 * `check_rate_limit` Postgres function (see
 * supabase/migrations/0002_attendance_refinements.sql), which does the
 * increment/reset atomically in a single UPSERT so concurrent requests for
 * the same key can't race past the limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  client: SupabaseClient = getAdminClient(),
): Promise<boolean> {
  const { data, error } = await client.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("check_rate_limit RPC failed", error);
    // Fail open: a broken rate limiter should not take down the whole app for
    // a personal attendance tool with no adversarial traffic expected.
    return true;
  }

  return Boolean(data);
}
