import { readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";

/**
 * Serves the Netlify Functions in `netlify/functions` from inside the Vite
 * dev server, so `npm run dev` alone gives a working app at :5173.
 *
 * Why not `netlify functions:serve`? The Netlify CLI runs every v2 function
 * call in a brand-new worker thread that re-imports the function and its
 * dependencies from disk — roughly 900 file opens per request. That costs
 * ~250 ms on Linux but 8–20 s on Windows (antivirus scans each file), so
 * every API call felt broken locally while production (warm functions) was
 * fast. Here each function is loaded once through Vite's SSR module graph
 * and stays warm, like in production; editing a function reloads it.
 *
 * Only what this app uses is emulated: `config.path` routing (with `:param`
 * segments) and the `(req: Request) => Response` handler. Scheduled
 * functions (no `path`) are skipped. `netlify dev` / `npm run dev:api`
 * still work for production-like checks.
 */

interface Route {
  file: string;
  pattern: RegExp;
}

type FunctionModule = {
  default?: (req: Request, context: unknown) => Promise<Response> | Response;
  config?: { path?: string | string[] };
};

function toPattern(routePath: string): RegExp {
  const escaped = routePath
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${escaped}/?$`);
}

async function loadRoutes(server: ViteDevServer, dir: string): Promise<Route[]> {
  const files = readdirSync(dir).filter((f) => /\.(ts|mts|js|mjs)$/.test(f));
  const routes: Route[] = [];
  for (const f of files) {
    const file = path.join(dir, f);
    const mod = (await server.ssrLoadModule(file)) as FunctionModule;
    const paths = mod.config?.path;
    for (const p of Array.isArray(paths) ? paths : paths ? [paths] : []) {
      routes.push({ file, pattern: toPattern(p) });
    }
  }
  return routes;
}

async function toRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const method = req.method ?? "GET";
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, ...(body?.length ? { body: new Uint8Array(body) } : {}) });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function netlifyFunctionsDev(): Plugin {
  return {
    name: "punchcard:netlify-functions-dev",
    apply: "serve",
    configureServer(server) {
      // Functions read server-side secrets from process.env (the Netlify CLI
      // loads .env for them). Mirror that without overriding the real env.
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      const dir = path.resolve(server.config.root, "netlify/functions");
      let routes: Promise<Route[]> | null = null;
      // A new or edited function may change its `config.path`.
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(dir)) routes = null;
      });

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        try {
          routes ??= loadRoutes(server, dir);
          const route = (await routes).find((r) => r.pattern.test(url.pathname));
          if (!route) {
            return send(
              res,
              Response.json(
                { error: { code: "NOT_FOUND", message: `No function for ${url.pathname}` } },
                { status: 404 },
              ),
            );
          }
          const mod = (await server.ssrLoadModule(route.file)) as FunctionModule;
          if (typeof mod.default !== "function") throw new Error(`${route.file} has no default export`);
          await send(res, await mod.default(await toRequest(req, url), {}));
        } catch (err) {
          routes = null;
          if (err instanceof Error) server.ssrFixStacktrace(err);
          server.config.logger.error(
            `[api] ${req.method} ${url.pathname} failed:\n${String((err as Error)?.stack ?? err)}`,
          );
          if (!res.headersSent) {
            await send(
              res,
              Response.json(
                { error: { code: "INTERNAL", message: "Function crashed — see the dev server log." } },
                { status: 500 },
              ),
            );
          }
        }
      });
    },
  };
}
