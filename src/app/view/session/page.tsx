import type { Metadata } from "next";
import { Overview } from "./_components/Overview";

/** Held back until the session is confirmed active (see ../layout.tsx). */
export const instant = false;

export const metadata: Metadata = { title: "Overview" };

export default function SessionOverviewPage() {
  return <Overview />;
}
