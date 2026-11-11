import type { Metadata } from "next";
import { TimelineView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Full timeline" };

export default function TimelinePage() {
  return <TimelineView />;
}
