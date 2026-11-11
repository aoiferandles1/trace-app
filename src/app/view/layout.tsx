import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Clinical Access Portal", template: "%s · Trace Clinical Access Portal" },
  description: "Read a patient's Trace record for this visit, with their permission. A portfolio project, not a medical service.",
  robots: { index: false, follow: false },
};

/**
 * The clinician portal (PLAN.md section 6). No Supabase session here: the
 * browser talks only to /api/portal/*, and src/proxy.ts skips /view.
 */
export default function ViewLayout({ children }: LayoutProps<"/view">) {
  return children;
}
