"use client";

import { SessionReady } from "@/components/patient/PatientSession";
import { PaneHint } from "../_components/PaneHint";
import { TabScreen } from "../_components/Screens";
import { RecordPanel } from "./_components/RecordPanel";

/**
 * Record (board RecordA2); the screen is `RecordPanel`. At desktop widths
 * the pane beside it waits for an entry or a condition to be chosen.
 */
function RecordScreen() {
  return (
    <TabScreen header={null} detail={<PaneHint>Choose an entry or a condition to see it here.</PaneHint>}>
      <RecordPanel />
    </TabScreen>
  );
}

export default function RecordPage() {
  return (
    <SessionReady>
      <RecordScreen />
    </SessionReady>
  );
}
