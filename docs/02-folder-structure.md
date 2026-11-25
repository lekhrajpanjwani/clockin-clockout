# Folder Structure

Feature-based structure under `src/`, with a hard boundary between the SPA (`src/`) and the serverless backend (`netlify/functions/`). Shared, framework-free code (types, validation schemas, date/time math) lives in `src/lib/shared` and is imported by _both_ sides — this is what lets client and server validate identically without copy-paste.

```
clockin-clockout/
├── .github/
│   └── workflows/
│       └── ci.yml                     # typecheck, lint, unit (multi-TZ), build, e2e
├── .husky/
│   ├── pre-commit                     # lint-staged
│   └── commit-msg                     # commitlint (conventional commits)
├── docs/
│   ├── 01-architecture.md
│   ├── 02-folder-structure.md
│   ├── 03-database-schema.md
│   ├── 04-api-design.md
│   ├── 05-ui-mockups.md
│   ├── deployment-guide.md
│   └── environment-variables.md
├── public/
│   ├── icons/                         # PWA icons (192/512/maskable)
│   └── manifest.webmanifest
├── supabase/
│   └── migrations/
│       └── 0001_init.sql              # schema + RLS + indexes (this phase)
├── netlify/
│   └── functions/
│       ├── _shared/
│       │   ├── auth.ts                 # verifyJwt(request) -> { userId }
│       │   ├── supabaseAdmin.ts        # service-role client (server-only)
│       │   ├── rateLimit.ts            # fixed-window limiter
│       │   ├── http.ts                 # json(), errorResponse(), dateFromPath()
│       │   ├── validate.ts             # zod-parse-or-400 helper
│       │   ├── attendanceRepo.ts       # reads + att_* database-function wrappers
│       │   ├── dbErrors.ts             # att_raise codes -> HTTP status
│       │   └── breakHandler.ts         # shared POST handler for break start/end
│       ├── clock-in.ts                 # POST /clock-in
│       ├── clock-out.ts                # POST /clock-out
│       ├── break-start.ts              # POST /break/start
│       ├── break-end.ts                # POST /break/end
│       ├── attendance.ts               # GET /attendance (paginated, filters)
│       ├── attendance-today.ts         # GET /attendance/today (+ sessions)
│       ├── attendance-month.ts         # GET /attendance/month
│       ├── attendance-report.ts        # GET /attendance/report
│       ├── attendance-export.ts        # GET /attendance/export (CSV)
│       ├── day-detail.ts               # GET /day/:date
│       ├── day-correct.ts              # PUT /day/:date/sessions (correction)
│       ├── day-audit.ts                # GET /day/:date/audit
│       ├── leave-mark.ts               # POST /leave
│       ├── leave-cancel.ts             # DELETE /leave/:date
│       └── auto-close.ts               # scheduled, every 30 min
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx                      # React Router route table
│   │
│   ├── app/                            # app-wide wiring, not a "feature"
│   │   ├── providers/
│   │   │   ├── QueryProvider.tsx        # TanStack Query client + persistence
│   │   │   ├── ThemeProvider.tsx        # dark/light, respects prefers-color-scheme
│   │   │   └── ErrorBoundary.tsx        # global error boundary
│   │   └── router/
│   │       └── ProtectedRoute.tsx
│   │
│   ├── layouts/
│   │   ├── AuthLayout.tsx
│   │   └── AppLayout.tsx               # sidebar/topbar shell for authenticated pages
│   │
│   ├── pages/                          # route-level components only (thin)
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── MonthlyLogsPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── features/                       # feature-sliced application layer
│   │   ├── auth/
│   │   │   ├── api/ (signIn.ts, signUp.ts, signOut.ts)
│   │   │   ├── hooks/ (useSession.ts)
│   │   │   ├── store/ (authStore.ts — Zustand, persisted)
│   │   │   └── components/ (LoginForm.tsx, SignupForm.tsx)
│   │   ├── attendance/                # (+ correction/ and leave/ sub-folders below)
│   │   │   ├── api/ (clockIn.ts, clockOut.ts, getToday.ts, getAttendance.ts, getMonth.ts, getReport.ts, exportCsv.ts)
│   │   │   ├── hooks/ (useClockIn.ts, useClockOut.ts, useToday.ts, useAttendanceList.ts, useMonthly.ts, useReport.ts)
│   │   │   ├── store/ (sessionTimerStore.ts — Zustand, drives the live ticking timer)
│   │   │   └── components/
│   │   │       ├── ClockCard.tsx
│   │   │       ├── SessionTimer.tsx
│   │   │       ├── StatCard.tsx
│   │   │       ├── MonthlyTable.tsx
│   │   │       ├── HistoryTable.tsx
│   │   │       ├── YearMonthPicker.tsx
│   │   │       ├── ReportSummary.tsx
│   │   │       ├── HeatmapCalendar.tsx        # bonus
│   │   │       ├── HoursChart.tsx             # dependency-free SVG bar chart
│   │   │       └── ExportButton.tsx
│   │   └── settings/
│   │       └── components/ (ThemeToggle.tsx, ProfileCard.tsx)
│   │
│   ├── components/                     # generic, feature-agnostic UI
│   │   ├── ui/                         # shadcn/ui generated primitives (button, card, dialog, table, ...)
│   │   ├── skeletons/ (CardSkeleton.tsx, TableSkeleton.tsx)
│   │   ├── feedback/ (Toaster.tsx, ConfirmDialog.tsx, NetworkErrorBanner.tsx)
│   │   └── icons/ (re-exports from lucide-react, kept in one place)
│   │
│   ├── hooks/                           # cross-feature generic hooks
│   │   ├── useOnlineStatus.ts
│   │   ├── useKeyboardShortcut.ts
│   │   └── useLocalTimezone.ts
│   │
│   ├── store/                           # app-level Zustand stores (not feature-owned)
│   │   └── uiStore.ts                   # sidebar open/closed, theme preference
│   │
│   ├── services/                        # infrastructure clients
│   │   ├── supabaseClient.ts            # browser Supabase client (anon key)
│   │   └── httpClient.ts                # fetch wrapper: attaches JWT, base URL, error normalization
│   │
│   ├── lib/
│   │   └── shared/                      # imported by src/** AND netlify/functions/**
│   │       ├── schemas/                 # zod schemas (ClockInSchema, DateRangeSchema, ...)
│   │       ├── types/                   # AttendanceRecord, AttendanceStatus, ReportSummary, ...
│   │       └── time/                    # pure functions: toUtc, toLocal, computeWorkedMinutes, isSameLocalDay
│   │
│   ├── utils/                           # small generic helpers (formatMinutes, csvBuilder, cn())
│   ├── constants/                       # ROUTES, QUERY_KEYS, RATE_LIMITS, API_BASE
│   └── types/                           # ambient/global TS types (vite-env.d.ts augmentation)
│
├── tests/
│   ├── unit/                           # Vitest: time math, aggregation, CSV, schemas (run under several TZs)
│   └── e2e/                            # Playwright: app.spec.ts + mockApi.ts (fake session, in-memory /api/*)
│
├── .env.example
├── eslint.config.js
├── playwright.config.ts
├── .prettierrc
├── commitlint.config.cjs
├── netlify.toml
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Why this split, specifically

- **`lib/shared` is the load-bearing idea.** Netlify Functions run as separate Node processes from the SPA, but both import the same `src/lib/shared` Zod schemas and time-math functions (Vite and esbuild — which Netlify Functions bundle with — both handle plain TS imports fine). This is what makes "validate identically on client and server" true in practice rather than just in the architecture doc.
- **`features/*` own their vertical slice** (api call → hook → component) so adding "Reports" later never requires touching `features/auth`. `pages/*` stay thin — they compose feature components, they don't contain logic.
- **`netlify/functions/_shared`** mirrors the same DRY principle server-side: JWT verification, rate limiting, and error formatting are written once and imported by every function file, not copy-pasted seven times.
- **`components/ui`** is exactly shadcn/ui's convention (generated, owned, editable source — not a black-box dependency), kept separate from feature-specific components so it's obvious what's a generic primitive vs. domain UI.

## Option 2 additions

- `src/features/attendance/correction/` — `CorrectionDialog` (session/break editor with live totals and validation), `AuditDialog` (change history), `DayActions` (row buttons), `draft.ts` (wall-clock ↔ ISO conversion).
- `src/features/attendance/leave/` — `LeaveDialog`, `CancelLeaveButton`.
- `src/features/attendance/components/` — `DayTimeline`, `ReviewBadge`, `ReviewBanner` joined the existing components.
- `src/lib/shared/aggregate/day.ts` — TypeScript mirror of the database's day-total and correction rules (`computeDayTotals`, `liveDayTotals`, `validateCorrection`).
- `supabase/migrations/0003_sessions_breaks_audit.sql` and `tests/db/` (PGlite-based database tests).
