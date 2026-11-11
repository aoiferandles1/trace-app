import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { clockedFetch } from "@/lib/serverClock";
import type { Database } from "./database.types";

/**
 * Supabase client for Client Components (the patient app in the browser).
 *
 * Uses the publishable key and the signed-in user's cookie session, so every
 * query runs under row-level security as that user. `createBrowserClient` is a
 * singleton, so call this wherever you need it.
 *
 * The clinician portal must never use this: the portal's browser does not talk
 * to Supabase (PLAN.md, "How the portal talks to the database").
 *
 * Typed with the generated database types (src/lib/supabase/database.types.ts,
 * a copy of supabase/types/database.types.ts; regenerate both after a migration).
 *
 * Every response's Date header is used to correct countdowns on a device
 * whose clock is wrong (src/lib/serverClock.ts).
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: clockedFetch },
  });
}
