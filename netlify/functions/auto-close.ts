import type { Config } from "@netlify/functions";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { rpcAutoClose } from "./_shared/attendanceRepo";

/**
 * Scheduled job (every 30 minutes): closes any session still open after its
 * local work day has ended — at 23:59 of that day, in the day's own timezone —
 * and flags the day `auto_closed` + `needs_review` so the user is asked to
 * check it. All the logic lives in att_auto_close() (migration 0003), which is
 * idempotent: running it twice, or calling this by hand, closes nothing new.
 *
 * Scheduled functions only run on published deploys. Locally, trigger it with:
 *   npx netlify functions:invoke auto-close
 */
export default async (): Promise<Response> => {
  try {
    const closed = await rpcAutoClose(getAdminClient());
    console.log(`auto-close: closed ${closed} session(s)`);
    return new Response(JSON.stringify({ closed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-close failed", err);
    return new Response(JSON.stringify({ error: "auto-close failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { schedule: "*/30 * * * *" };
