import type { Metadata } from "next";
import { Suspense } from "react";
import { VisitsView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Recent visits" };

/** `?id=` selects a visit (Overview's and Mental health's rows link here with it). */
export default function VisitsPage() {
  return (
    <Suspense>
      <VisitsView />
    </Suspense>
  );
}
