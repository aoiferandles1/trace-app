import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/documents/<id>: one of the signed-in patient's own documents,
 * through `my_document_file` (row-level security: nobody else's file can be
 * read).
 *
 * Served as the owner's notes require (docs/redesign/SUPERVISOR-NOTES.md,
 * Documents): the stored content type (only PDF, JPEG or PNG ever reach the
 * database, checked by their leading bytes), `X-Content-Type-Options:
 * nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: no-store`.
 * The file is its own response in its own tab, never put into an app page.
 *
 * Photos open inline. PDFs are sent as a download (`attachment`): Chrome's
 * PDF viewer will not run inside a sandboxed document, so inline it would
 * show a blocked page.
 */

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLAIN_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404, headers: PLAIN_HEADERS });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Sign in to open this document.", { status: 401, headers: PLAIN_HEADERS });

  const { data, error } = await supabase.rpc("my_document_file", { document_id: id });
  if (error || !data) {
    return new Response("Not found", { status: error?.message === "not_found" || !data ? 404 : 500, headers: PLAIN_HEADERS });
  }
  const file = data as { title: string; content_type: string; data_base64: string };
  const ext = EXTENSIONS[file.content_type];
  if (!ext) return new Response("Not found", { status: 404, headers: PLAIN_HEADERS });

  const bytes = Buffer.from(file.data_base64, "base64");
  const base = file.title.replace(/[^\w .-]+/g, "").trim().slice(0, 80) || "document";
  const name = `${base}.${ext}`;
  const disposition = file.content_type === "application/pdf" ? "attachment" : "inline";

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.content_type,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      // sandbox as the notes require; frame-ancestors repeats next.config.ts's rule, which this header replaces.
      "Content-Security-Policy": "sandbox; frame-ancestors 'self'",
      "Cache-Control": "no-store",
    },
  });
}
