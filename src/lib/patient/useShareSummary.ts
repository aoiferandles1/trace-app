"use client";

import { dayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { isCurrentMedication, type Profile } from "./types";
import { sharedScopes, type SharePrefs } from "./share";

/**
 * The rows under "Sharing" (CodeA2): each shared section with a short line
 * about what is in it ("4 active", "3 items", "GP, 2 specialists"), counted
 * from the patient's own record with the rules the portal follows
 * (supabase/README.md section 10: a mental health item only with that
 * scope, insurance only when "Include in shares" is on).
 */

export type SummaryRow = { id: string; label: string; detail?: string };

type Counts = {
  medications: number;
  conditions: { mental: boolean }[];
  team: string[];
  events: { mental: boolean }[];
  relatives: number;
  documents: { mental: boolean }[];
  insurance: { provider: string; include: boolean } | null;
};

async function loadCounts(): Promise<Counts> {
  const supabase = createClient();
  const [meds, conditions, team, events, relatives, documents, insurance] = await Promise.all([
    supabase.from("medications").select("ended_on"),
    supabase.from("conditions").select("is_mental_health"),
    supabase.from("care_team").select("kind"),
    supabase.from("health_events").select("is_mental_health"),
    supabase.from("relatives").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("is_mental_health"),
    supabase.from("insurance_connections").select("provider, include_in_shares").limit(1),
  ]);
  if (relatives.error) throw relatives.error;
  const today = dayKey();
  const ins = must(insurance)[0];
  return {
    medications: must(meds).filter((m) => isCurrentMedication(m, today)).length,
    conditions: must(conditions).map((c) => ({ mental: c.is_mental_health })),
    team: must(team).map((t) => t.kind),
    events: must(events).map((e) => ({ mental: e.is_mental_health })),
    relatives: relatives.count ?? 0,
    documents: must(documents).map((d) => ({ mental: d.is_mental_health })),
    insurance: ins ? { provider: ins.provider, include: ins.include_in_shares } : null,
  };
}

/** "1 item", "3 items". */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "GP, 2 specialists, 1 pharmacy". */
function teamLine(kinds: string[]): string {
  const gp = kinds.filter((k) => k === "gp").length;
  const sp = kinds.filter((k) => k === "specialist").length;
  const ph = kinds.filter((k) => k === "pharmacy").length;
  const parts = [
    gp ? (gp === 1 ? "GP" : `${gp} GPs`) : null,
    sp ? count(sp, "specialist", "specialists") : null,
    ph ? count(ph, "pharmacy", "pharmacies") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "No one added yet";
}

/** "Allergies, blood type" (CodeA2). */
function safetyLine(p: Profile): string {
  const parts = [
    p.allergies.length ? "allergies" : null,
    p.blood_type ? "blood type" : null,
    p.implants.length ? "implants" : null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "Nothing recorded yet";
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * One row per shared section, in the scope order. `null` while the counts
 * load. If they cannot load (offline), the rows still say what is shared,
 * without the counts.
 */
export function useShareSummary(prefs: SharePrefs | null, profile: Profile): SummaryRow[] | null {
  const counts = useLoad(loadCounts);
  if (!prefs || counts.status === "loading") return null;
  const c = counts.status === "ready" ? counts.data : null;
  const mh = prefs.share_mental_health;
  const visible = (items: { mental: boolean }[]) => items.filter((x) => !x.mental || mh).length;

  function detail(id: string): string | undefined {
    if (id === "safety") return safetyLine(profile);
    if (!c) return undefined;
    switch (id) {
      case "medications":
        return `${c.medications} active`;
      case "conditions":
        return count(visible(c.conditions), "item", "items");
      case "recent_visits":
        return "Last 3";
      case "full_timeline":
        return count(visible(c.events), "event", "events");
      case "care_team":
        return teamLine(c.team);
      case "documents":
        return count(visible(c.documents), "document", "documents");
      case "family_history":
        return count(c.relatives, "relative", "relatives");
      case "insurance":
        return !c.insurance ? "Not connected" : c.insurance.include ? c.insurance.provider : "Not included in shares";
      case "medication_notes":
        return "Notes you chose to share";
      default:
        return undefined;
    }
  }

  return sharedScopes(prefs).map((s) => ({ id: s.id, label: s.label, detail: detail(s.id) }));
}
