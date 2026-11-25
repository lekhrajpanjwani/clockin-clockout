import type { ApiErrorBody } from "../../../src/lib/shared/types/attendance";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  extraHeaders?: Record<string, string>,
): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function methodNotAllowed(allowed: string): Response {
  return errorResponse("METHOD_NOT_ALLOWED", `Use ${allowed}.`, 405, undefined, { Allow: allowed });
}

/** Extracts the `YYYY-MM-DD` segment following `/api/<prefix>/` from a request URL. */
export function dateFromPath(url: string, prefix = "day"): string | null {
  const m = new RegExp(`/api/${prefix}/(\\d{4}-\\d{2}-\\d{2})(?:/|$)`).exec(new URL(url).pathname);
  return m ? m[1]! : null;
}

export const dateFromDayPath = (url: string) => dateFromPath(url, "day");
