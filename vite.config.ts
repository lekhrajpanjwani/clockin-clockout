import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";
import { netlifyFunctionsDev } from "./netlify/dev/viteApiPlugin";

export default defineConfig({
  define: {
    // Release tag for error reports: Netlify sets COMMIT_REF during builds.
    "import.meta.env.VITE_APP_RELEASE": JSON.stringify(process.env.COMMIT_REF?.slice(0, 12) ?? ""),
  },
  plugins: [
    react(),
    tsconfigPaths(),
    // Serves /api/* from netlify/functions in-process during `npm run dev`.
    // Set API_PROXY=1 to forward to `npm run dev:api` (:9999) instead.
    ...(process.env.API_PROXY ? [] : [netlifyFunctionsDev()]),
    // Installable PWA: precaches the app shell so the UI opens instantly and
    // offline. /api/* is deliberately NOT cached — attendance data is
    // per-user and must never be served stale from a shared device's cache;
    // the UI shows an offline banner and disables Clock In/Out instead.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Punchcard — Attendance Tracker",
        short_name: "Punchcard",
        description: "A personal clock in / clock out attendance tracker.",
        theme_color: "#c08a3e",
        background_color: "#f3efe7",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Don't make every install download the (optional) error-tracking SDK.
        globIgnores: ["**/sentry-*.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: "NetworkOnly" }],
      },
    }),
  ],
  server: {
    // Fixed, not read from `process.env.PORT`: `netlify dev` (see [dev] in
    // netlify.toml) expects Vite on this exact port (`targetPort`) and owns
    // port 8888 itself for its own proxy — if this read a generic PORT env
    // var instead, an unrelated tool setting PORT=8888 for its own purposes
    // would make Vite bind Netlify Dev's own port and break function routing
    // entirely (exactly what happened once during Phase 5/6 live testing).
    port: 5173,
    strictPort: true,
    proxy: {
      // Netlify Functions run separately from Vite's dev server; `netlify dev`
      // proxies both under one origin in production-like setups, but for a
      // plain `vite dev` loop this forwards /api/* to `netlify functions:serve`
      // (see docs/deployment-guide.md) so the frontend never hardcodes a port.
      "/api": {
        target: "http://localhost:9999",
        changeOrigin: true,
        // When nothing is listening on :9999 (functions server not started),
        // Vite's default is a bare `500 text/plain` for every /api call, which
        // looks like a backend bug. Answer with the app's normal error shape
        // and an actionable message instead. Registered before Vite's own
        // handler, so Vite sees the response already sent and skips its 500.
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            const code = (err as NodeJS.ErrnoException).code;
            if (!("writeHead" in res) || res.headersSent) return;
            res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({
                error: {
                  code: "API_UNAVAILABLE",
                  message:
                    code === "ECONNREFUSED"
                      ? "API server is not running. Use `npm run netlify:dev` (http://localhost:8888), or run `npm run dev:api` alongside `npm run dev`."
                      : `API proxy error: ${err.message}`,
                },
              }),
            );
          });
        },
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't bust the cache for
        // React/Supabase, which change far less often than app code.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query", "zustand"],
          // Only downloaded when VITE_SENTRY_DSN is set (src/lib/monitoring.ts),
          // after first paint, and kept out of the PWA precache below.
          sentry: ["@sentry/browser"],
        },
      },
    },
  },
});
