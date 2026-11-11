import type { NextRequest } from "next/server";
import { dbError, portalDb, portalToken, secret } from "../_lib/portal";

/**
 * GET /api/portal/document?id=<uuid>: one shared document's file, for the
 * doctor to open in a new tab (supabase/README.md, portal_get_document).
 *
 * The database returns the file only while the session is active, the
 * patient granted Documents (and Mental health for a flagged file), and the
 * document is theirs. Anything else is a plain 404 with no body, so the
 * response never says whether a file exists.
 *
 * The file goes out as itself, never inside a page: its stored content type,
 * `nosniff`, a `sandbox` content security policy (no scripts, no same-origin
 * access even if a file were crafted to look like HTML), `no-store`, and
 * `inline` so the browser's own viewer shows it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** An ASCII filename for Content-Disposition: letters, digits, spaces, dots, dashes. */
function safeName(title: string, type: string): string {
  const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : "jpg";
  const base =
    title
      .normalize("NFKD")
      .replace(/[^\w .-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "document";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export async function GET(request: NextRequest) {
  const token = portalToken(request);
  const id = request.nextUrl.searchParams.get("id") ?? "";
  // No portal cookie means no session; a malformed id cannot be a document.
  if (token.isNew || !UUID.test(id)) return notFound();

  const { data, error } = await portalDb().rpc("portal_get_document", {
    server_secret: secret(),
    portal_token: token.token,
    document_id: id,
  });
  if (error) return dbError(error, token);
  if (!data || typeof data !== "object" || Array.isArray(data)) return notFound();

  const file = data as { title?: unknown; content_type?: unknown; data_base64?: unknown };
  const type = typeof file.content_type === "string" ? file.content_type : "";
  if (!TYPES.has(type) || typeof file.data_base64 !== "string") return notFound();
  const bytes = Buffer.from(file.data_base64, "base64");
  const title = typeof file.title === "string" ? file.title : "document";

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${safeName(title, type)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; frame-ancestors 'self'",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
