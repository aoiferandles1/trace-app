import type { NextRequest } from "next/server";
import { dbError, portalDb, portalToken, respond, SECTIONS, secret, type Section } from "../_lib/portal";

/**
 * GET /api/portal/record?section=overview: the only route that returns
 * patient data. `{ record: null }` unless the session is active right now
 * (the database decides, and applies the patient's scope).
 */
export async function GET(request: NextRequest) {
  const token = portalToken(request);
  const section = request.nextUrl.searchParams.get("section") ?? "overview";
  if (!SECTIONS.includes(section as Section)) {
    return respond({ error: "invalid_section" }, token, { status: 400 });
  }
  // A brand-new token cannot have a session: skip the database.
  if (token.isNew) return respond({ record: null }, token);
  const { data, error } = await portalDb().rpc("portal_get_record", {
    server_secret: secret(),
    portal_token: token.token,
    section,
  });
  if (error) return dbError(error, token);
  return respond({ record: data ?? null }, token);
}
