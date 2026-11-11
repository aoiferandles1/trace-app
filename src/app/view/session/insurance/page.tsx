import type { Metadata } from "next";
import { InsuranceView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Insurance" };

export default function InsurancePage() {
  return <InsuranceView />;
}
