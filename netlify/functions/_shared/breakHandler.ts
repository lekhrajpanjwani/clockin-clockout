import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyJwt } from "./auth";
import { getAdminClient } from "./supabaseAdmin";
import { checkRateLimit } from "./rateLimit";
import { errorResponse, jsonResponse, methodNotAllowed } from "./http";
import { DbError, dbErrorResponse } from "./dbErrors";
import type { DaySnapshotRow } from "../../../src/lib/shared/types/attendance";
import { fromDaySnapshot } from "../../../src/lib/shared/mappers/attendance";

/** Shared POST handler for the session actions that need no body
 * (break start / break end): auth → rate limit → DB function → day detail. */
export async function sessionAction(
  req: Request,
  name: string,
  action: (client: SupabaseClient, userId: string) => Promise<DaySnapshotRow>,
): Promise<Response> {
  if (req.method !== "POST") return methodNotAllowed("POST");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const allowed = await checkRateLimit(`${name}:${userId}`, 10, 60);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Try again shortly.", 429, undefined, {
      "Retry-After": "60",
    });
  }

  try {
    const snapshot = await action(getAdminClient(), userId);
    return jsonResponse(fromDaySnapshot(snapshot), 200);
  } catch (err) {
    const mapped = err instanceof DbError ? dbErrorResponse(err.pg) : null;
    if (mapped) return mapped;
    console.error(`${name} failed`, err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
