import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Database } from "../../src/lib/supabase/database.types";

/**
 * The patient side for the redesigned portal's tests: an anonymous demo
 * user seeded with the boards' record (`seed_demo_record_v2`), sharing
 * through the new `create_share_code` overload so any mix of the eleven
 * scopes can be granted (supabase/README.md sections 4, 6 and 11).
 *
 * Kept apart from helpers/patient.ts (the patient app's helper, which seeds
 * the old record) so the two can change independently. Same rules: one
 * sign-in per spec file (anonymous sign-ins are capped at 30 an hour for this
 * machine), `reset()` between tests, `dispose()` once at the end.
 */

export type ScopeOptions = {
  share_conditions?: boolean;
  share_recent_visits?: boolean;
  share_full_timeline?: boolean;
  share_care_team?: boolean;
  share_mental_health?: boolean;
  share_documents?: boolean;
  share_family_history?: boolean;
  share_insurance?: boolean;
  share_medication_notes?: boolean;
  allow_notes?: boolean;
  duration_kind?: "30m" | "1h" | "all_day" | "manual";
};

/** Every switch off (Safety info and Medications travel anyway). */
export const NOTHING_OPTIONAL: Required<Omit<ScopeOptions, "allow_notes" | "duration_kind">> = {
  share_conditions: false,
  share_recent_visits: false,
  share_full_timeline: false,
  share_care_team: false,
  share_mental_health: false,
  share_documents: false,
  share_family_history: false,
  share_insurance: false,
  share_medication_notes: false,
};

export type Session = {
  id: string;
  status: string;
  code: string;
  clinician_name: string | null;
  clinician_role: string | null;
  clinician_practice: string | null;
  [key: string]: unknown;
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

/** A one-pixel PNG, for document tests. */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** A minimal PDF (starts with %PDF-). */
export const TINY_PDF_BASE64 = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
).toString("base64");

export class PortalPatient {
  private constructor(
    readonly client: SupabaseClient<Database>,
    readonly userId: string,
    public appointmentEntryId: string,
  ) {}

  /** Signs in anonymously (one of the 30 an hour) and seeds the boards' Jane Doe. */
  static async signIn(): Promise<PortalPatient> {
    loadEnv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase env missing: copy .env.local into the repo root.");
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) fail("signInAnonymously", error);
    const seed = await client.rpc("seed_demo_record_v2");
    if (seed.error) fail("seed_demo_record_v2", seed.error);
    return new PortalPatient(client, data.user.id, (seed.data as { appointment_entry_id: string }).appointment_entry_id);
  }

  /** "Reset demo": wipes the sandbox (any share, documents, notes) and seeds again. */
  async reset(): Promise<void> {
    const { data, error } = await this.client.rpc("seed_demo_record_v2");
    if (error) fail("seed_demo_record_v2", error);
    this.appointmentEntryId = (data as { appointment_entry_id: string }).appointment_entry_id;
  }

  /** A share code with the redesign's defaults, changed by `opts`. All four new scopes are always named. */
  async shareCode(opts: ScopeOptions = {}): Promise<Session> {
    const { data, error } = await this.client.rpc("create_share_code", {
      share_documents: false,
      share_family_history: false,
      share_insurance: false,
      share_medication_notes: false,
      ...opts,
      appointment_entry_id: this.appointmentEntryId,
    });
    if (error || !data) fail("create_share_code", error);
    return data as unknown as Session;
  }

  async session(): Promise<Session | null> {
    const { data, error } = await this.client.rpc("my_share_session");
    if (error) fail("my_share_session", error);
    return (data as unknown as Session) ?? null;
  }

  async waitForStatus(status: string, timeoutMs = 15_000): Promise<Session> {
    const until = Date.now() + timeoutMs;
    let last: Session | null = null;
    while (Date.now() < until) {
      last = await this.session();
      if (last?.status === status) return last;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Share session never reached "${status}" (last: ${last?.status ?? "none"})`);
  }

  async respond(allow: boolean): Promise<Session> {
    const current = await this.session();
    if (!current) throw new Error("No share session to respond to");
    const { data, error } = await this.client.rpc("respond_to_request", { session_id: current.id, allow });
    if (error) fail("respond_to_request", error);
    return data as unknown as Session;
  }

  async end(): Promise<Session | null> {
    const { data, error } = await this.client.rpc("end_session");
    if (error) fail("end_session", error);
    return (data as unknown as Session) ?? null;
  }

  async uploadDocument(title: string, kind: "png" | "pdf" = "png", isMentalHealth = false): Promise<string> {
    const { data, error } = await this.client.rpc("upload_document", {
      title,
      content_type: kind === "png" ? "image/png" : "application/pdf",
      data_base64: kind === "png" ? TINY_PNG_BASE64 : TINY_PDF_BASE64,
      is_mental_health: isMentalHealth,
    });
    if (error || !data) fail("upload_document", error);
    return (data as { id: string }).id;
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

  /** Turns `note_shared` off on every period of one medication (by name). */
  async hideNotes(medicationName: string): Promise<void> {
    const { data: meds, error } = await this.client.from("medications").select("id").eq("name", medicationName);
    if (error || !meds?.length) fail("select medication", error);
    const res = await this.client.from("medication_periods").update({ note_shared: false }).eq("medication_id", meds[0].id);
    if (res.error) fail("update medication_periods", res.error);
  }

  /** Deletes this anonymous user and everything it owns. Call once, at the end. */
  async dispose(): Promise<void> {
    const { error } = await this.client.rpc("delete_my_account");
    if (error) console.warn(`delete_my_account failed: ${error.message}`);
    await this.client.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
