import type { NextRequest } from "next/server";
import { dbError, portalDb, portalToken, respond, secret } from "../_lib/portal";

/**
 * GET /api/portal/status: the portal_status object (supabase/README.md 5).
 * Also the first call /view makes, so it is where a new portal token cookie
 * gets set. Polled every 2 s while waiting and every 5 s during a session.
 */
export async function GET(request: NextRequest) {
  const token = portalToken(request);
  const { data, error } = await portalDb().rpc("portal_status", {
    server_secret: secret(),
    portal_token: token.token,
  });
  if (error) return dbError(error, token);
  return respond(data, token);
}
