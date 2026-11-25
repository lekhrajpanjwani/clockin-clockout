import type { Page, Route } from "@playwright/test";
import type { AttendanceRecord, AttendanceSession, AuditEntry } from "../../src/lib/shared/types/attendance";
import type { RegularizeInput } from "../../src/lib/shared/schemas/attendance";
import { computeDayTotals, validateCorrection } from "../../src/lib/shared/aggregate/day";
import { computeReport, groupByWeek, sumWorkedMinutes } from "../../src/lib/shared/aggregate/attendance";
import {
  datePrefixToRange,
  firstDayOfMonth,
  lastDayOfMonth,
  localDateString,
} from "../../src/lib/shared/time/attendance";

const TZ = "Asia/Kolkata";

/** Seeds a fake Supabase session in localStorage so the app boots signed in.
 * The storage key is `sb-<project-ref>-auth-token`, matching
 * VITE_SUPABASE_URL=https://e2etest.supabase.co in playwright.config.ts. */
export async function signIn(page: Page) {
  const session = {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
    user: {
      id: "user-1",
      email: "e2e@example.com",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  };
  await page.addInitScript((value) => {
    localStorage.setItem("sb-e2etest-auth-token", value);
  }, JSON.stringify(session));
  // Supabase may try to refresh/verify in the background — answer harmlessly.
  await page.route("https://e2etest.supabase.co/**", (route) => route.fulfill({ status: 200, json: {} }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** In-memory stand-in for the Netlify Functions, implementing the same
 * contract as docs/04-api-design.md using the real shared aggregation code. */
export async function mockApi(page: Page, seed: AttendanceRecord[] = []) {
  const records: AttendanceRecord[] = [...seed];
  const today = () => localDateString(new Date(), TZ);
  const sessions = new Map<string, AttendanceSession[]>();
  let seq = 0;
  const audit: AuditEntry[] = [];
  const blankDay = (date: string): AttendanceRecord => ({
    id: `r-${records.length + 1}-${date}`,
    workDate: date,
    clockIn: null,
    clockOut: null,
    timezone: TZ,
    workedMinutes: 0,
    breakMinutes: 0,
    status: "working",
    leaveReason: null,
    autoClosed: false,
    needsReview: false,
  });
  // Seeded (completed) days get one session matching their clock in/out.
  const sessionsOf = (rec: AttendanceRecord): AttendanceSession[] => {
    if (!sessions.has(rec.id)) {
      sessions.set(
        rec.id,
        rec.clockIn
          ? [
              {
                id: `s-${rec.id}`,
                clockIn: rec.clockIn,
                clockOut: rec.clockOut,
                closedBy: "user",
                breaks: [],
              },
            ]
          : [],
      );
    }
    return sessions.get(rec.id)!;
  };
  /** Same rules as the database's att_recalc_day(), via the shared TS mirror. */
  const recalc = (rec: AttendanceRecord) => {
    const t = computeDayTotals(sessionsOf(rec));
    Object.assign(rec, t);
  };

  // Match on the pathname: a "**/api/**" glob would also swallow Vite dev
  // module requests such as /src/features/attendance/api/clockIn.ts.
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname;
      const q = url.searchParams;

      const err = (code: string, message: string, status = 409) =>
        json(route, { error: { code, message } }, status);
      const active = () => records.find((r) => r.status === "working" || r.status === "on_break");
      const detail = (rec: AttendanceRecord) => ({ day: rec, sessions: sessionsOf(rec) });

      if (path === "/api/clock-in" && req.method() === "POST") {
        if (active()) return err("ALREADY_CLOCKED_IN", "You are already clocked in. Clock out first.");
        let rec = records.find((r) => r.workDate === today());
        if (rec?.status === "leave") return err("ON_LEAVE", "This day is marked as leave.");
        if (!rec) {
          rec = {
            id: `r-${records.length + 1}`,
            workDate: today(),
            clockIn: null,
            clockOut: null,
            timezone: TZ,
            workedMinutes: 0,
            breakMinutes: 0,
            status: "working",
            leaveReason: null,
            autoClosed: false,
            needsReview: false,
          };
          records.push(rec);
        }
        sessionsOf(rec).push({
          id: `s-${++seq}`,
          clockIn: new Date().toISOString(),
          clockOut: null,
          closedBy: null,
          breaks: [],
        });
        recalc(rec);
        return json(route, rec, 201);
      }

      if (path === "/api/clock-out" && req.method() === "POST") {
        const rec = active();
        if (!rec) return err("NOT_CLOCKED_IN", "No open session to clock out of.");
        const nowIso = new Date().toISOString();
        const open = sessionsOf(rec).find((x) => x.clockOut === null)!;
        for (const b of open.breaks) if (b.breakEnd === null) b.breakEnd = nowIso;
        open.clockOut = nowIso;
        open.closedBy = "user";
        recalc(rec);
        return json(route, rec);
      }

      if (path === "/api/break/start" && req.method() === "POST") {
        const rec = active();
        if (!rec) return err("NOT_CLOCKED_IN", "Clock in before starting a break.");
        if (rec.status === "on_break") return err("ALREADY_ON_BREAK", "You are already on a break.");
        sessionsOf(rec)
          .find((x) => x.clockOut === null)!
          .breaks.push({ id: `b-${++seq}`, breakStart: new Date().toISOString(), breakEnd: null });
        recalc(rec);
        return json(route, detail(rec));
      }

      if (path === "/api/break/end" && req.method() === "POST") {
        const rec = active();
        if (rec?.status !== "on_break") return err("NOT_ON_BREAK", "You are not on a break.");
        for (const sess of sessionsOf(rec))
          for (const b of sess.breaks) if (b.breakEnd === null) b.breakEnd = new Date().toISOString();
        recalc(rec);
        return json(route, detail(rec));
      }

      if (path === "/api/leave" && req.method() === "POST") {
        const body = JSON.parse(req.postData() ?? "{}") as { date: string; reason: string };
        if (body.date < today())
          return err("LEAVE_DATE_IN_PAST", "Leave can be marked for today or a future date.", 400);
        const existing = records.find((r) => r.workDate === body.date);
        if (existing?.status === "leave")
          return err("ALREADY_ON_LEAVE", "This day is already marked as leave.");
        if (existing) return err("DAY_HAS_ATTENDANCE", "You already have attendance on this day.");
        const rec: AttendanceRecord = {
          ...blankDay(body.date),
          status: "leave",
          leaveReason: body.reason.trim(),
        };
        records.push(rec);
        sessions.set(rec.id, []);
        return json(route, { day: rec, sessions: [] }, 201);
      }

      const leaveMatch = /^\/api\/leave\/(\d{4}-\d{2}-\d{2})$/.exec(path);
      if (leaveMatch && req.method() === "DELETE") {
        const rec = records.find((r) => r.workDate === leaveMatch[1] && r.status === "leave");
        if (!rec) return err("NOT_ON_LEAVE", "This day is not marked as leave.");
        records.splice(records.indexOf(rec), 1);
        return json(route, { cancelled: leaveMatch[1] });
      }

      const dayMatch = /^\/api\/day\/(\d{4}-\d{2}-\d{2})(\/sessions|\/audit)?$/.exec(path);
      if (dayMatch) {
        const [, date, sub] = dayMatch as unknown as [string, string, string | undefined];
        const rec = records.find((r) => r.workDate === date) ?? null;
        if (!sub && req.method() === "GET")
          return json(route, { day: rec, sessions: rec ? sessionsOf(rec) : [] });
        if (sub === "/audit")
          return json(route, { items: audit.filter((a) => a.workDate === date).reverse() });
        if (sub === "/sessions" && req.method() === "PUT") {
          const body = JSON.parse(req.postData() ?? "{}") as RegularizeInput;
          const issues = validateCorrection(body.sessions, {
            workDate: date,
            timezone: body.timezone,
            now: new Date(),
          });
          if (issues.length) return err(issues[0]!.code, issues[0]!.message, 400);
          const before = rec ? structuredClone({ day: rec, sessions: sessionsOf(rec) }) : null;
          let target = rec;
          if (body.sessions.length === 0) {
            if (rec) records.splice(records.indexOf(rec), 1);
            target = null;
          } else {
            if (!target) {
              target = { ...blankDay(date), status: "completed" };
              records.push(target);
            }
            sessions.set(
              target.id,
              body.sessions.map((x) => ({
                id: `s-${++seq}`,
                clockIn: new Date(x.clockIn).toISOString(),
                clockOut: new Date(x.clockOut).toISOString(),
                closedBy: "correction" as const,
                breaks: x.breaks.map((b) => ({
                  id: `b-${++seq}`,
                  breakStart: new Date(b.breakStart).toISOString(),
                  breakEnd: new Date(b.breakEnd).toISOString(),
                })),
              })),
            );
            target.needsReview = false;
            recalc(target);
          }
          const after = target ? { day: target, sessions: sessionsOf(target) } : null;
          audit.push({
            id: audit.length + 1,
            workDate: date,
            action: "regularize",
            actor: "user",
            reason: body.reason,
            before,
            after: structuredClone(after),
            createdAt: new Date().toISOString(),
          });
          return json(route, after ?? { day: null, sessions: [] });
        }
      }

      if (path === "/api/attendance/today") {
        const rec = active() ?? records.find((r) => r.workDate === today()) ?? null;
        return json(route, { record: rec, sessions: rec ? sessionsOf(rec) : [] });
      }

      if (path === "/api/attendance/month") {
        const year = Number(q.get("year"));
        const month = Number(q.get("month"));
        const from = firstDayOfMonth(year, month);
        const to = lastDayOfMonth(year, month);
        const days = records
          .filter((r) => r.workDate >= from && r.workDate <= to)
          .sort((a, b) => a.workDate.localeCompare(b.workDate));
        return json(route, {
          year,
          month,
          days,
          weeklyTotals: groupByWeek(days),
          monthlyTotalMinutes: sumWorkedMinutes(days),
        });
      }

      if (path === "/api/attendance/report") {
        const year = Number(q.get("year"));
        const month = q.get("month") ? Number(q.get("month")) : null;
        const from = month ? firstDayOfMonth(year, month) : `${year}-01-01`;
        const to = month ? lastDayOfMonth(year, month) : `${year}-12-31`;
        const inRange = records.filter((r) => r.workDate >= from && r.workDate <= to);
        return json(route, computeReport(inRange, from, to, year, month, today()));
      }

      if (path === "/api/attendance/export") {
        return route.fulfill({ status: 200, contentType: "text/csv", body: "Date,Clock In\r\n" });
      }

      if (path === "/api/attendance") {
        let items = [...records];
        const status = q.get("status");
        if (status) items = items.filter((r) => r.status === status);
        if (q.get("needsReview") === "true") items = items.filter((r) => r.needsReview);
        const range = q.get("search") ? datePrefixToRange(q.get("search") ?? "") : null;
        if (range) items = items.filter((r) => r.workDate >= range.dateFrom && r.workDate <= range.dateTo);
        if (q.get("dateFrom")) items = items.filter((r) => r.workDate >= (q.get("dateFrom") ?? ""));
        if (q.get("dateTo")) items = items.filter((r) => r.workDate <= (q.get("dateTo") ?? ""));
        const key = q.get("sortBy") === "workedMinutes" ? "workedMinutes" : "workDate";
        const dir = q.get("sortDir") === "asc" ? 1 : -1;
        items.sort(
          (a, b) =>
            String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true }) * dir,
        );
        const page = Number(q.get("page") ?? 1);
        const pageSize = Number(q.get("pageSize") ?? 20);
        return json(route, {
          items: items.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalItems: items.length,
          totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
        });
      }

      return json(route, { error: { code: "NOT_FOUND", message: path } }, 404);
    },
  );

  return records;
}

/** A completed session on `workDate`, 09:00–(09:00 + minutes) IST. */
export function completed(workDate: string, minutes: number, id = workDate): AttendanceRecord {
  const clockIn = new Date(`${workDate}T09:00:00+05:30`);
  return {
    id,
    workDate,
    clockIn: clockIn.toISOString(),
    clockOut: new Date(clockIn.getTime() + minutes * 60000).toISOString(),
    timezone: TZ,
    workedMinutes: minutes,
    breakMinutes: 0,
    status: "completed",
    leaveReason: null,
    autoClosed: false,
    needsReview: false,
  };
}
