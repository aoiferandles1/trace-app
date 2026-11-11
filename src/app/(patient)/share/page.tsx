"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SessionReady } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Card";
import { ChoiceCardGroup } from "@/components/ui/ChoiceCardGroup";
import { HintStrip } from "@/components/ui/HintStrip";
import { LockedRow, SwitchGroup, SwitchRow } from "@/components/ui/Switch";
import {
  DURATION_OPTIONS,
  GP_VISIT_DEFAULTS,
  isOpen,
  normaliseSession,
  shareErrorMessage,
  type DurationKind,
  type SharePrefs,
} from "@/lib/patient/share";
import { isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { SubScreen } from "../_components/Screens";

/**
 * Confirm preferences (p-prefs). Every share passes through here: consent is
 * asked each time, at the moment of sharing (PLAN.md section 2). It starts
 * from the GP visit profile; Critical safety and Medications cannot be
 * switched off; mental health is off unless turned on for this share.
 *
 * Reached from the appointment-day card (`?appointment=<visit id>`) or from
 * "Share my record" in Profile on any day (no appointment). Documents and
 * Insurance are left out (not in the MVP). "Generate share code" calls
 * create_share_code, which replaces any unused code ("Regenerate").
 */
function SharePrefsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const appointment = params.get("appointment");
  const appointmentId = appointment && isUuid(appointment) ? appointment : null;
  const { session, setSession } = useShareSession();
  const [prefs, setPrefs] = useState<SharePrefs>(GP_VISIT_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof SharePrefs>(key: K) => (value: SharePrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  async function generate() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("create_share_code", {
      ...prefs,
      ...(appointmentId ? { appointment_entry_id: appointmentId } : {}),
    });
    if (rpcError || !data) {
      setBusy(false);
      setError(rpcError?.message ?? "unknown");
      return;
    }
    setSession(normaliseSession(data));
    router.push("/share/code");
  }

  const alreadyOpen = isOpen(session);

  return (
    <SubScreen
      title="Share Record"
      backHref={appointmentId ? "/home" : "/profile"}
      backLabel={appointmentId ? "Back to Home" : "Back to My profile"}
      footer={
        <Button size="lg" fullWidth onClick={generate} loading={busy}>
          Generate share code
        </Button>
      }
    >
      <div className="flex flex-col gap-6 px-4 pb-8 pt-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-h3 font-medium">Confirm preferences</h2>
          <p className="text-body-sm text-text-tertiary">
            Confirm or edit what you consent to your doctor having access to
          </p>
        </div>

        {alreadyOpen && (
          <HintStrip tone="peach">
            A doctor can already see your record.{" "}
            <Link href="/session" className="underline underline-offset-2">
              View session
            </Link>
          </HintStrip>
        )}

        <section aria-labelledby="using-label" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel id="using-label">Sharing using</SectionLabel>
            <p className="text-body-sm font-medium text-indigo-text">GP visit profile</p>
          </div>
          <SwitchGroup aria-label="What your doctor can see">
            <LockedRow title="Critical safety" tone="critical" />
            <LockedRow title="Medications" />
            <SwitchRow
              title="Active conditions"
              checked={prefs.share_conditions}
              onCheckedChange={set("share_conditions")}
            />
            <SwitchRow
              title="Recent visits (last 3)"
              checked={prefs.share_recent_visits}
              onCheckedChange={set("share_recent_visits")}
            />
            <SwitchRow
              title="Full timeline"
              checked={prefs.share_full_timeline}
              onCheckedChange={set("share_full_timeline")}
            />
            <SwitchRow title="Care team" checked={prefs.share_care_team} onCheckedChange={set("share_care_team")} />
          </SwitchGroup>
          <SwitchRow
            surface="sunken"
            title="Mental health history"
            description="Off by default · tap to include"
            checked={prefs.share_mental_health}
            onCheckedChange={set("share_mental_health")}
          />
        </section>

        <ChoiceCardGroup<DurationKind>
          legend="Share for"
          options={DURATION_OPTIONS}
          value={prefs.duration_kind}
          onChange={set("duration_kind")}
        />

        <SwitchRow
          surface="sunken"
          title="Doctor can add session notes"
          description="Notes are added to your record when the session ends"
          checked={prefs.allow_notes}
          onCheckedChange={set("allow_notes")}
        />

        {error && (
          <HintStrip tone="danger" live="assertive">
            {shareErrorMessage(error)}
            {error === "session_live" && (
              <>
                {" "}
                <Link href="/session" className="underline underline-offset-2">
                  View session
                </Link>
              </>
            )}
          </HintStrip>
        )}
      </div>
    </SubScreen>
  );
}

export default function SharePrefsPage() {
  return (
    <SessionReady>
      <SharePrefsScreen />
    </SessionReady>
  );
}
