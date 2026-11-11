import type { Metadata } from "next";
import { TimelineView } from "../_components/TimelineView";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Timeline" };

export default function SessionTimelinePage() {
  return <TimelineView />;
}
