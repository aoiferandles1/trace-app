import type { NextRequest } from "next/server";
import { dbError, portalDb, portalToken, respond, SECTIONS, secret, type Section } from "../_lib/portal";

/**
 * GET /api/portal/record?section=medications: the only route that returns
 * record data (one document at a time comes from /api/portal/document).
 *
 * Calls portal_get_record with version 2 (supabase/README.md sections 5 and
 * 10). The database applies the patient's scope:
 * - `{ record: null }` unless the session is active right now;
 * - a section the patient did not grant comes back `shared: false` with no
 *   data. This route refuses it outright (403 `not_shared`), so nothing
 *   about an ungranted section, not even the envelope, reaches the browser.
 *   The portal never asks for one: its rail is built from the scope.
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
    version: 2,
  });
  if (error) return dbError(error, token);
  if (data && typeof data === "object" && !Array.isArray(data) && data.shared === false) {
    return respond({ error: "not_shared" }, token, { status: 403 });
  }
  return respond({ record: data ?? null }, token);
}
