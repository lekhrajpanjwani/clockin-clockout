# Deployment guide

## 1. Supabase

1. Create a project at <https://supabase.com> (free tier).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_attendance_refinements.sql`
   - `supabase/migrations/0003_sessions_breaks_audit.sql` — sessions, breaks, audit log, leave; enables `btree_gist` and moves existing days into sessions (totals unchanged)
3. **Authentication → Providers → Email**: enable email/password. Decide whether email confirmation is required.
4. **Authentication → URL configuration**: set _Site URL_ to your Netlify URL and add it to _Redirect URLs_.
5. **Project Settings → API**: copy the project URL, the anon key and the service-role key.

## 2. Netlify

1. **Add new site → Import from Git**, pick this repo. Build settings come from `netlify.toml` (`npm run build`, publish `dist`, functions in `netlify/functions`).
2. Add the environment variables from [environment-variables.md](environment-variables.md).
3. Deploy. Functions are exposed at `/api/*` through their own `config.path` — no redirect rules needed.

## 3. Local development

Requires **Node 22.13+** (Node 22 or 24 LTS recommended; newer releases are supported via the shim below).

> `tools/buffer-equal-constant-time/` is a tiny local replacement for an old
> netlify-cli sub-dependency that crashes on Node 25+ (it uses the removed
> `SlowBuffer` API). It is wired in through `overrides` in `package.json`;
> remove both once netlify-cli stops depending on it.

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run netlify:dev           # Vite + functions on http://localhost:8888
```

`npm run dev` alone serves **only the SPA** on :5173 and proxies `/api` to a functions server on :9999 — start that in a second terminal with `npm run dev:api`. If it isn't running, every `/api` call returns `503 API_UNAVAILABLE` (the toast says how to fix it). The simplest option is `npm run netlify:dev`, which runs both on http://localhost:8888.

## 4. Quality gates

| Command            | What it does                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `npm run check`    | typecheck + lint + unit tests                                                                        |
| `npm test`         | Vitest unit tests (`tests/unit`)                                                                     |
| `npm run test:tz`  | Unit tests under UTC, IST and US Pacific host timezones                                              |
| `npm run test:e2e` | Playwright e2e (`tests/e2e`) against a mocked API — run `npx playwright install chromium` once first |

CI (`.github/workflows/ci.yml`) runs all of the above on every push to `main` and on pull requests. Connect the repo to Netlify for automatic deploy previews on PRs and production deploys from `main`.

## 5. Scheduled auto-close

`netlify/functions/auto-close.ts` runs every 30 minutes on the deployed site (Netlify → Logs → Functions → `auto-close` shows each run and "closed N session(s)"). It needs migration `0003` and the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` variables. Scheduled functions don't run under `netlify dev`; trigger it by hand with `npx netlify functions:invoke auto-close`. Running it repeatedly is safe — it only closes sessions whose local day is already over.

## 6. PWA

The build emits `sw.js` and `manifest.webmanifest`. After deploying, open the site in Chrome/Edge and use **Install app**. A new deploy is picked up automatically on the next visit (`registerType: "autoUpdate"`).
