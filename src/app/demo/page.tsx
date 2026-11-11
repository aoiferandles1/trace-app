import type { Metadata } from "next";
import { DemoStage } from "./DemoStage";

export const metadata: Metadata = {
  title: "Try both sides",
  description: "Trace's patient app and clinician portal side by side, with sample data.",
};

/**
 * /demo (PLAN.md section 9): the patient app in a phone frame beside the
 * portal in a laptop frame, so a visitor can play both sides of one GP visit.
 * Both frames are same-origin iframes: the patient app keeps its Supabase
 * session in its own cookies, the portal keeps its token in an httpOnly
 * cookie scoped to /api/portal and never uses the patient's session (see
 * src/app/api/portal/_lib/portal.ts), so the two do not interfere.
 */
export default function DemoPage() {
  return <DemoStage />;
}
