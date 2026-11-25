import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

export const USER_A = "11111111-1111-1111-1111-111111111111";
export const USER_B = "22222222-2222-2222-2222-222222222222";
export const IST = "Asia/Kolkata";

/** Fresh in-process Postgres with the Supabase stub + every migration applied in order. */
export async function createDb(options: { upTo?: string } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (options.upTo && file > options.upTo) break;
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(
    `insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com')`,
  );
  return db;
}

export async function applyRemainingMigrations(db: PGlite, after: string) {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql") && f > after)
    .sort();
  for (const file of files) await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
}

export interface Snapshot {
  day: {
    id: string;
    work_date: string;
    status: string;
    clock_in: string | null;
    clock_out: string | null;
    worked_minutes: number | null;
    break_minutes: number;
    leave_reason: string | null;
    auto_closed: boolean;
    needs_review: boolean;
    timezone: string;
  };
  sessions: {
    id: string;
    clock_in: string;
    clock_out: string | null;
    closed_by: string | null;
    breaks: { id: string; break_start: string; break_end: string | null }[];
  }[];
}

/** Calls an att_* function as `service_role` (exactly like the Netlify Functions do). */
export async function call<T = Snapshot>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  await db.exec("set role service_role");
  try {
    const res = await db.query<{ r: T }>(`select ${sql} as r`, params);
    return res.rows[0]!.r;
  } finally {
    await db.exec("reset role");
  }
}

/** Runs `fn` and returns the machine error code raised by att_raise (the error message). */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("expected an error");
}

/** IST wall-clock time → ISO instant. `ist("2026-11-20 09:00")`. */
export function ist(local: string): string {
  return new Date(`${local.replace(" ", "T")}:00+05:30`).toISOString();
}
