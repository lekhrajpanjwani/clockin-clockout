import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { IST, USER_A, USER_B, call, createDb, errorCode, ist, type Snapshot } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("truncate public.attendance, public.attendance_audit cascade");
});

const clockIn = (at: string, user = USER_A, tz = IST) =>
  call(db, "public.att_clock_in($1, $2, $3)", [user, tz, at]);
const clockOut = (at: string, user = USER_A) => call(db, "public.att_clock_out($1, $2)", [user, at]);
const breakStart = (at: string, user = USER_A) => call(db, "public.att_break_start($1, $2)", [user, at]);
const breakEnd = (at: string, user = USER_A) => call(db, "public.att_break_end($1, $2)", [user, at]);
const autoClose = (at: string) => call<number>(db, "public.att_auto_close($1)", [at]);
const regularize = (date: string, sessions: unknown, reason: string | null, now: string, user = USER_A) =>
  call<Snapshot | null>(db, "public.att_regularize($1, $2, $3, $4, $5, $6)", [
    user,
    date,
    IST,
    JSON.stringify(sessions),
    reason,
    now,
  ]);
const markLeave = (date: string, reason: string, now: string, user = USER_A) =>
  call(db, "public.att_mark_leave($1, $2, $3, $4, $5)", [user, date, IST, reason, now]);
const cancelLeave = (date: string, now: string, user = USER_A) =>
  call(db, "public.att_cancel_leave($1, $2, $3, $4)", [user, date, null, now]);

async function audit(user = USER_A) {
  const res = await db.query<{
    action: string;
    actor: string;
    reason: string | null;
    before: unknown;
    after: unknown;
  }>(
    "select action, actor, reason, before, after from public.attendance_audit where user_id = $1 order by id",
    [user],
  );
  return res.rows;
}

describe("sessions", () => {
  it("clock in creates the day and an open session", async () => {
    const s = await clockIn(ist("2026-11-20 09:00"));
    expect(s.day).toMatchObject({
      work_date: "2026-11-20",
      status: "working",
      clock_out: null,
      timezone: IST,
    });
    expect(s.sessions).toHaveLength(1);
    expect(s.sessions[0]!.clock_out).toBeNull();
    expect((await audit()).map((a) => [a.action, a.actor])).toEqual([["clock_in", "user"]]);
  });

  it("rejects a second clock-in while a session is open", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    expect(await errorCode(clockIn(ist("2026-11-20 09:05")))).toBe("ALREADY_CLOCKED_IN");
  });

  it("supports several sessions on the same day", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    await clockOut(ist("2026-11-20 13:00"));
    await clockIn(ist("2026-11-20 14:00"));
    const working = await clockOut(ist("2026-11-20 18:30")).then(() => null);
    expect(working).toBeNull();
    const res = await db.query<{ status: string; worked_minutes: number; clock_in: Date; clock_out: Date }>(
      "select status, worked_minutes, clock_in, clock_out from public.attendance",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.status).toBe("completed");
    expect(res.rows[0]!.worked_minutes).toBe(4 * 60 + 4 * 60 + 30);
    expect(res.rows[0]!.clock_in.toISOString()).toBe(ist("2026-11-20 09:00"));
    expect(res.rows[0]!.clock_out.toISOString()).toBe(ist("2026-11-20 18:30"));
  });

  it("only counts closed sessions while a later session is running", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    await clockOut(ist("2026-11-20 12:00"));
    const s = await clockIn(ist("2026-11-20 13:00"));
    expect(s.day).toMatchObject({ status: "working", worked_minutes: 180, clock_out: null });
  });

  it("clock out with no open session fails", async () => {
    expect(await errorCode(clockOut(ist("2026-11-20 18:00")))).toBe("NOT_CLOCKED_IN");
  });

  it("a session crossing midnight belongs to the day it started", async () => {
    await clockIn(ist("2026-11-20 23:30"));
    const s = await clockOut(ist("2026-11-21 01:00"));
    expect(s.day).toMatchObject({ work_date: "2026-11-20", worked_minutes: 90, status: "completed" });
  });

  it("keeps users apart", async () => {
    await clockIn(ist("2026-11-20 09:00"), USER_A);
    const b = await clockIn(ist("2026-11-20 09:00"), USER_B);
    expect(b.day.status).toBe("working");
  });
});

