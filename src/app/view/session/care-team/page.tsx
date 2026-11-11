import type { Metadata } from "next";
import { CareTeamView } from "../_components/Views";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Care team" };

export default function CareTeamPage() {
  return <CareTeamView />;
}
