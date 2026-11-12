"use client";

import { AddRows } from "@/components/patient/AddSheet";
import { PageHeader } from "@/components/patient/PageHeader";
import { SessionReady } from "@/components/patient/PatientSession";
import { TabScreen } from "../_components/Screens";

/**
 * Add to your record: the Add sheet's rows as a screen (BRIEF.md section 7).
 * The tab bar's plus opens them as a sheet over the current screen; this
 * address is where the desktop rail's Add goes, and where each form's Back
 * returns. Only what the app can add (PLAN.md section 11).
 */
function AddScreen() {
  return (
    <TabScreen header={<PageHeader title="Add to your record" />}>
      <div className="flex flex-col px-5 pb-8 pt-3.5">
        <AddRows back="/add" />
      </div>
    </TabScreen>
  );
}

export default function AddPage() {
  return (
    <SessionReady>
      <AddScreen />
    </SessionReady>
  );
}
