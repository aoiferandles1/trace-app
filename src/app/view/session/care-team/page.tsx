import type { Metadata } from "next";
import { CareTeamView } from "../_components/CareTeamView";

export const metadata: Metadata = { title: "Care team" };

export default function SessionCareTeamPage() {
  return <CareTeamView />;
}
