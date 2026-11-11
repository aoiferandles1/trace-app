import type { IconName } from "@/components/ui/Icon";
import type { Scope } from "./api";

/**
 * The live record's views, in the rail's order (BRIEF.md 6.3, board
 * PortalRecordE): Overview, Recent visits, Medications, Full timeline, Care
 * team, Family history, then Documents, Insurance, Mental health.
 *
 * Each view is opened by one scope key (Overview and Medications always).
 * The rail lists the granted views as links and the rest, in the same
 * order, as dimmed "Not shared" rows. A view's page checks the same scope
 * before it asks for anything, so typing the URL of an ungranted view shows
 * "Not shared" and requests nothing.
 */

export type ViewKey =
  | "overview"
  | "visits"
  | "medications"
  | "timeline"
  | "care-team"
  | "family"
  | "documents"
  | "insurance"
  | "mental-health";

export type ViewDef = {
  key: ViewKey;
  label: string;
  href: string;
  icon: IconName;
  /** The scope that opens it; null means always shared. */
  scope: keyof Scope | null;
};

export const VIEWS: ViewDef[] = [
  { key: "overview", label: "Overview", href: "/view/session", icon: "grid", scope: null },
  { key: "visits", label: "Recent visits", href: "/view/session/visits", icon: "calendar", scope: "recent_visits" },
  { key: "medications", label: "Medications", href: "/view/session/medications", icon: "pill", scope: null },
  { key: "timeline", label: "Full timeline", href: "/view/session/timeline", icon: "clock", scope: "full_timeline" },
  { key: "care-team", label: "Care team", href: "/view/session/care-team", icon: "person", scope: "care_team" },
  { key: "family", label: "Family history", href: "/view/session/family", icon: "tree", scope: "family_history" },
  { key: "documents", label: "Documents", href: "/view/session/documents", icon: "document", scope: "documents" },
  { key: "insurance", label: "Insurance", href: "/view/session/insurance", icon: "shield", scope: "insurance" },
  { key: "mental-health", label: "Mental health", href: "/view/session/mental-health", icon: "smile", scope: "mental_health" },
];

export function viewDef(key: ViewKey): ViewDef {
  return VIEWS.find((v) => v.key === key)!;
}

export function isGranted(view: ViewDef, scope: Scope | null | undefined): boolean {
  if (view.scope === null) return true;
  return Boolean(scope?.[view.scope]);
}

/** The view a pathname shows ("/view/session/visits" is "visits"). */
export function viewForPath(pathname: string): ViewKey | null {
  const slug = pathname.replace(/^\/view\/session\/?/, "").split("/")[0];
  if (!slug) return "overview";
  return VIEWS.find((v) => v.href === `/view/session/${slug}`)?.key ?? null;
}
