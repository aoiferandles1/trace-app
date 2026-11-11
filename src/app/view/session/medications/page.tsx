import type { Metadata } from "next";
import { MedicationsView } from "../_components/MedicationsView";

export const metadata: Metadata = { title: "Medications" };

export default function SessionMedicationsPage() {
  return <MedicationsView />;
}
