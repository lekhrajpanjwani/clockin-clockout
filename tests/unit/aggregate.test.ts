import { describe, expect, it } from "vitest";
import {
  buildMonthCalendar,
  computeReport,
  groupByWeek,
  minutesByDate,
  sumWorkedMinutes,
} from "../../src/lib/shared/aggregate/attendance";
import type { AttendanceRecord } from "../../src/lib/shared/types/attendance";

function rec(
  workDate: string,
  workedMinutes: number | null,
  status: AttendanceRecord["status"] = "completed",
): AttendanceRecord {
  return {
    id: workDate,
    workDate,
    clockIn: `${workDate}T03:30:00.000Z`,
    clockOut: workedMinutes == null ? null : `${workDate}T12:00:00.000Z`,
    timezone: "Asia/Kolkata",
    workedMinutes,
    breakMinutes: 0,
    status,
    leaveReason: null,
    autoClosed: false,
    needsReview: false,
  };
}

describe("groupByWeek", () => {
  it("groups by Monday-start week in chronological order", () => {
    const weeks = groupByWeek([
      rec("2026-07-27", 480),
      rec("2026-07-26", 60),
      rec("2026-07-20", 120),
      rec("2026-07-28", 30),
    ]);
    expect(weeks).toEqual([
      { weekStart: "2026-07-20", weekEnd: "2026-07-26", totalMinutes: 180 },
      { weekStart: "2026-07-27", weekEnd: "2026-08-02", totalMinutes: 510 },
    ]);
  });
  it("counts open sessions as zero", () => {
    expect(groupByWeek([rec("2026-07-27", null, "working")])[0]?.totalMinutes).toBe(0);
  });
});

describe("sumWorkedMinutes / minutesByDate", () => {
  it("sums and indexes", () => {
    const rs = [rec("2026-07-27", 480), rec("2026-07-28", null, "working")];
    expect(sumWorkedMinutes(rs)).toBe(480);
    expect(minutesByDate(rs).get("2026-07-27")).toBe(480);
    expect(minutesByDate(rs).get("2026-07-28")).toBe(0);
  });
});

describe("computeReport", () => {
  // July 2026: Wed 1st … Fri 31st → 23 weekdays.
  const records = [
    rec("2026-07-01", 480),
    rec("2026-07-02", 300),
    rec("2026-07-03", 600),
    rec("2026-07-06", null, "working"),
  ];

  it("computes totals, average, longest and shortest", () => {
    const r = computeReport(records, "2026-07-01", "2026-07-31", 2026, 7);
    expect(r.workingDays).toBe(3);
    expect(r.totalMinutes).toBe(1380);
    expect(r.averageMinutesPerDay).toBe(460);
    expect(r.longestDay).toEqual({ workDate: "2026-07-03", workedMinutes: 600 });
    expect(r.shortestDay).toEqual({ workDate: "2026-07-02", workedMinutes: 300 });
    expect(r.breakMinutes).toBe(0);
    expect(r.autoClosedDays).toBe(0);
  });

  it("counts every un-worked weekday in a past period as missed", () => {
    expect(computeReport(records, "2026-07-01", "2026-07-31", 2026, 7).missedDays).toBe(23 - 3);
  });

  it("does not count future weekdays (or today) as missed", () => {
    // Today = Wed Jul 8. Past weekdays: 1,2,3,6,7 → 5; worked 3 → 2 missed (6th open, 7th).
    expect(computeReport(records, "2026-07-01", "2026-07-31", 2026, 7, "2026-07-08").missedDays).toBe(2);
  });

  it("does not count leave days as missed (or as worked)", () => {
    const withLeave = [
      ...records,
      { ...rec("2026-07-07", null, "leave"), clockIn: null, workedMinutes: 0, leaveReason: "Trip" },
    ];
    const r = computeReport(withLeave, "2026-07-01", "2026-07-31", 2026, 7, "2026-07-08");
    expect(r.missedDays).toBe(1); // only Jul 6 (left open) — Jul 7 was leave
    expect(r.workingDays).toBe(3);
    expect(r.leaveDays).toBe(1);
    const flagged = computeReport(
      [{ ...rec("2026-07-01", 899), autoClosed: true }],
      "2026-07-01",
      "2026-07-31",
      2026,
      7,
    );
    expect(flagged.autoClosedDays).toBe(1);
  });

  it("handles an empty period", () => {
    const r = computeReport([], "2026-07-01", "2026-07-31", 2026, 7, "2026-06-01");
    expect(r).toMatchObject({
      workingDays: 0,
      totalMinutes: 0,
      averageMinutesPerDay: 0,
      longestDay: null,
      missedDays: 0,
    });
  });
});

describe("buildMonthCalendar", () => {
  it("merges records into each day with weekday", () => {
    const cal = buildMonthCalendar(["2026-07-25", "2026-07-26", "2026-07-27"], [rec("2026-07-27", 60)]);
    expect(cal.map((d) => [d.date, d.weekday, d.record?.workedMinutes ?? null])).toEqual([
      ["2026-07-25", 6, null],
      ["2026-07-26", 7, null],
      ["2026-07-27", 1, 60],
    ]);
  });
});
