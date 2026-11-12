"use client";

import { AddLink } from "@/components/patient/AddLink";
import { SessionReady } from "@/components/patient/PatientSession";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { must, useLoad } from "@/lib/useLoad";
import { vitalsLine, type VitalsRow } from "../../_components/forms/VitalsForm";
import { LoadStatus, SubScreen } from "../../_components/Screens";

/**
 * Vitals (F1; no board): every reading, newest first, each opening its
 * Edit form, and "Log vitals". The table was there (the portal shows the
 * latest reading); nothing in the patient app showed or wrote it.
 */
function VitalsScreen() {
  const data = useLoad(async () =>
    must(await createClient().from("vitals").select("*").order("recorded_on", { ascending: false }).limit(200)) as VitalsRow[],
  );
  return (
    <SubScreen title="Vitals" backHref="/record" backLabel="Back to Record" tabBar>
      <div className="flex flex-col gap-1 px-5 pb-6 pt-3.5">
        {data.status !== "ready" ? (
          <LoadStatus status={data.status} onRetry={data.reload} />
        ) : data.data.length === 0 ? (
          <p className="py-2 text-body text-ink-2">No readings yet.</p>
        ) : (
          <Card as="ul" aria-label="Readings">
            {data.data.map((v) => (
              <li key={v.id}>
                <ListRow
                  title={formatDay(v.recorded_on)}
                  caption={vitalsLine(v) || "No readings"}
                  href={`/record/vitals/${v.id}/edit`}
                  chevron
                  padY={12}
                />
              </li>
            ))}
          </Card>
        )}
        <AddLink href="/add/vitals?back=/record/vitals">Log vitals</AddLink>
      </div>
    </SubScreen>
  );
}

export default function VitalsPage() {
  return (
    <SessionReady>
      <VitalsScreen />
    </SessionReady>
  );
}
