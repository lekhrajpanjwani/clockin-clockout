import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  computeWorkedMinutes,
  datePrefixToRange,
  daysInMonth,
  enumerateDates,
  firstDayOfMonth,
  formatMinutesAsHours,
  isValidTimeZone,
  isoWeekday,
  isWeekdayIso,
  lastDayOfMonth,
  localDateString,
  localTimeString,
  minutesToDecimalHours,
  weekBoundsFor,
} from "../../src/lib/shared/time/attendance";

// These tests are run under several TZ values in CI (see package.json
// "test:tz") — every assertion must hold regardless of the host timezone.

describe("localDateString", () => {
  it("resolves the local calendar date, not the UTC one", () => {
    // 20:00 UTC on Jul 25 is already Jul 26 in IST (+05:30)…
    const instant = new Date("2026-07-25T20:00:00Z");
    expect(localDateString(instant, "Asia/Kolkata")).toBe("2026-07-26");
    // …and still Jul 25 in New York.
    expect(localDateString(instant, "America/New_York")).toBe("2026-07-25");
  });

  it("handles the IST early-morning window that toISOString() gets wrong", () => {
    const instant = new Date("2026-08-01T00:15:00+05:30"); // = Jul 31 18:45 UTC
    expect(instant.toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(localDateString(instant, "Asia/Kolkata")).toBe("2026-08-01");
  });
});

describe("localTimeString", () => {
  it("formats in the session's own timezone", () => {
    expect(localTimeString(new Date("2026-07-26T03:30:00Z"), "Asia/Kolkata")).toBe("09:00 AM");
  });
});

describe("computeWorkedMinutes", () => {
  it("rounds to the nearest minute", () => {
    expect(computeWorkedMinutes(new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T17:30:29Z"))).toBe(
      510,
    );
    expect(computeWorkedMinutes(new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T17:30:31Z"))).toBe(
      511,
    );
  });
  it("never goes negative", () => {
    expect(computeWorkedMinutes(new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T09:00:00Z"))).toBe(0);
  });
  it("spans midnight and DST changes using real elapsed time", () => {
    // US DST starts 2026-03-08 02:00 local: 22:00 → 06:00 local is only 7h.
    expect(
      computeWorkedMinutes(new Date("2026-03-07T22:00:00-05:00"), new Date("2026-03-08T06:00:00-04:00")),
    ).toBe(7 * 60);
  });
});

describe("formatting", () => {
  it("formatMinutesAsHours pads minutes", () => {
    expect(formatMinutesAsHours(0)).toBe("0h 00m");
    expect(formatMinutesAsHours(65)).toBe("1h 05m");
    expect(formatMinutesAsHours(600)).toBe("10h 00m");
  });
  it("minutesToDecimalHours rounds to 2dp", () => {
    expect(minutesToDecimalHours(90)).toBe(1.5);
    expect(minutesToDecimalHours(100)).toBe(1.67);
  });
});

describe("calendar date math", () => {
  it("isoWeekday is Monday=1 … Sunday=7", () => {
    expect(isoWeekday("2026-07-27")).toBe(1); // Monday
    expect(isoWeekday("2026-07-26")).toBe(7); // Sunday
    expect(isWeekdayIso("2026-07-25")).toBe(false); // Saturday
    expect(isWeekdayIso("2026-07-24")).toBe(true); // Friday
  });

  it("weekBoundsFor returns the Monday–Sunday week", () => {
    expect(weekBoundsFor("2026-07-26")).toEqual({ weekStart: "2026-07-20", weekEnd: "2026-07-26" });
    expect(weekBoundsFor("2026-07-27")).toEqual({ weekStart: "2026-07-27", weekEnd: "2026-08-02" });
    // across a year boundary
    expect(weekBoundsFor("2027-01-01")).toEqual({ weekStart: "2026-12-28", weekEnd: "2027-01-03" });
  });

  it("addDaysIso crosses month/year and leap days", () => {
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("enumerateDates is inclusive and empty for reversed ranges", () => {
    expect(enumerateDates("2026-07-30", "2026-08-02")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(enumerateDates("2026-08-02", "2026-08-01")).toEqual([]);
  });

  it("month bounds", () => {
    expect(firstDayOfMonth(2026, 2)).toBe("2026-02-01");
    expect(lastDayOfMonth(2026, 2)).toBe("2026-02-28");
    expect(lastDayOfMonth(2028, 2)).toBe("2028-02-29");
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("datePrefixToRange", () => {
  it("parses year, month and day prefixes", () => {
    expect(datePrefixToRange("2026")).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    expect(datePrefixToRange("2026-02")).toEqual({ dateFrom: "2026-02-01", dateTo: "2026-02-28" });
    expect(datePrefixToRange(" 2026-07-26 ")).toEqual({ dateFrom: "2026-07-26", dateTo: "2026-07-26" });
  });
  it("rejects anything else", () => {
    expect(datePrefixToRange("July")).toBeNull();
    expect(datePrefixToRange("2026-13")).toBeNull();
    expect(datePrefixToRange("26-07")).toBeNull();
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("local wall-clock <-> instant", () => {
  it("round-trips HH:mm on a date in a timezone", async () => {
    const { isoToLocalHHmm, localDateTimeToIso } = await import("../../src/lib/shared/time/attendance");
    const iso = localDateTimeToIso("2026-11-24", "09:05", "Asia/Kolkata");
    expect(iso).toBe("2026-11-24T03:35:00.000Z");
    expect(isoToLocalHHmm(iso, "Asia/Kolkata")).toBe("09:05");
    // DST-aware: 09:00 in New York is 13:00Z in summer, 14:00Z in winter.
    expect(localDateTimeToIso("2026-07-01", "09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(localDateTimeToIso("2026-12-01", "09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z");
  });
});
