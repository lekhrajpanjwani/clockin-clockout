import type { Config } from "@netlify/functions";
import { sessionAction } from "./_shared/breakHandler";
import { rpcBreakEnd } from "./_shared/attendanceRepo";

/** Ends the open break. Returns the day with its sessions. */
export default (req: Request) => sessionAction(req, "break-end", rpcBreakEnd);

export const config: Config = { path: "/api/break/end" };
