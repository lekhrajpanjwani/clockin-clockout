# Environment variables

Copy `.env.example` to `.env.local` for local development. In production, set the same keys in **Netlify → Site configuration → Environment variables**.

| Variable                 | Used by           | Secret?               | Description                                                                                                                       |
| ------------------------ | ----------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Browser bundle    | No                    | Supabase project URL, e.g. `https://abcd1234.supabase.co`.                                                                        |
| `VITE_SUPABASE_ANON_KEY` | Browser bundle    | No (public by design) | Supabase anon key. Safe to ship: RLS restricts every row to its owner.                                                            |
| `SUPABASE_URL`           | Netlify Functions | No                    | Same URL as above, read server-side.                                                                                              |
| `SUPABASE_SERVICE_ROLE`  | Netlify Functions | **Yes**               | Service-role key — bypasses RLS. Never prefix with `VITE_`, never commit it.                                                      |
| `JWT_SECRET`             | Netlify Functions | **Yes**               | Only for projects still on the legacy HS256 JWT secret. Current projects sign with ES256 and are verified via JWKS — leave unset. |

Rules:

- Only `VITE_`-prefixed variables reach the browser. Anything else is server-only.
- `.env`, `.env.local` and `.env.*.local` are git-ignored. Keep it that way.
- E2E tests and CI builds use placeholder Supabase values (see `playwright.config.ts` and `.github/workflows/ci.yml`) — they never need real credentials.

GitHub Actions secrets (not Netlify): `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` for the weekly backup — see [operations.md](operations.md#5-database-backups).
