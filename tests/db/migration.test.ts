import { describe, expect, it } from "vitest";
import { USER_A, applyRemainingMigrations, createDb } from "./db";

describe("0003 backfill", () => {
  it("turns existing days into sessions without changing totals", async () => {
    const db = await createDb({ upTo: "0002_attendance_refinements.sql" });
    await db.exec(`
      insert into public.attendance (user_id, work_date, clock_in, clock_out, timezone, worked_minutes, status) values
        ('${USER_A}', '2026-11-18', '2026-11-18T03:30:00Z', '2026-11-18T12:00:00Z', 'Asia/Kolkata', 510, 'completed'),
        ('${USER_A}', '2026-11-19', '2026-11-19T03:30:00Z', null, 'Asia/Kolkata', null, 'working');
    `);

    await applyRemainingMigrations(db, "0002_attendance_refinements.sql");

    const days = await db.query<{
      work_date: string;
      status: string;
      worked_minutes: number | null;
      break_minutes: number;
    }>(
      "select to_char(work_date, 'YYYY-MM-DD') as work_date, status, worked_minutes, break_minutes from public.attendance order by work_date",
    );
    expect(days.rows).toEqual([
      { work_date: "2026-11-18", status: "completed", worked_minutes: 510, break_minutes: 0 },
      { work_date: "2026-11-19", status: "working", worked_minutes: null, break_minutes: 0 },
    ]);

    const sessions = await db.query<{ closed_by: string | null; open: boolean }>(
      "select s.closed_by, s.clock_out is null as open from public.attendance_sessions s join public.attendance a on a.id = s.attendance_id order by a.work_date",
    );
    expect(sessions.rows).toEqual([
      { closed_by: "user", open: false },
      { closed_by: null, open: true },
    ]);

    // The backfilled open session can be clocked out through the new path.
    await db.exec("set role service_role");
    const res = await db.query<{ r: { day: { status: string; worked_minutes: number } } }>(
      "select public.att_clock_out($1, '2026-11-19T12:30:00Z') as r",
      [USER_A],
    );
    await db.exec("reset role");
    expect(res.rows[0]!.r.day).toMatchObject({ status: "completed", worked_minutes: 540 });
    await db.close();
  }, 60_000);
});
