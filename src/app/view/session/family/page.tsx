import type { Metadata } from "next";
import { FamilyView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Family history" };

export default function FamilyPage() {
  return <FamilyView />;
}
