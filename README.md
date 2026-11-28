# Punchcard — Clock In / Clock Out

A personal attendance tracker: clock in and out (several sessions a day), take breaks, mark leave, correct mistakes with a full change history, and see monthly logs and reports. Sessions left open are closed automatically at the end of the day and flagged for review.

**Stack:** React 19 + TypeScript + Vite · Tailwind/shadcn · TanStack Query · Netlify Functions · Supabase (Postgres + Auth) · installable PWA.

Live: https://trackmylogs.netlify.app

## Features

- **Dashboard** — Clock In / Start Break / End Break / Clock Out / Clock In again, live timer, day timeline, worked and break totals, Mark leave.
- **Monthly Logs** — every day of the month with weekly and monthly totals, Missed/Weekend/Leave/Needs-review badges, Correct / Add / Leave / Cancel leave / Change history per row.
- **History** — date search, status and "needs review" filters, sorting, pagination (filters live in the URL).
- **Reports** — working days, total/average/longest/shortest day, missed weekdays, leave days, breaks, auto-closed days, hours chart, year heatmap, CSV export.
- **Corrections** — edit a day's sessions and breaks (today and the previous 30 days) with a required reason; every change is audited.
- **Auto-close** — a scheduled job closes sessions still open after their local day ends (at 23:59) and flags the day for review.

## Getting started

Requires Node 22.13+.

```bash
npm install
cp .env.example .env.local      # Supabase URL/keys — see docs/environment-variables.md
npm run netlify:dev             # app + API on http://localhost:8888
```

Run the SQL files in `supabase/migrations/` (in order) in your Supabase project's SQL editor first. Full steps: [docs/deployment-guide.md](docs/deployment-guide.md).

## Scripts

| Command                        |                                                                          |
| ------------------------------ | ------------------------------------------------------------------------ |
| `npm run dev`                  | App + functions locally on :5173 — functions stay warm (fastest)         |
| `npm run netlify:dev`          | Production-like Netlify emulation on :8888 (slow per call on Windows)    |
| `npm run check`                | Typecheck + lint + unit/DB tests                                         |
| `npm test` / `npm run test:tz` | Unit + database tests (once / under three host timezones)                |
| `npm run test:db`              | Database tests only (in-process Postgres via PGlite)                     |
| `npm run test:e2e`             | Playwright end-to-end tests (run `npx playwright install chromium` once) |
| `npm run build`                | Production build                                                         |

## Docs

1. [Architecture](docs/01-architecture.md)
2. [Folder structure](docs/02-folder-structure.md)
3. [Database schema](docs/03-database-schema.md)
4. [API](docs/04-api-design.md)
5. [UI mockups](docs/05-ui-mockups.md)
6. [Option 2 plan — sessions, breaks, corrections, auto-close, leave](docs/06-option2-plan.md)

- [Deployment guide](docs/deployment-guide.md) · [Operations runbook](docs/operations.md) · [Environment variables](docs/environment-variables.md)
