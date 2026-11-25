import type { Config, Context } from "@netlify/functions";
import { verifyJwt } from "./_shared/auth";
import { getAdminClient } from "./_shared/supabaseAdmin";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_shared/http";
import { parseQuery } from "./_shared/validate";
import { listPaginated } from "./_shared/attendanceRepo";
import { attendanceQuerySchema } from "../../src/lib/shared/schemas/attendance";
import { toAttendanceRecord } from "../../src/lib/shared/mappers/attendance";
import type { PaginatedAttendance } from "../../src/lib/shared/types/attendance";

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") return methodNotAllowed("GET");

  const auth = await verifyJwt(req);
  if (!auth.ok) return errorResponse(auth.code, auth.message, auth.status);
  const { userId } = auth;

  const url = new URL(req.url);
  const parsed = parseQuery(url, attendanceQuerySchema);
  if (!parsed.ok) return errorResponse("VALIDATION_ERROR", "Invalid query parameters.", 400, parsed.issues);
  const query = parsed.data;

  const client = getAdminClient();

  try {
    const { rows, totalItems } = await listPaginated(client, userId, query);
    const response: PaginatedAttendance = {
      items: rows.map(toAttendanceRecord),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
    };
    return jsonResponse(response, 200);
  } catch (err) {
    console.error("attendance list failed", err);
    return errorResponse("INTERNAL_ERROR", "Could not load attendance history.", 500);
  }
};

export const config: Config = { path: "/api/attendance" };
