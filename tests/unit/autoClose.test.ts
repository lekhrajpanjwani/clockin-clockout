import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../netlify/functions/_shared/supabaseAdmin", () => ({ getAdminClient: () => ({ rpc }) }));

const { default: handler, config } = await import("../../netlify/functions/auto-close");

describe("auto-close scheduled function", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("runs every 30 minutes", () => {
    expect(config).toEqual({ schedule: "*/30 * * * *" });
  });

  it("calls att_auto_close and reports how many sessions it closed", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    const res = await handler();
    expect(rpc).toHaveBeenCalledWith("att_auto_close", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ closed: 2 });
  });

  it("returns 500 when the database call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect((await handler()).status).toBe(500);
  });
});