describe("breaks", () => {
  it("subtracts breaks from worked time", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    const onBreak = await breakStart(ist("2026-11-20 11:00"));
    expect(onBreak.day.status).toBe("on_break");
    const back = await breakEnd(ist("2026-11-20 11:15"));
    expect(back.day).toMatchObject({ status: "working", break_minutes: 15 });
    const done = await clockOut(ist("2026-11-20 17:00"));
    expect(done.day).toMatchObject({ status: "completed", worked_minutes: 8 * 60 - 15, break_minutes: 15 });
    expect(done.sessions[0]!.breaks).toHaveLength(1);
  });

  it("clocking out during a break ends the break", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    await breakStart(ist("2026-11-20 12:30"));
    const s = await clockOut(ist("2026-11-20 13:00"));
    expect(s.day).toMatchObject({ status: "completed", worked_minutes: 210, break_minutes: 30 });
    expect(s.sessions[0]!.breaks[0]!.break_end).not.toBeNull();
  });

  it("rejects invalid break transitions", async () => {
    expect(await errorCode(breakStart(ist("2026-11-20 10:00")))).toBe("NOT_CLOCKED_IN");
    await clockIn(ist("2026-11-20 09:00"));
    expect(await errorCode(breakEnd(ist("2026-11-20 10:00")))).toBe("NOT_ON_BREAK");
    await breakStart(ist("2026-11-20 10:00"));
    expect(await errorCode(breakStart(ist("2026-11-20 10:05")))).toBe("ALREADY_ON_BREAK");
    expect(await errorCode(clockIn(ist("2026-11-20 10:06")))).toBe("ALREADY_CLOCKED_IN");
  });
});

describe("auto-close", () => {
  it("leaves sessions alone until the local day is over", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    expect(await autoClose(ist("2026-11-20 23:30"))).toBe(0);
  });

  it("closes at 23:59 local, closes an open break, and flags the day", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    await breakStart(ist("2026-11-20 18:00"));
    expect(await autoClose(ist("2026-11-21 00:30"))).toBe(1);

    const s = await call(db, "public.att_day_snapshot((select id from public.attendance))");
    expect(s.day).toMatchObject({ status: "completed", auto_closed: true, needs_review: true });
    expect(new Date(s.day.clock_out!).toISOString()).toBe(ist("2026-11-20 23:59"));
    expect(s.sessions[0]!.closed_by).toBe("auto");
    expect(s.day.break_minutes).toBe(5 * 60 + 59);
    expect(s.day.worked_minutes).toBe(9 * 60);

    const last = (await audit()).at(-1)!;
    expect([last.action, last.actor]).toEqual(["auto_close", "auto_close"]);

    // The user can start the next day normally.
    const next = await clockIn(ist("2026-11-21 09:00"));
    expect(next.day.work_date).toBe("2026-11-21");
  });

  it("uses the day's own timezone", async () => {
    // 09:00 in New York on Nov 20 = 19:30 IST; NY midnight = 10:30 IST Nov 21.
    await clockIn("2026-11-20T14:00:00Z", USER_B, "America/New_York");
    expect(await autoClose(ist("2026-11-21 10:00"))).toBe(0);
    expect(await autoClose(ist("2026-11-21 10:31"))).toBe(1);
  });
});

