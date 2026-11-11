"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { PaneHint } from "../_components/PaneHint";
import { TabScreen } from "../_components/Screens";
import { MedsPanel } from "./_components/MedsPanel";

/**
 * Medications (board MedsA2); the screen is `MedsPanel`. At desktop widths
 * the pane beside it waits for a medication to be chosen.
 */
function MedsScreen() {
  return (
    <TabScreen header={null} detail={<PaneHint>Choose a medication to see its history.</PaneHint>}>
      <MedsPanel />
    </TabScreen>
  );
}

export default function MedsPage() {
  return (
    <SessionReady>
      <MedsScreen />
    </SessionReady>
  );
}
