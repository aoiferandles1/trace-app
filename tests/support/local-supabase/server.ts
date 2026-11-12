/**
 * A local stand-in for the Supabase project, for the end-to-end tests:
 * PGlite with every migration (db.ts), and the HTTP parts of Supabase that
 * Trace calls: Auth (auth.ts), PostgREST (rest.ts) and Realtime
 * (realtime.ts). See README.md in this folder.
 *
 *   node tests/support/local-supabase/server.ts
 *
 * Settings come from the environment (playwright.config.ts passes them from
 * tests/support/local-env.ts): E2E_SUPABASE_PORT, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * PORTAL_SERVER_SECRET, LOCAL_JWT_SECRET, LOCAL_EMAIL_CODE.
 *
 * Test-only endpoints, on 127.0.0.1 only:
 *   GET  /__test/health            200 once the migrations are in
 *   POST /__test/sql {sql, params}  runs SQL as the database owner and returns { rows }
 */
import { createServer } from "node:http";
import { createDatabase } from "./db.ts";
import { handleAuth } from "./auth.ts";
import { corsHeaders, makeQueue, readBody, send, type Context } from "./context.ts";
import { createRealtime, REALTIME_SQL } from "./realtime.ts";
import { handleRest } from "./rest.ts";

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`local-supabase: ${name} is not set`);
  return value;
}

const port = Number(process.env.E2E_SUPABASE_PORT ?? 54329);
const started = Date.now();
const db = await createDatabase({ portalSecret: need("PORTAL_SERVER_SECRET") });
await db.exec(`set timezone = 'UTC';\n${REALTIME_SQL}`);

const ctx: Context = {
  db,
  url: `http://127.0.0.1:${port}`,
  publishableKey: need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  jwtSecret: need("LOCAL_JWT_SECRET"),
  emailCode: need("LOCAL_EMAIL_CODE"),
  exclusive: makeQueue(),
};
const realtime = createRealtime(ctx);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ctx.url);
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }
    if (url.pathname === "/__test/health") return send(req, res, 200, { ok: true });
    if (url.pathname === "/__test/sql" && req.method === "POST") {
      const { sql, params } = JSON.parse(await readBody(req)) as { sql: string; params?: unknown[] };
      try {
        const r = await ctx.exclusive(() => (params?.length ? db.query(sql, params) : db.exec(sql).then((all) => all.at(-1)!)));
        return send(req, res, 200, { rows: r?.rows ?? [] });
      } catch (error) {
        const e = error as { code?: string; message?: string };
        return send(req, res, 400, { code: e.code ?? null, message: e.message ?? String(error) });
      }
    }
    if (url.pathname.startsWith("/rest/v1/")) return await handleRest(ctx, req, res, url);
    if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(ctx, req, res, url);
    if (url.pathname.startsWith("/storage/v1/")) {
      return send(req, res, 404, { statusCode: "404", error: "not_found", message: "Storage is not part of the local stand-in" });
    }
    send(req, res, 404, { message: `No route for ${req.method} ${url.pathname} in the local stand-in` });
  } catch (error) {
    console.error("[local-supabase]", req.method, url.pathname, error);
    if (!res.headersSent) send(req, res, 500, { message: String(error) });
  }
});
server.on("upgrade", (req, socket) => realtime.upgrade(req, socket, new URL(req.url ?? "/", ctx.url)));
server.keepAliveTimeout = 65_000;
server.listen(port, "127.0.0.1", () => {
  console.log(`[local-supabase] ready on ${ctx.url} in ${Date.now() - started} ms`);
});

function stop() {
  realtime.close();
  server.close();
  void db.close().finally(() => process.exit(0));
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
