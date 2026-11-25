import type { ZodType, ZodError } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ZodError["issues"] };

// `ZodType<T, any, any>` (rather than the `ZodSchema<T>` alias) so TS infers
// the precise post-parse Output type for `T` — with just `ZodSchema<T>`,
// fields using `.default(...)` infer as optional here even though zod's
// actual parsed output always fills them in.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod's ZodType Def/Input generics must be left open for T inference to work; see comment above.
export async function parseJsonBody<T>(req: Request, schema: ZodType<T, any, any>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = req.headers.get("content-length") === "0" ? {} : await req.json();
  } catch {
    raw = {};
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: result.error.issues };
  }
  return { ok: true, data: result.data };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see parseJsonBody above.
export function parseQuery<T>(url: URL, schema: ZodType<T, any, any>): ParseResult<T> {
  const raw = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, issues: result.error.issues };
  }
  return { ok: true, data: result.data };
}
