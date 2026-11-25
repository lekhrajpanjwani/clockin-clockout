import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run the real SPA against a mocked /api/* (see tests/e2e/mockApi.ts)
 * and a fake, pre-seeded Supabase session — no live Supabase project or
 * Netlify Functions needed, so they're deterministic and safe for CI.
 */
const PORT = 5174;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: "https://e2etest.supabase.co",
      VITE_SUPABASE_ANON_KEY: "e2e-anon-key",
    },
  },
});
