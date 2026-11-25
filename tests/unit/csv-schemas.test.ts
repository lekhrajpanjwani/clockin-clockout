import { describe, expect, it } from "vitest";
import { buildAttendanceCsv, csvEscape } from "../../src/lib/shared/csv/attendanceCsv";
import {
  attendanceQuerySchema,
  clockInSchema,
  markLeaveSchema,
  regularizeSchema,
  reportQuerySchema,
} from "../../src/lib/shared/schemas/attendance";
import { fromDaySnapshot, toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";

describe("buildAttendanceCsv", () => {
  it("writes one row per day with breaks, leave and review columns (CRLF)", () => {
    const csv = buildAttendanceCsv([
      {
        id: "1",
        workDate: "2026-07-26",
        clockIn: "2026-07-26T03:30:00.000Z",
        clockOut: "2026-07-26T12:00:00.000Z",
        timezone: "Asia/Kolkata",
        workedMinutes: 480,
        breakMinutes: 30,
        status: "completed",
        leaveReason: null,
        autoClosed: true,
        needsReview: true,
      },
      {
        id: "2",
        workDate: "2026-07-27",
        clockIn: "2026-07-27T03:30:00.000Z",
        clockOut: null,
        timezone: "Asia/Kolkata",
        workedMinutes: null,
        breakMinutes: 0,
        status: "working",
        leaveReason: null,
        autoClosed: false,
        needsReview: false,
      },
      {
        id: "3",
        workDate: "2026-07-28",
        clockIn: null,
        clockOut: null,
        timezone: "Asia/Kolkata",
        workedMinutes: 0,
        breakMinutes: 0,
        status: "leave",
        leaveReason: '=HYPERLINK("x"), trip',
        autoClosed: false,
        needsReview: false,
      },
    ]);
    expect(csv.split("\r\n")).toEqual([
      "Date,Status,First Clock In,Last Clock Out,Worked Hours,Break Hours,Timezone,Leave Reason,Auto-closed,Needs Review",
      "2026-07-26,Completed,09:00 AM,05:30 PM,8,0.5,Asia/Kolkata,,Yes,Yes",
      "2026-07-27,Working,09:00 AM,,,0,Asia/Kolkata,,No,No",
      `2026-07-28,Leave,,,,,Asia/Kolkata,"'=HYPERLINK(""x""), trip",No,No`,
    ]);
  });
});

describe("csvEscape", () => {
  it("neutralizes formula injection and quotes separators", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("@cmd")).toBe("'@cmd");
    expect(csvEscape("-5")).toBe("'-5");
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
    expect(csvEscape("plain")).toBe("plain");
  });
});

describe("schemas", () => {
  it("clockIn requires a valid IANA timezone", () => {
    expect(clockInSchema.safeParse({ timezone: "Asia/Kolkata" }).success).toBe(true);
    expect(clockInSchema.safeParse({ timezone: "Nowhere/Land" }).success).toBe(false);
  });

  it("attendance query applies defaults and coerces numbers", () => {
    const q = attendanceQuerySchema.parse({ page: "2" });
    expect(q).toMatchObject({ page: 2, pageSize: 20, sortBy: "workDate", sortDir: "desc" });
    expect(attendanceQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("attendance search only accepts date prefixes", () => {
    expect(attendanceQuerySchema.safeParse({ search: "2026-07" }).success).toBe(true);
    expect(attendanceQuerySchema.safeParse({ search: "july" }).success).toBe(false);
  });

  it("regularize requires a reason and ISO times", () => {
    const ok = regularizeSchema.safeParse({
      timezone: "Asia/Kolkata",
      reason: "Forgot to clock out",
      sessions: [{ clockIn: "2026-07-26T03:30:00Z", clockOut: "2026-07-26T12:00:00+05:30" }],
    });
    expect(ok.success && ok.data.sessions[0]!.breaks).toEqual([]);
    expect(regularizeSchema.safeParse({ timezone: "UTC", reason: "x", sessions: [] }).success).toBe(false);
    expect(
      regularizeSchema.safeParse({
        timezone: "UTC",
        reason: "ok fine",
        sessions: [{ clockIn: "9am", clockOut: "5pm" }],
      }).success,
    ).toBe(false);
  });

  it("leave needs a date and a reason", () => {
    expect(markLeaveSchema.safeParse({ date: "2026-07-26", timezone: "UTC", reason: "Trip" }).success).toBe(
      true,
    );
    expect(markLeaveSchema.safeParse({ date: "26/07/2026", timezone: "UTC", reason: "Trip" }).success).toBe(
      false,
    );
  });

  it("report query accepts an optional timezone", () => {
    expect(reportQuerySchema.parse({ year: "2026", timezone: "Asia/Kolkata" })).toEqual({
      year: 2026,
      timezone: "Asia/Kolkata",
    });
    expect(reportQuerySchema.safeParse({ year: "1999" }).success).toBe(false);
  });
});

describe("toAttendanceRecord", () => {
  it("maps snake_case rows to camelCase and normalizes timestamps to UTC", () => {
    expect(
      toAttendanceRecord({
        id: "x",
        work_date: "2026-07-26",
        clock_in: "2026-07-26T09:00:00+05:30",
        clock_out: null,
        timezone: "UTC",
        worked_minutes: null,
        break_minutes: 0,
        status: "working",
        leave_reason: null,
        auto_closed: false,
        needs_review: false,
      }),
    ).toEqual({
      id: "x",
      workDate: "2026-07-26",
      clockIn: "2026-07-26T03:30:00.000Z",
      clockOut: null,
      timezone: "UTC",
      workedMinutes: null,
      breakMinutes: 0,
      status: "working",
      leaveReason: null,
      autoClosed: false,
      needsReview: false,
    });
  });
});

describe("fromDaySnapshot", () => {
  it("maps sessions and breaks", () => {
    const d = fromDaySnapshot({
      day: {
        id: "d",
        work_date: "2026-07-26",
        clock_in: "2026-07-26T03:30:00+00:00",
        clock_out: "2026-07-26T12:00:00+00:00",
        timezone: "Asia/Kolkata",
        worked_minutes: 480,
        break_minutes: 30,
        status: "completed",
        leave_reason: null,
        auto_closed: false,
        needs_review: false,
        created_at: "x",
        updated_at: "x",
      },
      sessions: [
        {
          id: "s",
          clock_in: "2026-07-26T03:30:00+00:00",
          clock_out: "2026-07-26T12:00:00+00:00",
          closed_by: "user",
          breaks: [
            { id: "b", break_start: "2026-07-26T07:30:00+00:00", break_end: "2026-07-26T08:00:00+00:00" },
          ],
        },
      ],
    });
    expect(d.day.breakMinutes).toBe(30);
    expect(d.sessions[0]).toEqual({
      id: "s",
      clockIn: "2026-07-26T03:30:00.000Z",
      clockOut: "2026-07-26T12:00:00.000Z",
      closedBy: "user",
      breaks: [{ id: "b", breakStart: "2026-07-26T07:30:00.000Z", breakEnd: "2026-07-26T08:00:00.000Z" }],
    });
  });
});
