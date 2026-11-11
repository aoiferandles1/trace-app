"use client";

import { dayKey } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { isCurrentMedication, type Profile } from "./types";
import type { SharePrefs } from "./share";

/**
 * The rows under "Sharing preferences" (p-code) and "Dr Hennessy can see"
 * (p-active): each shared section with a short line about what is in it,
 * counted from the patient's own record with the same rules the portal uses
 * (supabase/README.md, portal_get_record).
 */

export type SummaryRow = { label: string; detail: string };

type Counts = {
  medications: number;
  conditions: { mental: boolean }[];
  team: string[];
};

async function loadCounts(): Promise<Counts> {
  const supabase = createClient();
  const [meds, conditions, team] = await Promise.all([
    supabase.from("medications").select("ended_on"),
    supabase.from("conditions").select("is_mental_health"),
    supabase.from("care_team").select("kind"),
  ]);
  const today = dayKey();
  return {
    medications: must(meds).filter((m) => isCurrentMedication(m, today)).length,
    conditions: must(conditions).map((c) => ({ mental: c.is_mental_health })),
    team: must(team).map((t) => t.kind),
  };
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

function teamLine(kinds: string[]): string {
  const gp = kinds.filter((k) => k === "gp").length;
  const sp = kinds.filter((k) => k === "specialist").length;
  const ph = kinds.filter((k) => k === "pharmacy").length;
  const parts = [
    gp ? plural(gp, "GP", "GPs") : null,
    sp ? `${sp} ${sp === 1 ? "specialist" : "specialists"}` : null,
    ph ? plural(ph, "pharmacy", "pharmacies") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No one added yet";
}

function criticalLine(p: Profile): string {
  const parts = [
    p.allergies.length ? "Allergies" : null,
    p.blood_type ? "blood type" : null,
    p.implants.length ? "implants" : null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "Nothing recorded yet";
  return parts.join(" · ").replace(/^./, (c) => c.toUpperCase());
}

export function useShareSummary(
  prefs: SharePrefs | null,
  profile: Profile,
  conditionWord: "items" | "diagnoses",
): SummaryRow[] | null {
  const counts = useLoad(loadCounts);
  if (!prefs || counts.status !== "ready") return null;
  const c = counts.data;
  const rows: SummaryRow[] = [
    { label: "Critical safety", detail: criticalLine(profile) },
    { label: "Medications", detail: `${c.medications} active` },
  ];
  if (prefs.share_conditions) {
    const n = c.conditions.filter((x) => !x.mental || prefs.share_mental_health).length;
    rows.push({
      label: "Active conditions",
      detail: conditionWord === "items" ? plural(n, "1 item", "items") : plural(n, "1 diagnosis", "diagnoses"),
    });
  }
  if (prefs.share_full_timeline) rows.push({ label: "Full timeline", detail: "Every entry" });
  else if (prefs.share_recent_visits) rows.push({ label: "Recent visits", detail: "Last 3" });
  if (prefs.share_care_team) rows.push({ label: "Care team", detail: teamLine(c.team) });
  if (prefs.share_mental_health) rows.push({ label: "Mental health history", detail: "Included" });
  return rows;
}
