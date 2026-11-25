import { describe, expect, it } from "vitest";
import { computeDayTotals, liveDayTotals, validateCorrection } from "../../src/lib/shared/aggregate/day";

// Same scenarios as tests/db/attendance.test.ts — the TS mirror must agree with the database.
const ist = (local: string) => new Date(`${local.replace(" ", "T")}:00+05:30`).toISOString();
const session = (i: string, o: string | null, breaks: [string, string | null][] = []) => ({
  clockIn: ist(i),
  clockOut: o ? ist(o) : null,
  breaks: breaks.map(([s, e], n) => ({ id: String(n), breakStart: ist(s), breakEnd: e ? ist(e) : null })),
});

describe("computeDayTotals", () => {
  it("sums sessions and subtracts breaks", () => {
    expect(
      computeDayTotals([
        session("2026-11-20 09:00", "2026-11-20 13:00"),
        session("2026-11-20 13:45", "2026-11-20 18:00", [["2026-11-20 16:00", "2026-11-20 16:10"]]),
      ]),
    ).toEqual({
      status: "completed",
      clockIn: ist("2026-11-20 09:00"),
      clockOut: ist("2026-11-20 18:00"),
      workedMinutes: 240 + 255 - 10,
      breakMinutes: 10,
    });
  });

  it("only counts closed sessions while one is running", () => {
    const t = computeDayTotals([
      session("2026-11-20 09:00", "2026-11-20 12:00"),
      session("2026-11-20 13:00", null, [["2026-11-20 14:00", "2026-11-20 14:20"]]),
    ]);
    expect(t).toMatchObject({ status: "working", clockOut: null, workedMinutes: 180, breakMinutes: 20 });
  });

  it("reports on_break while a break is open", () => {
    expect(computeDayTotals([session("2026-11-20 09:00", null, [["2026-11-20 11:00", null]])]).status).toBe(
      "on_break",
    );
  });
});

describe("validateCorrection", () => {
  const ctx = { workDate: "2026-11-24", timezone: "Asia/Kolkata", now: new Date(ist("2026-11-25 12:00")) };
  const s = (i: string, o: string, breaks: [string, string][] = []) => ({
    clockIn: ist(i),
    clockOut: ist(o),
    breaks: breaks.map(([a, b]) => ({ breakStart: ist(a), breakEnd: ist(b) })),
  });
  const codes = (sessions: ReturnType<typeof s>[], c = ctx) =>
    validateCorrection(sessions, c).map((x) => x.code);

  it("accepts a valid day", () => {
    expect(
      codes([s("2026-11-24 09:00", "2026-11-24 13:00"), s("2026-11-24 14:00", "2026-11-24 18:00")]),
    ).toEqual([]);
  });

  it.each([
    [
      "OUTSIDE_CORRECTION_WINDOW",
      [s("2026-10-24 09:00", "2026-10-24 10:00")],
      { ...ctx, workDate: "2026-10-24" },
    ],
    ["INVALID_SESSION", [s("2026-11-24 18:00", "2026-11-24 10:00")], ctx],
    ["FUTURE_TIME", [s("2026-11-25 10:00", "2026-11-25 13:00")], { ...ctx, workDate: "2026-11-25" }],
    ["SESSION_DATE_MISMATCH", [s("2026-11-23 09:00", "2026-11-23 12:00")], ctx],
    [
      "BREAK_OUTSIDE_SESSION",
      [s("2026-11-24 09:00", "2026-11-24 12:00", [["2026-11-24 11:30", "2026-11-24 12:30"]])],
      ctx,
    ],
    [
      "OVERLAPPING_TIMES",
      [s("2026-11-24 09:00", "2026-11-24 12:00"), s("2026-11-24 11:00", "2026-11-24 13:00")],
      ctx,
    ],
    ["SESSION_TOO_LONG", [s("2026-11-23 09:00", "2026-11-24 10:00")], { ...ctx, workDate: "2026-11-23" }],
  ] as const)("flags %s", (code, sessions, c) => {
    expect(codes([...sessions], c)).toContain(code);
  });
});

describe("liveDayTotals", () => {
  const now = new Date(ist("2026-11-20 15:00"));

  it("counts the running session and running break up to now", () => {
    const t = liveDayTotals(
      [
        session("2026-11-20 09:00", "2026-11-20 12:00", [["2026-11-20 10:30", "2026-11-20 10:45"]]),
        session("2026-11-20 13:00", null, [["2026-11-20 14:30", null]]),
      ],
      now,
    );
    expect(t.currentSessionSeconds).toBe(2 * 3600);
    expect(t.currentBreakSeconds).toBe(30 * 60);
    expect(t.breakSeconds).toBe(45 * 60);
    expect(t.workedSeconds).toBe(3 * 3600 + 2 * 3600 - 45 * 60);
  });

  it("is all zeros with no sessions", () => {
    expect(liveDayTotals([], now)).toEqual({
      workedSeconds: 0,
      breakSeconds: 0,
      currentSessionSeconds: 0,
      currentBreakSeconds: 0,
    });
  });
});
