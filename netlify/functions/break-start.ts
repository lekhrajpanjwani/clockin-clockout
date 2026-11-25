import type { Config } from "@netlify/functions";
import { sessionAction } from "./_shared/breakHandler";
import { rpcBreakStart } from "./_shared/attendanceRepo";

/** Starts a break inside the open session. Returns the day with its sessions. */
export default (req: Request) => sessionAction(req, "break-start", rpcBreakStart);

export const config: Config = { path: "/api/break/start" };