describe("regularization", () => {
  const NOW = ist("2026-11-25 12:00");
  const day = (date: string, ...ranges: [string, string, [string, string][]?][]) =>
    ranges.map(([i, o, breaks]) => ({
      clock_in: ist(`${date} ${i}`),
      clock_out: ist(`${date} ${o}`),
      breaks: (breaks ?? []).map(([s, e]) => ({
        break_start: ist(`${date} ${s}`),
        break_end: ist(`${date} ${e}`),
      })),
    }));

  it("fixes an auto-closed day and records before/after with the reason", async () => {
    await clockIn(ist("2026-11-20 09:00"));
    await autoClose(ist("2026-11-21 00:30"));

    const s = await regularize(
      "2026-11-20",
      day("2026-11-20", ["09:00", "13:00"], ["13:45", "18:00", [["16:00", "16:10"]]]),
      "Forgot to clock out",
      NOW,
    );
    expect(s!.day).toMatchObject({ status: "completed", needs_review: false, auto_closed: true });
    expect(s!.day.worked_minutes).toBe(240 + 255 - 10);
    expect(s!.day.break_minutes).toBe(10);
    expect(s!.sessions.map((x) => x.closed_by)).toEqual(["correction", "correction"]);

    const last = (await audit()).at(-1)!;
    expect(last).toMatchObject({ action: "regularize", actor: "user", reason: "Forgot to clock out" });
    expect(last.before).not.toBeNull();
    expect(last.after).not.toBeNull();
  });

  it("accepts exactly what the API sends (toRegularizeArg contract)", async () => {
    const { toRegularizeArg, fromDaySnapshot } = await import("../../src/lib/shared/mappers/attendance");
    const arg = toRegularizeArg([
      {
        clockIn: "2026-11-24T09:00:00+05:30",
        clockOut: "2026-11-24T17:30:00+05:30",
        breaks: [{ breakStart: "2026-11-24T13:00:00+05:30", breakEnd: "2026-11-24T13:30:00+05:30" }],
      },
    ]);
    const s = await regularize("2026-11-24", arg, "API contract", NOW);
    const detail = fromDaySnapshot(s as never);
    expect(detail.day).toMatchObject({ workedMinutes: 480, breakMinutes: 30, status: "completed" });
    expect(detail.sessions[0]!.breaks[0]!.breakStart).toBe(ist("2026-11-24 13:00"));
  });

  it("can add a day that had no attendance", async () => {
    const s = await regularize(
      "2026-11-24",
      day("2026-11-24", ["10:00", "18:00"]),
      "Worked from client site",
      NOW,
    );
    expect(s!.day).toMatchObject({ work_date: "2026-11-24", worked_minutes: 480, status: "completed" });
  });

  it("an empty list removes the day", async () => {
    await regularize("2026-11-24", day("2026-11-24", ["10:00", "18:00"]), "Added by mistake?", NOW);
    expect(await regularize("2026-11-24", [], "Was actually off", NOW)).toBeNull();
    expect((await db.query("select 1 from public.attendance")).rows).toHaveLength(0);
    expect((await audit()).at(-1)!.after).toBeNull();
  });

  it.each([
    ["REASON_REQUIRED", "2026-11-24", () => day("2026-11-24", ["10:00", "18:00"]), " "],
    ["OUTSIDE_CORRECTION_WINDOW", "2026-10-25", () => day("2026-10-25", ["10:00", "18:00"]), "late fix"],
    ["OUTSIDE_CORRECTION_WINDOW", "2026-11-26", () => day("2026-11-26", ["10:00", "11:00"]), "future day"],
    ["FUTURE_TIME", "2026-11-25", () => day("2026-11-25", ["10:00", "13:00"]), "too early"],
    ["INVALID_SESSION", "2026-11-24", () => day("2026-11-24", ["18:00", "10:00"]), "reversed"],
    [
      "OVERLAPPING_TIMES",
      "2026-11-24",
      () => day("2026-11-24", ["09:00", "12:00"], ["11:00", "13:00"]),
      "overlap",
    ],
    [
      "BREAK_OUTSIDE_SESSION",
      "2026-11-24",
      () => day("2026-11-24", ["09:00", "12:00", [["11:30", "12:30"]]]),
      "brk",
    ],
    ["SESSION_DATE_MISMATCH", "2026-11-24", () => day("2026-11-23", ["09:00", "12:00"]), "wrong day"],
  ])("rejects %s (%s)", async (code, date, sessions, reason) => {
    expect(await errorCode(regularize(date, sessions(), reason, NOW))).toBe(code);
  });

  it("rejects overlap with another day's session", async () => {
    await clockIn(ist("2026-11-23 22:00"));
    await clockOut(ist("2026-11-24 02:00")); // belongs to Nov 23
    const code = await errorCode(
      regularize("2026-11-24", day("2026-11-24", ["01:00", "05:00"]), "night", NOW),
    );
    expect(code).toBe("OVERLAPPING_TIMES");
  });

  it("refuses while a session is still open, and leaves data untouched on failure", async () => {
    await clockIn(ist("2026-11-25 09:00"));
    expect(
      await errorCode(
        regularize("2026-11-25", day("2026-11-25", ["08:00", "09:00"]), "fix", ist("2026-11-25 10:00")),
      ),
    ).toBe("SESSION_OPEN");
    const n = await db.query("select 1 from public.attendance_sessions");
    expect(n.rows).toHaveLength(1);
  });
});

