import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { ipHashSalt, portalServerSecret } from "@/lib/server-env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server side of the clinician portal (PLAN.md section 6, "How the portal
 * talks to the database"; contract in supabase/README.md section 5).
 *
 * - The doctor's browser holds a random portal token (32 bytes, base64url) in
 *   an httpOnly, Secure, SameSite=Lax cookie scoped to /api/portal. The
 *   database stores only its SHA-256; we pass the raw token.
 * - Every database call goes through `portalDb()`: a supabase-js client with
 *   the publishable key and NO cookies and NO stored session, so a doctor's
 *   request never runs as a patient, even when the patient app is signed in
 *   in the same browser (the demo puts both side by side).
 * - The server secret is the first argument of every portal_* function. It is
 *   read from `@/lib/server-env` (server-only), and never logged or returned.
 */

export const PORTAL_COOKIE = "trace_portal";
const COOKIE_PATH = "/api/portal";
/** Bindings are cleaned up after 24 hours untouched, so the cookie need not outlive that. */
const COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * The redesigned record's sections (portal_get_record version 2,
 * supabase/README.md section 10). The database decides what each one holds
 * and refuses the ones the patient did not grant.
 */
export const SECTIONS = [
  "overview",
  "conditions",
  "recent_visits",
  "medications",
  "full_timeline",
  "care_team",
  "family_history",
  "insurance",
  "documents",
  "mental_health",
] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * Error codes the portal screens can act on. Anything else the database
 * raises is a bug or an attack, and leaves the server as `server_error`.
 */
const KNOWN_ERRORS: Record<string, number> = {
  invalid_clinician: 400,
  invalid_section: 400,
  notes_too_long: 400,
  notes_not_allowed: 403,
  session_not_active: 409,
  portal_busy: 409,
};

let client: SupabaseClient<Database> | null = null;

/** A cookie-free, session-free client. Never use `@/lib/supabase/server` for portal calls. */
export function portalDb(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(supabaseUrl(), supabasePublishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "trace-portal-server" } },
    });
  }
  return client;
}

export function secret(): string {
  return portalServerSecret();
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function validToken(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{32,512}$/.test(value));
}

/**
 * The caller's portal token. If the request has none (or a malformed one) a
 * new token is made; pass the result to `respond()` so the cookie is set.
 */
export function portalToken(request: NextRequest): { token: string; isNew: boolean } {
  const existing = request.cookies.get(PORTAL_COOKIE)?.value;
  if (validToken(existing)) return { token: existing, isNew: false };
  return { token: newToken(), isNew: true };
}

/** Salted SHA-256 of the caller's IP, for the per-IP attempt cap. Never the raw IP. */
export function ipHash(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return createHash("sha256").update(`${ipHashSalt()}:${ip}`).digest("hex");
}

/** JSON response that never caches, and sets the portal cookie when it is new. */
export function respond(
  body: unknown,
  token: { token: string; isNew: boolean },
  init: { status?: number } = {},
): NextResponse {
  const res = NextResponse.json(body, { status: init.status ?? 200 });
  res.headers.set("Cache-Control", "no-store");
  if (token.isNew) {
    res.cookies.set(PORTAL_COOKIE, token.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return res;
}

/** Turns a database error into a response the screens understand. */
export function dbError(
  error: { message: string; details?: string | null },
  token: { token: string; isNew: boolean },
): NextResponse {
  const status = KNOWN_ERRORS[error.message];
  if (status) {
    return respond({ error: error.message, details: error.details ?? null }, token, { status });
  }
  // Log the code only. Never the arguments: they include the server secret.
  console.error("portal: unexpected database error", error.message);
  return respond({ error: "server_error" }, token, { status: 500 });
}

/**
 * Basic CSRF guard for the POST routes. The cookie is SameSite=Lax, so a
 * cross-site form post would not carry it anyway; on top of that we require
 * a JSON body (which a plain cross-site form cannot send without a preflight)
 * and, when the browser sends an Origin, that it is this site.
 */
export function badRequestOrigin(request: NextRequest): boolean {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A trimmed string, or null when empty. Non-strings become null. */
export function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}
