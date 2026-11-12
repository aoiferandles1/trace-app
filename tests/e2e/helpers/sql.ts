import { SUPABASE_URL } from "../../support/local-env";

/**
 * Runs SQL against the local test database as its owner (no row-level
 * security), through the stand-in's /__test/sql endpoint. For what the app
 * cannot do in a test's time, such as moving a share's expiry into the past
 * to reach Time's up for real. Never available against the hosted project.
 *
 *   await sql("update public.share_sessions set expires_at = now() where id = $1", [id]);
 */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/__test/sql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sql: text, params }),
  });
  const body = (await res.json()) as { rows?: T[]; message?: string };
  if (!res.ok) throw new Error(`sql failed: ${body.message}`);
  return body.rows ?? [];
}
