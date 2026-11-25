import { useAuthStore } from "../features/auth/store/authStore";
import { API_BASE } from "../constants/api";
import type { ApiErrorBody } from "../lib/shared/types/attendance";

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
    throw new ApiError(
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? `Request failed with status ${res.status}`,
      res.status,
      body?.error.details,
    );
  }

  return (await res.json()) as T;
}
