import { createHmac, timingSafeEqual } from "node:crypto";

/** HS256 JSON Web Tokens, as Supabase Auth issues them with a symmetric key. */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export type JwtResult =
  | { ok: true; claims: Record<string, unknown> }
  | { ok: false; reason: "malformed" | "signature" | "expired" };

export function verifyJwt(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): JwtResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [header, body, sig] = parts;
  let claims: Record<string, unknown>;
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string };
    if (h.alg !== "HS256") return { ok: false, reason: "malformed" };
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };
  if (typeof claims.exp === "number" && claims.exp <= nowSeconds) return { ok: false, reason: "expired" };
  return { ok: true, claims };
}
