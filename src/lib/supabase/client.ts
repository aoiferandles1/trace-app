import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

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
 * When the database agent's generated types land (src/lib/supabase/database.types.ts),
 * pass them as the generic: createBrowserClient<Database>(...).
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
