import { randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readBody, send, type Context } from "./context.ts";
import { signJwt, verifyJwt } from "./jwt.ts";

/**
 * The Supabase Auth (GoTrue) subset Trace uses (/auth/v1). Users live in
 * auth.users, so the migrations' triggers (the invite list, the profile row)
 * run on every sign-up exactly as they do on the hosted project.
 *
 * - POST /signup with no email: an anonymous user ("Try the demo"). No cap.
 * - POST /otp: an emailed code. Nothing is sent; every code is
 *   LOCAL_EMAIL_CODE. `create_user: false` for an unknown address is
 *   otp_disabled; a sign-up the invite trigger refuses is
 *   "Database error saving new user", as GoTrue says it.
 * - POST /verify: that code (type email) for the address, or a token_hash
 *   (always refused: no links are sent).
 * - POST /token?grant_type=refresh_token: rotates the refresh token.
 * - GET /user, PUT /user (email: kept as the pending new_email, as GoTrue
 *   does until the link is followed), POST /logout.
 * Access tokens are HS256, so supabase-js's getClaims() checks them with
 * GET /user (it only verifies locally for asymmetric keys). Refresh tokens
 * live in memory: restarting the stand-in signs everyone out, and the
 * database starts empty anyway.
 */

const ACCESS_TTL_SECONDS = 3600;

type UserRow = {
  id: string;
  email: string | null;
  email_change: string | null;
  is_anonymous: boolean;
  raw_app_meta_data: Record<string, unknown> | null;
  raw_user_meta_data: Record<string, unknown> | null;
  email_confirmed_at: Date | null;
  confirmed_at: Date | null;
  last_sign_in_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type Refresh = { userId: string; sessionId: string; amr: string };
const refreshTokens = new Map<string, Refresh>();

function authError(req: IncomingMessage, res: ServerResponse, status: number, errorCode: string, msg: string) {
  send(req, res, status, { code: status, error_code: errorCode, msg });
}

async function sql<T>(ctx: Context, text: string, params: unknown[] = []): Promise<T[]> {
  const r = await ctx.exclusive(() => ctx.db.query<T>(text, params));
  return r.rows;
}

const USER_COLUMNS = `id, email, email_change, is_anonymous, raw_app_meta_data, raw_user_meta_data,
  email_confirmed_at, confirmed_at, last_sign_in_at, created_at, updated_at`;

async function findUser(ctx: Context, id: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>(ctx, `select ${USER_COLUMNS} from auth.users where id = $1`, [id]);
  return rows[0] ?? null;
}

async function findByEmail(ctx: Context, email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>(ctx, `select ${USER_COLUMNS} from auth.users where lower(email) = lower($1)`, [email]);
  return rows[0] ?? null;
}

function iso(ts: Date | null): string | null {
  return ts ? ts.toISOString() : null;
}

function userJson(u: UserRow) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email ?? "",
    ...(u.email_change ? { new_email: u.email_change } : {}),
    email_confirmed_at: iso(u.email_confirmed_at),
    phone: "",
    confirmed_at: iso(u.confirmed_at),
    last_sign_in_at: iso(u.last_sign_in_at),
    app_metadata: u.raw_app_meta_data ?? {},
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: iso(u.created_at),
    updated_at: iso(u.updated_at),
    is_anonymous: u.is_anonymous,
  };
}

async function issueSession(ctx: Context, user: UserRow, amr: string, sessionId: string = randomUUID()) {
  await sql(ctx, `update auth.users set last_sign_in_at = now() where id = $1`, [user.id]);
  const fresh = (await findUser(ctx, user.id))!;
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt(
    {
      iss: `${ctx.url}/auth/v1`,
      sub: fresh.id,
      aud: "authenticated",
      exp: now + ACCESS_TTL_SECONDS,
      iat: now,
      email: fresh.email ?? "",
      phone: "",
      app_metadata: fresh.raw_app_meta_data ?? {},
      user_metadata: fresh.raw_user_meta_data ?? {},
      role: "authenticated",
      aal: "aal1",
      amr: [{ method: amr, timestamp: now }],
      session_id: sessionId,
      is_anonymous: fresh.is_anonymous,
    },
    ctx.jwtSecret,
  );
  const refresh = randomBytes(18).toString("base64url");
  refreshTokens.set(refresh, { userId: fresh.id, sessionId, amr });
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: ACCESS_TTL_SECONDS,
    expires_at: now + ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    user: userJson(fresh),
  };
}

/** Inserts into auth.users; the invite trigger may refuse it. */
async function createUser(ctx: Context, opts: { email?: string; anonymous: boolean; data?: unknown }): Promise<UserRow | "refused"> {
  const id = randomUUID();
  const provider = opts.anonymous ? "anonymous" : "email";
  try {
    await sql(
      ctx,
      `insert into auth.users (instance_id, id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data,
                               created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, $4::jsonb, $5::jsonb,
               now(), now())`,
      [
        id,
        opts.email ?? null,
        opts.anonymous,
        JSON.stringify({ provider, providers: [provider] }),
        JSON.stringify(opts.data && typeof opts.data === "object" ? opts.data : {}),
      ],
    );
  } catch (error) {
    // GoTrue turns any trigger error into this message (Trace's invite trigger raises invite_only).
    if ((error as { code?: string }).code) return "refused";
    throw error;
  }
  return (await findUser(ctx, id))!;
}

