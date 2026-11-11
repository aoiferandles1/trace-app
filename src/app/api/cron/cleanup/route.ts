import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { cronSecret, portalServerSecret } from "@/lib/server-env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The daily cleanup (PLAN.md section 9), run by Vercel Cron (vercel.json).
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; anything else gets 401.
 * It calls cleanup_demo_users, which deletes anonymous (demo) users created
 * more than 24 hours ago with everything they own, old portal attempts and
 * stale portal token bindings (supabase/README.md section 6).
 *
 * It also matters for a second reason: a free Supabase project pauses after a
 * week without activity, which would break the portfolio demo. One call a day
 * keeps it awake.
 */

function authorised(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${cronSecret()}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const db = createClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await db.rpc("cleanup_demo_users", { server_secret: portalServerSecret() });
  if (error) {
    // The message is a short code; never echo secrets.
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: true, ...(data as Record<string, number>) }, { headers: { "cache-control": "no-store" } });
}
