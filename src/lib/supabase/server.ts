import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Create a new one per request (it is cheap). It reads the user's session from
 * cookies, so queries run as the signed-in user under row-level security.
 *
 * To protect a page or check who is signed in, use
 * `(await supabase.auth.getClaims()).data?.claims`, never `getSession()`:
 * getClaims verifies the token signature, getSession does not.
 *
 * Portal route handlers also use this client (with the publishable key) to
 * call the portal_* functions, passing `portalServerSecret()` from
 * `@/lib/server-env` as the first argument. There is no secret key.
 *
 * With cacheComponents on, anything that awaits this (it reads cookies) must
 * render inside a <Suspense> boundary.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which cannot write cookies.
          // Safe to ignore: src/proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
