/**
 * Error tracking — opt-in. Nothing happens unless VITE_SENTRY_DSN is set at
 * build time; then a minimal @sentry/browser client is loaded lazily (its own chunk, so the
 * Dashboard bundle doesn't grow for deployments without Sentry).
 *
 * Privacy: no session replay, no performance tracing; the
 * user is identified by their opaque Supabase user id only, and anything
 * that looks like an email address is scrubbed before an event is sent.
 */
type SentryApi = Pick<typeof import("@sentry/browser"), "setUser" | "captureException">;

let sentry: SentryApi | null = null;
let pendingUserId: string | null | undefined;
// Errors raised before the SDK finished loading (e.g. a failed API call on
// first render) are held here and sent once it's ready. Capped, and only
// collected when a DSN is configured.
const queued: [unknown, Record<string, unknown> | undefined][] = [];
const MAX_QUEUED = 20;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Recursively replaces email-looking substrings in strings (pure; exported for tests). */
export function scrubPii<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === "string") return value.replace(EMAIL, "[email]") as T;
  if (Array.isArray(value)) return value.map((v) => scrubPii(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubPii(v, depth + 1);
    return out as T;
  }
  return value;
}

export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || sentry) return;
  try {
    // Minimal client instead of the SDK's `init()` defaults: only error
    // capture integrations, so the lazily-loaded chunk stays small.
    const {
      BrowserClient,
      defaultStackParser,
      makeFetchTransport,
      getCurrentScope,
      breadcrumbsIntegration,
      globalHandlersIntegration,
      linkedErrorsIntegration,
      dedupeIntegration,
      setUser,
      captureException,
    } = await import("@sentry/browser");
    const client = new BrowserClient({
      dsn,
      environment: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
      release: import.meta.env.VITE_APP_RELEASE || undefined,
      transport: makeFetchTransport,
      stackParser: defaultStackParser,
      integrations: [
        breadcrumbsIntegration(),
        globalHandlersIntegration(),
        linkedErrorsIntegration(),
        dedupeIntegration(),
      ],
      tracesSampleRate: 0,
      beforeSend: (event) => {
        // Keep the user reference to its id only.
        if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
        return scrubPii(event);
      },
      beforeBreadcrumb: (crumb) => scrubPii(crumb),
    });
    getCurrentScope().setClient(client);
    client.init();
    sentry = { setUser, captureException };
    if (pendingUserId !== undefined) setUser(pendingUserId ? { id: pendingUserId } : null);
    for (const [error, context] of queued.splice(0)) captureError(error, context);
  } catch (err) {
    console.warn("Error tracking could not start", err);
  }
}

/** Associates subsequent events with a user id (or clears it on sign-out). */
export function setMonitoringUser(userId: string | null): void {
  pendingUserId = userId;
  sentry?.setUser(userId ? { id: userId } : null);
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) {
    if (import.meta.env.VITE_SENTRY_DSN && queued.length < MAX_QUEUED) queued.push([error, context]);
    return;
  }
  sentry.captureException(error, context ? { extra: scrubPii(context) } : undefined);
}
