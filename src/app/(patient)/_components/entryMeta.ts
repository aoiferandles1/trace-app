import type { Entry } from "@/lib/patient/types";

/** The second line of a timeline card: "Mater Hospital · Ordered by Dr Hennessy", "Fatigue symptoms". */
export function entryMeta(e: Entry): string | undefined {
  if (e.kind === "note") return e.body?.split("\n")[0]?.slice(0, 120) || undefined;
  if (e.kind === "result") {
    return [e.place, e.clinician && `Ordered by ${e.clinician}`].filter(Boolean).join(" · ") || undefined;
  }
  return [e.clinician, e.place].filter(Boolean).join(" · ") || undefined;
}
