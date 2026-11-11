import type { Metadata } from "next";
import { MedicationsView } from "../_components/MedicationsView";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Medications" };

export default function SessionMedicationsPage() {
  return <MedicationsView />;
}
