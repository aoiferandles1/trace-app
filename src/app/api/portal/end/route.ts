import type { NextRequest } from "next/server";
import { badRequestOrigin, dbError, portalDb, portalToken, respond, secret } from "../_lib/portal";

/** POST /api/portal/end: "End session" on c-end. Returns the portal_status object. */
export async function POST(request: NextRequest) {
  const token = portalToken(request);
  if (badRequestOrigin(request)) return respond({ error: "bad_request" }, token, { status: 400 });
  const { data, error } = await portalDb().rpc("portal_end_session", {
    server_secret: secret(),
    portal_token: token.token,
  });
  if (error) return dbError(error, token);
  return respond(data, token);
}
