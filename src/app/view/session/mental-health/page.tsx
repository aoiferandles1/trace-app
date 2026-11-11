import type { Metadata } from "next";
import { MentalHealthView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Mental health" };

export default function MentalHealthPage() {
  return <MentalHealthView />;
}
