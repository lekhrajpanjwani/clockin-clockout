import { describe, expect, it } from "vitest";
import { captureError, scrubPii, setMonitoringUser } from "../../src/lib/monitoring";

describe("scrubPii", () => {
  it("removes email addresses anywhere in an event", () => {
    const event = {
      message: "Login failed for jane.doe@example.com",
      user: { id: "u1", email: "jane.doe@example.com" },
      breadcrumbs: [{ message: "POST /api/x by a@b.co" }],
      count: 3,
      ok: true,
      nothing: null,
    };
    expect(scrubPii(event)).toEqual({
      message: "Login failed for [email]",
      user: { id: "u1", email: "[email]" },
      breadcrumbs: [{ message: "POST /api/x by [email]" }],
      count: 3,
      ok: true,
      nothing: null,
    });
  });
});

describe("without a DSN", () => {
  it("monitoring calls are safe no-ops", () => {
    expect(() => {
      setMonitoringUser("u1");
      captureError(new Error("boom"), { path: "/api/x" });
    }).not.toThrow();
  });
});
