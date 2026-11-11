import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy (formerly Middleware). Keeps the patient's Supabase session
 * fresh. The clinician portal (/view, /api/portal) has no Supabase session and
 * is skipped, as are /demo (a static page of two iframes), the cron route,
 * static files and the dev-only UI kit.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|kit|view|demo|api/portal|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
