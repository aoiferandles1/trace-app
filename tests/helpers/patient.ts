import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Database } from "../../src/lib/supabase/database.types";

/**
 * Drives the patient side of Trace from test code, as an anonymous demo user
 * (supabase/README.md sections 4 and 6). Use one per test run, not one per
 * test: anonymous sign-ins are capped at 30 an hour for this machine, shared
 * with every other test run. `reset()` re-seeds Jane Doe between tests, and
 * `dispose()` deletes the user (call it once at the end).
 *
 *   const patient = await DemoPatient.signIn();
 *   const share = await patient.shareCode();          // GP visit defaults
 *   ... the doctor types share.code ...
 *   await patient.waitForStatus("requested");
 *   await patient.respond(true);
 *   await patient.dispose();
 */

export type ShareSession = {
  id: string;
  status: string;
  code: string;
  code_expires_at: string;
  expires_at: string | null;
  clinician_name: string | null;
  clinician_role: string | null;
  clinician_practice: string | null;
  notes_entry_id: string | null;
  [key: string]: unknown;
};

export type ShareOptions = {
  share_conditions?: boolean;
  share_recent_visits?: boolean;
  share_full_timeline?: boolean;
  share_care_team?: boolean;
  share_mental_health?: boolean;
  allow_notes?: boolean;
  duration_kind?: "30m" | "1h" | "all_day" | "manual";
  /** Pass false to share "from Profile" (no appointment). Defaults to today's seeded visit. */
  fromAppointment?: boolean;
};

let envLoaded = false;
function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
  const file = path.resolve(__dirname, "../../.env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

function fail(what: string, error: { message: string; details?: string | null } | null): never {
  throw new Error(`${what} failed: ${error?.message ?? "no data"}${error?.details ? ` (${error.details})` : ""}`);
}

export class DemoPatient {
  private constructor(
    readonly client: SupabaseClient<Database>,
    readonly userId: string,
    public appointmentEntryId: string,
  ) {}

  /** Signs in anonymously (one of the 30 an hour) and seeds Jane Doe. */
  static async signIn(): Promise<DemoPatient> {
    loadEnv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase env missing: copy .env.local into the repo root.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) fail("signInAnonymously", error);
    const seed = await client.rpc("seed_demo_record");
    if (seed.error) fail("seed_demo_record", seed.error);
    const appt = (seed.data as { appointment_entry_id: string }).appointment_entry_id;
    return new DemoPatient(client, data.user.id, appt);
  }

  /** "Reset demo": wipes the sandbox (including any share) and seeds Jane again. */
  async reset(): Promise<void> {
    const { data, error } = await this.client.rpc("seed_demo_record");
    if (error) fail("seed_demo_record", error);
    this.appointmentEntryId = (data as { appointment_entry_id: string }).appointment_entry_id;
  }

  async shareCode(opts: ShareOptions = {}): Promise<ShareSession> {
    const { fromAppointment = true, ...prefs } = opts;
    const { data, error } = await this.client.rpc("create_share_code", {
      ...prefs,
      ...(fromAppointment ? { appointment_entry_id: this.appointmentEntryId } : {}),
    });
    if (error || !data) fail("create_share_code", error);
    return data as unknown as ShareSession;
  }

  async session(): Promise<ShareSession | null> {
    const { data, error } = await this.client.rpc("my_share_session");
    if (error) fail("my_share_session", error);
    return (data as unknown as ShareSession) ?? null;
  }

  /** Polls my_share_session() (which also applies time-based changes) until the status matches. */
  async waitForStatus(status: string, timeoutMs = 15_000): Promise<ShareSession> {
    const until = Date.now() + timeoutMs;
    let last: ShareSession | null = null;
    while (Date.now() < until) {
      last = await this.session();
      if (last?.status === status) return last;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Share session never reached "${status}" (last: ${last?.status ?? "none"})`);
  }

  /** Allow or Deny on the request sheet, for the current session. */
  async respond(allow: boolean): Promise<ShareSession> {
    const current = await this.session();
    if (!current) throw new Error("No share session to respond to");
    const { data, error } = await this.client.rpc("respond_to_request", { session_id: current.id, allow });
    if (error) fail("respond_to_request", error);
    return data as unknown as ShareSession;
  }

  async extend(minutes: 15 | 30): Promise<ShareSession> {
    const { data, error } = await this.client.rpc("extend_session", { minutes });
    if (error) fail("extend_session", error);
    return data as unknown as ShareSession;
  }

  /** "End sharing now" (or cancelling an unused code). */
  async end(): Promise<ShareSession | null> {
    const { data, error } = await this.client.rpc("end_session");
    if (error) fail("end_session", error);
    return (data as unknown as ShareSession) ?? null;
  }

  async entries() {
    const { data, error } = await this.client.from("entries").select("*").order("occurs_at", { ascending: false });
    if (error) fail("select entries", error);
    return data;
  }

  async accessEvents(sessionId?: string) {
    let q = this.client.from("access_events").select("*").order("at", { ascending: true });
    if (sessionId) q = q.eq("session_id", sessionId);
    const { data, error } = await q;
    if (error) fail("select access_events", error);
    return data;
  }

  /** Adds a row the seed does not have (for scope tests). */
  async addCondition(row: Database["public"]["Tables"]["conditions"]["Insert"]) {
    const { error } = await this.client.from("conditions").insert(row);
    if (error) fail("insert condition", error);
  }

  async addEntry(row: Database["public"]["Tables"]["entries"]["Insert"]) {
    const { error } = await this.client.from("entries").insert(row);
    if (error) fail("insert entry", error);
  }

  /** Deletes this anonymous user and everything it owns. Call once, at the end. */
  async dispose(): Promise<void> {
    const { error } = await this.client.rpc("delete_my_account");
    if (error) console.warn(`delete_my_account failed: ${error.message}`);
    await this.client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
