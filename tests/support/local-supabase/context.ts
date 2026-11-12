import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyJwt } from "./jwt.ts";

/** What every part of the stand-in shares: the database, one queue, the keys. */
export type Context = {
  db: PGlite;
  url: string;
  publishableKey: string;
  jwtSecret: string;
  emailCode: string;
  /** Runs `fn` alone: PGlite is one connection, so requests take turns. */
  exclusive<T>(fn: () => Promise<T>): Promise<T>;
};

export function makeQueue(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

/** Who is calling: PostgREST's role and the claims it puts in `request.jwt.claims`. */
export type Caller = { role: "anon" | "authenticated" | "service_role"; claims: Record<string, unknown> };

export type HttpError = { status: number; body: Record<string, unknown> };

export function isHttpError(x: unknown): x is HttpError {
  return Boolean(x && typeof x === "object" && "status" in x && "body" in x);
}

/** The API gateway's key check, then the bearer token, as PostgREST reads it. */
export function callerOf(ctx: Context, req: IncomingMessage, url: URL): Caller | HttpError {
  const apikey = (req.headers.apikey as string | undefined) ?? url.searchParams.get("apikey") ?? undefined;
  if (!apikey) {
    return { status: 401, body: { message: "No API key found in request", hint: "No `apikey` request header or url param was found." } };
  }
  if (apikey !== ctx.publishableKey) {
    return { status: 401, body: { message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." } };
  }
  const auth = req.headers.authorization;
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token || token === ctx.publishableKey) return { role: "anon", claims: { role: "anon" } };
  const result = verifyJwt(token, ctx.jwtSecret);
  if (!result.ok) {
    return result.reason === "expired"
      ? { status: 401, body: { code: "PGRST303", details: null, hint: null, message: "JWT expired" } }
      : { status: 401, body: { code: "PGRST301", details: null, hint: null, message: "No suitable key or wrong key type" } };
  }
  const role = result.claims.role;
  if (role !== "anon" && role !== "authenticated" && role !== "service_role") {
    return { status: 401, body: { code: "PGRST301", details: null, hint: null, message: "Unknown role" } };
  }
  return { role, claims: result.claims };
}

/** One transaction as the caller, the way PostgREST runs every request. */
export async function asCaller<T>(ctx: Context, caller: Caller, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return ctx.exclusive(() =>
    ctx.db.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [
        caller.role,
        JSON.stringify(caller.claims),
      ]);
      return fn(tx);
    }),
  );
}

/** PostgREST's HTTP status for a Postgres error (its documented SQLSTATE table, the parts Trace can meet). */
export function statusForSqlState(code: string | undefined, role: Caller["role"]): number {
  if (!code) return 500;
  if (code === "42501") return role === "anon" ? 401 : 403;
  if (code === "42883" || code === "42P01") return 404;
  if (code === "23503" || code === "23505") return 409;
  if (code === "25006") return 405;
  if (code === "P0001") return 400;
  if (code === "42P17") return 500;
  if (/^(08|53)/.test(code)) return 503;
  if (code === "54000" || /^54/.test(code)) return 413;
  if (/^(09|0L|0P|25|2D|38|39|3B|40|55|57|58|F0|HV|P0|XX)/.test(code)) return code.startsWith("0L") || code.startsWith("0P") ? 403 : 500;
  if (code.startsWith("28")) return 403;
  return 400;
}

export function pgErrorBody(error: unknown): Record<string, unknown> {
  const e = error as { code?: string; message?: string; detail?: string; hint?: string };
  return { code: e.code ?? null, details: e.detail ?? null, hint: e.hint ?? null, message: e.message ?? String(error) };
}

export function corsHeaders(req: IncomingMessage): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": (req.headers.origin as string | undefined) ?? "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      (req.headers["access-control-request-headers"] as string | undefined) ??
      "authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, x-client-info, range",
    // The browser may read these (the app's clock offset reads Date; supabase-js reads Content-Range).
    "Access-Control-Expose-Headers": "Content-Range, Content-Location, Date, X-Supabase-Api-Version",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function send(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders(req),
    ...(text ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    ...headers,
  });
  res.end(req.method === "HEAD" ? undefined : text);
}

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw { status: 400, body: { code: "PGRST100", message: `"${name}" is not a plain name`, details: null, hint: null } };
  return `"${name}"`;
}
