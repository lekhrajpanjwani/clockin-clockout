import { describe, expect, it } from "vitest";
import { dbErrorResponse } from "../../netlify/functions/_shared/dbErrors";

describe("dbErrorResponse", () => {
  it("maps att_raise business errors to their HTTP status with the human message", async () => {
    const res = dbErrorResponse({
      code: "P0001",
      message: "ALREADY_CLOCKED_IN",
      details: "You are already clocked in.",
    });
    expect(res?.status).toBe(409);
    expect(await res?.json()).toEqual({
      error: { code: "ALREADY_CLOCKED_IN", message: "You are already clocked in." },
    });
    expect(dbErrorResponse({ code: "P0001", message: "FUTURE_TIME", details: "x" })?.status).toBe(400);
  });

  it("maps constraint backstops", () => {
    expect(dbErrorResponse({ code: "23505", message: "dup" })?.status).toBe(409);
    expect(dbErrorResponse({ code: "23P01", message: "overlap" })?.status).toBe(409);
  });

  it("returns null for anything unknown", () => {
    expect(dbErrorResponse({ code: "P0001", message: "SOMETHING_ELSE" })).toBeNull();
    expect(dbErrorResponse({ code: "42P01", message: "relation does not exist" })).toBeNull();
    expect(dbErrorResponse(null)).toBeNull();
  });
});

describe("dateFromPath", () => {
  it("extracts the date segment for a prefix", async () => {
    const { dateFromPath, dateFromDayPath } = await import("../../netlify/functions/_shared/http");
    expect(dateFromDayPath("http://x/api/day/2026-11-25/sessions")).toBe("2026-11-25");
    expect(dateFromPath("http://x/api/leave/2026-12-01", "leave")).toBe("2026-12-01");
    expect(dateFromPath("http://x/api/leave/12-01-2026", "leave")).toBeNull();
    expect(dateFromPath("http://x/api/day/2026-11-25", "leave")).toBeNull();
  });
});
