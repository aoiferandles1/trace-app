import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every matched request and passes the
 * refreshed cookies to both Server Components (request) and the browser
 * (response). Follows the current Supabase guide for Next.js (proxy.ts).
 *
 * It does not redirect anyone. Route protection belongs in the pages and
 * layouts that need it (check `getClaims()` there), added in Phase 3.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cache headers stop a CDN from caching a response that sets a session cookie.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes
  // the token, and anything in between can cause random sign-outs.
  await supabase.auth.getClaims();

  // Return `response` as it is. If you ever need a new NextResponse, pass the
  // request into it and copy response.cookies across.
  return response;
}
