import { useAuthStore } from "../features/auth/store/authStore";
import { API_BASE } from "../constants/api";
import type { ApiErrorBody } from "../lib/shared/types/attendance";
import { captureError } from "../lib/monitoring";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Thin fetch wrapper: resolves the path against API_BASE, attaches the
 * current Supabase access token, and normalizes non-2xx responses into a
 * single ApiError shape matching netlify/functions/_shared/http.ts. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body (e.g. a proxy/edge failure) — fall through to the generic message below.
    }
    const error = new ApiError(
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? `Request failed with status ${res.status}`,
      res.status,
      body?.error.details,
    );
    // 4xx are expected business outcomes (validation, conflicts); only
    // server-side failures are worth an error report.
    if (res.status >= 500) {
      captureError(error, {
        method: init.method ?? "GET",
        path: path.split("?")[0],
        status: res.status,
        code: error.code,
      });
    }
    throw error;
  }

  return (await res.json()) as T;
}