describe("leave", () => {
  const NOW = ist("2026-11-25 08:00");

  it("marks today as leave and blocks clock-in", async () => {
    const s = await markLeave("2026-11-25", "Family function", NOW);
    expect(s.day).toMatchObject({
      status: "leave",
      leave_reason: "Family function",
      worked_minutes: 0,
      clock_in: null,
    });
    expect(await errorCode(clockIn(ist("2026-11-25 09:00")))).toBe("ON_LEAVE");
    expect((await audit()).at(-1)!.action).toBe("leave_mark");
  });

  it("allows future dates but not past ones", async () => {
    await markLeave("2026-12-01", "Trip", NOW);
    expect(await errorCode(markLeave("2026-11-24", "Sick", NOW))).toBe("LEAVE_DATE_IN_PAST");
    expect(await errorCode(markLeave("2026-12-01", "Again", NOW))).toBe("ALREADY_ON_LEAVE");
    expect(await errorCode(markLeave("2026-12-02", "  ", NOW))).toBe("REASON_REQUIRED");
  });

  it("can't mark leave on a day with attendance", async () => {
    await clockIn(ist("2026-11-25 07:00"));
    expect(await errorCode(markLeave("2026-11-25", "Sick", NOW))).toBe("DAY_HAS_ATTENDANCE");
  });

  it("cancels leave and audits it", async () => {
    await markLeave("2026-11-26", "Trip", NOW);
    await cancelLeave("2026-11-26", NOW);
    expect((await db.query("select 1 from public.attendance")).rows).toHaveLength(0);
    expect((await audit()).at(-1)!.action).toBe("leave_cancel");
    expect(await errorCode(cancelLeave("2026-11-26", NOW))).toBe("NOT_ON_LEAVE");
  });

  it("leave days can't be corrected until cancelled", async () => {
    await markLeave("2026-11-25", "Sick", NOW);
    const code = await errorCode(
      regularize(
        "2026-11-25",
        [{ clock_in: ist("2026-11-25 07:00"), clock_out: ist("2026-11-25 07:30") }],
        "x fix",
        ist("2026-11-25 08:00"),
      ),
    );
    expect(code).toBe("DAY_IS_LEAVE");
  });
});

describe("security", () => {
  async function asUser<T>(
    role: "anon" | "authenticated",
    sub: string | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? ""]);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }

  it("browser roles cannot write directly", async () => {
    const msg = await errorCode(
      asUser("authenticated", USER_A, () =>
        db.query(
          `insert into public.attendance (user_id, work_date, timezone, status, clock_in) values ($1, '2026-11-20', 'UTC', 'working', now())`,
          [USER_A],
        ),
      ),
    );
    expect(msg).toMatch(/permission denied/);
  });

  it("browser roles cannot call the write functions or the rate limiter", async () => {
    for (const sql of [
      `select public.att_clock_in('${USER_B}', 'UTC')`,
      `select public.att_auto_close()`,
      `select public.check_rate_limit('x', 1, 1)`,
    ]) {
      expect(await errorCode(asUser("authenticated", USER_A, () => db.query(sql)))).toMatch(
        /permission denied/,
      );
      expect(await errorCode(asUser("anon", null, () => db.query(sql)))).toMatch(/permission denied/);
    }
  });

  it("RLS lets a user read only their own rows", async () => {
    await clockIn(ist("2026-11-20 09:00"), USER_A);
    await clockIn(ist("2026-11-20 09:00"), USER_B);
    for (const table of ["attendance", "attendance_sessions", "attendance_audit"]) {
      const rows = await asUser("authenticated", USER_A, () =>
        db.query<{ user_id: string }>(`select user_id from public.${table}`),
      );
      expect(rows.rows.map((r) => r.user_id)).toEqual([USER_A]);
    }
  });
});
