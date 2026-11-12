import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Clinical Access Portal", template: "%s · Trace Clinical Access Portal" },
  description: "Read a patient's Trace record for this visit, with their permission. A portfolio project, not a medical service.",
  robots: { index: false, follow: false },
  // Saved to a home screen from here, the portal is its own app ("Trace Portal"),
  // beside the patient app's: see ./manifest.webmanifest/route.ts.
  manifest: "/view/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Trace Portal", statusBarStyle: "default" },
};

/**
 * The clinician portal (PLAN.md section 6). No Supabase session here: the
 * browser talks only to /api/portal/*, and src/proxy.ts skips /view.
 */
export default function ViewLayout({ children }: LayoutProps<"/view">) {
  return children;
}