function bearerUser(ctx: Context, req: IncomingMessage): { claims: Record<string, unknown> } | { status: number; code: string; msg: string } {
  const auth = req.headers.authorization;
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token || token === ctx.publishableKey) return { status: 401, code: "no_authorization", msg: "This endpoint requires a valid Bearer token" };
  const r = verifyJwt(token, ctx.jwtSecret);
  if (!r.ok) {
    return r.reason === "expired"
      ? { status: 403, code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" }
      : { status: 403, code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, signature is invalid" };
  }
  return { claims: r.claims };
}

export async function handleAuth(ctx: Context, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const apikey = (req.headers.apikey as string | undefined) ?? url.searchParams.get("apikey");
  const path = url.pathname.replace(/^\/auth\/v1/, "");
  if (path === "/.well-known/jwks.json") return send(req, res, 200, { keys: [] });
  if (apikey !== ctx.publishableKey) {
    return send(req, res, 401, { message: "Invalid API key", hint: "Double check your Supabase `anon` or `service_role` API key." });
  }
  const method = req.method ?? "GET";
  const body = method === "POST" || method === "PUT" ? (JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>) : {};

  if (path === "/settings" && method === "GET") {
    return send(req, res, 200, { external: { anonymous_users: true, email: true }, disable_signup: false, mailer_autoconfirm: false });
  }

  if (path === "/signup" && method === "POST") {
    if (body.email || body.phone) return authError(req, res, 422, "validation_failed", "Password sign-up is not supported by the local stand-in");
    const created = await createUser(ctx, { anonymous: true, data: body.data });
    if (created === "refused") return authError(req, res, 500, "unexpected_failure", "Database error creating anonymous user");
    return send(req, res, 200, await issueSession(ctx, created, "anonymous"));
  }

  if (path === "/otp" && method === "POST") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return authError(req, res, 422, "validation_failed", "An email address is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return authError(req, res, 400, "email_address_invalid", `Email address "${email}" is invalid`);
    }
    const existing = await findByEmail(ctx, email);
    if (!existing) {
      if (body.create_user === false) return authError(req, res, 422, "otp_disabled", "Signups not allowed for otp");
      const created = await createUser(ctx, { email, anonymous: false, data: body.data });
      if (created === "refused") return authError(req, res, 500, "unexpected_failure", "Database error saving new user");
    }
    return send(req, res, 200, {});
  }

  if (path === "/verify" && method === "POST") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const user = email ? await findByEmail(ctx, email) : null;
    if (!user || body.token_hash || token !== ctx.emailCode) {
      return authError(req, res, 403, "otp_expired", "Token has expired or is invalid");
    }
    await sql(ctx, `update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1`, [user.id]);
    return send(req, res, 200, await issueSession(ctx, user, "otp"));
  }

  if (path === "/token" && method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant !== "refresh_token") return authError(req, res, 400, "validation_failed", `grant_type ${grant} is not supported by the local stand-in`);
    const token = typeof body.refresh_token === "string" ? body.refresh_token : "";
    const entry = refreshTokens.get(token);
    if (!entry) return authError(req, res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    refreshTokens.delete(token);
    const user = await findUser(ctx, entry.userId);
    if (!user) return authError(req, res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    return send(req, res, 200, await issueSession(ctx, user, entry.amr, entry.sessionId));
  }

  if (path === "/user" && (method === "GET" || method === "PUT")) {
    const who = bearerUser(ctx, req);
    if ("status" in who) return authError(req, res, who.status, who.code, who.msg);
    const user = await findUser(ctx, String(who.claims.sub));
    if (!user) return authError(req, res, 403, "user_not_found", "User from sub claim in JWT does not exist");
    if (method === "GET") return send(req, res, 200, userJson(user));
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(req, res, 400, "email_address_invalid", `Email address "${email}" is invalid`);
      if (await findByEmail(ctx, email)) return authError(req, res, 422, "email_exists", "A user with this email address has already been registered");
      await sql(ctx, `update auth.users set email_change = $2, email_change_sent_at = now(), updated_at = now() where id = $1`, [user.id, email]);
    }
    if (body.data && typeof body.data === "object") {
      await sql(ctx, `update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || $2::jsonb, updated_at = now() where id = $1`, [
        user.id,
        JSON.stringify(body.data),
      ]);
    }
    return send(req, res, 200, userJson((await findUser(ctx, user.id))!));
  }

  if (path === "/logout" && method === "POST") {
    const who = bearerUser(ctx, req);
    if ("status" in who) return authError(req, res, who.status, who.code, who.msg);
    const scope = url.searchParams.get("scope") ?? "global";
    for (const [token, entry] of refreshTokens) {
      if (entry.userId !== who.claims.sub) continue;
      const same = entry.sessionId === who.claims.session_id;
      if (scope === "global" || (scope === "local" && same) || (scope === "others" && !same)) refreshTokens.delete(token);
    }
    return send(req, res, 204, undefined);
  }

  authError(req, res, 404, "not_found", `${method} /auth/v1${path} is not supported by the local stand-in`);
}
