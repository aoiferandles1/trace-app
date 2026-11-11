import type { NextRequest } from "next/server";
import { badRequestOrigin, dbError, portalDb, portalToken, readJson, respond, secret } from "../_lib/portal";

/**
 * POST /api/portal/notes: autosave and "Save notes". Body has all four
 * fields; they replace the draft. Returns { saved_at }.
 * Over-long fields are passed through (cut just past the limit) so the
 * database answers `notes_too_long` rather than silently truncating.
 */
const MAX = 5000;

function field(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX + 1) : "";
}

export async function POST(request: NextRequest) {
  const token = portalToken(request);
  if (badRequestOrigin(request)) return respond({ error: "bad_request" }, token, { status: 400 });
  const body = await readJson(request);
  const { data, error } = await portalDb().rpc("portal_save_notes", {
    server_secret: secret(),
    portal_token: token.token,
    chief_complaint: field(body.chief_complaint),
    assessment: field(body.assessment),
    plan: field(body.plan),
    follow_up: field(body.follow_up),
  });
  if (error) return dbError(error, token);
  return respond(data, token);
}
