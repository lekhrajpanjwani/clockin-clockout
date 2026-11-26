/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Sentry DSN — error tracking is off unless this is set (see docs/operations.md). */
  readonly VITE_SENTRY_DSN?: string;
  /** e.g. "production" / "deploy-preview"; defaults to Vite's mode. */
  readonly VITE_APP_ENV?: string;
  /** Build identifier (git commit) injected by vite.config.ts. */
  readonly VITE_APP_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
