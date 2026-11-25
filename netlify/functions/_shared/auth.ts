import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AuthResult =
  { ok: true; userId: string } | { ok: false; status: number; code: string; message: string };

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    throw new Error("JWT_SECRET env var is not set (required for this project's legacy HS256 tokens)");
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

let cachedJwks: JWTVerifyGetKey | null = null;

function getJwks(): JWTVerifyGetKey {
  if (cachedJwks) return cachedJwks;
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL env var is not set");
  }
  cachedJwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return cachedJwks;
}

/**
 * Verifies a Supabase-issued access token locally rather than calling
 * Supabase Auth's `/user` endpoint on every request. Current Supabase
 * projects sign tokens asymmetrically (ES256, by default) and publish a
 * JWKS endpoint for it — no shared secret involved, verified here via
 * `jose`'s `createRemoteJWKSet` (which caches and rotates keys itself).
 * Older projects still on the legacy shared HS256 secret are also
 * supported, selected by the token's own `alg` header, using `JWT_SECRET`.
 * Supabase signs tokens with `aud: "authenticated"` and `sub` set to the
 * user's id — both are checked here.
 */
export async function verifyJwt(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing bearer token." };
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing bearer token." };
  }

  try {
    const { alg } = decodeProtectedHeader(token);
    const { payload } = alg?.startsWith("HS")
      ? await jwtVerify(token, getSecret(), { audience: "authenticated" })
      : await jwtVerify(token, getJwks(), { audience: "authenticated" });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Token has no subject." };
    }
    return { ok: true, userId: payload.sub };
  } catch (err) {
    console.error("verifyJwt failed", err);
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Invalid or expired token." };
  }
}
