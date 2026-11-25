import { describe, expect, it } from "vitest";
import { crossesMidnight, fromDraft, toDraft } from "../../src/features/attendance/correction/draft";

const TZ = "Asia/Kolkata";
const ist = (d: string, t: string) => new Date(`${d}T${t}:00+05:30`).toISOString();

describe("correction draft", () => {
  it("round-trips sessions through HH:mm", () => {
    const draft = toDraft(
      [
        {
          id: "s",
          clockIn: ist("2026-11-24", "09:05"),
          clockOut: ist("2026-11-24", "18:10"),
          closedBy: "auto",
          breaks: [{ id: "b", breakStart: ist("2026-11-24", "13:00"), breakEnd: ist("2026-11-24", "13:30") }],
        },
      ],
      TZ,
    );
    expect(draft[0]).toMatchObject({
      clockIn: "09:05",
      clockOut: "18:10",
      breaks: [{ start: "13:00", end: "13:30" }],
    });
    const back = fromDraft(draft, "2026-11-24", TZ);
    expect(back).toEqual({
      ok: true,
      sessions: [
        {
          clockIn: ist("2026-11-24", "09:05"),
          clockOut: ist("2026-11-24", "18:10"),
          breaks: [{ breakStart: ist("2026-11-24", "13:00"), breakEnd: ist("2026-11-24", "13:30") }],
        },
      ],
    });
  });

  it("reads an earlier clock-out as the next day", () => {
    expect(crossesMidnight("22:00", "02:00")).toBe(true);
    expect(crossesMidnight("09:00", "09:00")).toBe(false);
    const r = fromDraft(
      [
        {
          key: "a",
          clockIn: "22:00",
          clockOut: "02:00",
          breaks: [{ key: "b", start: "23:30", end: "00:15" }],
        },
      ],
      "2026-11-24",
      TZ,
    );
    expect(r.ok && r.sessions[0]).toEqual({
      clockIn: ist("2026-11-24", "22:00"),
      clockOut: ist("2026-11-25", "02:00"),
      breaks: [{ breakStart: ist("2026-11-24", "23:30"), breakEnd: ist("2026-11-25", "00:15") }],
    });
  });

  it("reports blank times", () => {
    expect(
      fromDraft([{ key: "a", clockIn: "09:00", clockOut: "", breaks: [] }], "2026-11-24", TZ),
    ).toMatchObject({
      ok: false,
      session: 0,
    });
  });
});
