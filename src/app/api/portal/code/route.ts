import type { NextRequest } from "next/server";
import {
  badRequestOrigin,
  dbError,
  ipHash,
  portalDb,
  portalToken,
  readJson,
  respond,
  secret,
  text,
} from "../_lib/portal";

/**
 * POST /api/portal/code: the doctor typed the 4 digits.
 * Body: { code, clinician_name, clinician_role?, clinician_practice? }.
 * Returns { result, request_expires_at, attempts_left, locked_until }.
 */
export async function POST(request: NextRequest) {
  const token = portalToken(request);
  if (badRequestOrigin(request)) return respond({ error: "bad_request" }, token, { status: 400 });
  const body = await readJson(request);

  const name = text(body.clinician_name, 100);
  if (!name) return respond({ error: "invalid_clinician" }, token, { status: 400 });

  const { data, error } = await portalDb().rpc("portal_submit_code", {
    server_secret: secret(),
    portal_token: token.token,
    // Anything that is not 4 digits is simply a wrong code to the database.
    code: typeof body.code === "string" ? body.code.slice(0, 16) : "",
    clinician_name: name,
    clinician_role: text(body.clinician_role, 60) ?? "",
    clinician_practice: text(body.clinician_practice, 120) ?? "",
    ip_hash: ipHash(request),
  });
  if (error) return dbError(error, token);
  return respond(data, token);
}
