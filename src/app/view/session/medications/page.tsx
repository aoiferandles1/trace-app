import type { Metadata } from "next";
import { Suspense } from "react";
import { MedicationsView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Medications" };

/** `?id=` selects a medication (Overview's rows link here with it). */
export default function MedicationsPage() {
  return (
    <Suspense>
      <MedicationsView />
    </Suspense>
  );
}
