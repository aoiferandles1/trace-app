import type { Metadata } from "next";
import { Suspense } from "react";
import { TimelineView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Full timeline" };

/** `?id=` selects an event (Mental health's rows link here with it). */
export default function TimelinePage() {
  return (
    <Suspense>
      <TimelineView />
    </Suspense>
  );
}
