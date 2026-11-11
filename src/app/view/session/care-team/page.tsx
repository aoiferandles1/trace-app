import type { Metadata } from "next";
import { CareTeamView } from "../_components/CareTeamView";

/** Held back until the session is confirmed active (see the session layout). */
export const instant = false;

export const metadata: Metadata = { title: "Care team" };

export default function SessionCareTeamPage() {
  return <CareTeamView />;
}
