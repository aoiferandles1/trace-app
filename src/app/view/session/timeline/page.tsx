import type { Metadata } from "next";
import { TimelineView } from "../_components/TimelineView";

export const metadata: Metadata = { title: "Timeline" };

export default function SessionTimelinePage() {
  return <TimelineView />;
}
