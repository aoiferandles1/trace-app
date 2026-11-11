"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PatientShell } from "@/components/layout/PatientShell";
import { SessionReady, usePatientSession } from "@/components/patient/PatientSession";
import { useShareSession } from "@/components/patient/ShareSession";
import { Button } from "@/components/ui/Button";
import { Avatar, SectionLabel } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SwitchRow } from "@/components/ui/Switch";
import { ScopeTile } from "@/components/ui/Toggle";
import { initialsOf } from "@/lib/format";
import {
  createCodeArgs,
  DURATION_OPTIONS,
  GP_VISIT_DEFAULTS,
  isOpen,
  normaliseSession,
  SCOPES,
  shareErrorMessage,
  type DurationKind,
  type ScopeKey,
  type SharePrefs,
} from "@/lib/patient/share";
import { fullName, isUuid } from "@/lib/patient/types";
import { createClient } from "@/lib/supabase/client";
import { useLoad } from "@/lib/useLoad";
import { DemoMarker } from "../_components/Screens";

type Context = { clinician: string | null };

/** Who the appointment is with (the title). */
async function loadContext(appointmentId: string | null): Promise<Context> {
  const visit = appointmentId
    ? await createClient().from("entries").select("clinician").eq("id", appointmentId).maybeSingle()
    : { data: null };
  return { clinician: visit.data?.clinician?.trim() || null };
}

/**
 * Share confirm (board ShareA2). Every share passes through here: consent is
 * asked each time, at the moment of sharing (PLAN.md section 2).
 *
 * The scope tiles start from the GP visit profile: Safety info and
 * Medications are locked (always shared); Conditions, Recent visits, Full
 * timeline, Care team and Medication notes on; Documents, Family history and
 * Mental health off. Insurance is personal and has no tile (owner's
 * decision). Then the duration, "Doctor can add notes", the
 * count, and "Create share code", which calls the new create_share_code with
 * every scope named (it replaces any unused code).
 *
 * Reached from Home's today card (`?appointment=<visit id>`, which names the
 * doctor) or from Profile's "Share my record" on any day.
 */
function ShareConfirmScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const appointment = params.get("appointment");
  const appointmentId = appointment && isUuid(appointment) ? appointment : null;
  const { profile } = usePatientSession();
  const { session, setSession } = useShareSession();
  const context = useLoad(() => loadContext(appointmentId), [appointmentId]);
  const [prefs, setPrefs] = useState<SharePrefs>(GP_VISIT_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = context.status === "ready" ? context.data : null;
  const effective = prefs;

  function toggle(key: ScopeKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function create() {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await createClient().rpc("create_share_code", createCodeArgs(effective, appointmentId));
    if (rpcError || !data) {
      setBusy(false);
      setError(rpcError?.message ?? "unknown");
      return;
    }
    setSession(normaliseSession(data));
    router.push("/share/code");
  }

  const doctor = ctx?.clinician ?? null;
  const shared = SCOPES.filter((s) => s.key === null || effective[s.key]).length;
  const alreadyOpen = isOpen(session);
  const backHref = appointmentId ? "/home" : "/profile";

  return (
    <PatientShell
      demo={<DemoMarker />}
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div aria-hidden="true" className="flex min-w-0 flex-1 gap-1">
              {SCOPES.map((s) => (
                <span
                  key={s.id}
                  className={`h-1.5 max-w-5 flex-1 rounded-full ${s.key === null || effective[s.key] ? "bg-accent" : "bg-border-control"}`}
                />
              ))}
            </div>
            <p className="shrink-0 text-caption font-semibold">
              {shared} of {SCOPES.length} shared
            </p>
          </div>
          <Button size="xl" fullWidth onClick={create} loading={busy}>
            Create share code
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
        <header className="flex flex-col gap-3">
          <div className="relative flex h-14 items-center justify-center">
            <IconLink
              href={backHref}
              icon="arrow-left"
              label={appointmentId ? "Back to Home" : "Back to Profile"}
              size={44}
              className="absolute -left-2.5 top-1.5"
            />
            <div className="flex w-58 items-center gap-2">
              <Avatar initials={initialsOf(fullName(profile)) || "?"} size={56} tone="outline" />
              <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-dashed border-tree-node" />
              <Icon name="lock" size={20} strokeWidth={2} label="Shared securely" className="text-accent" />
              <span aria-hidden="true" className="h-0 flex-1 border-t-2 border-dashed border-tree-node" />
              {doctor ? (
                <Avatar initials={initialsOf(doctor)} size={56} tone="solid" />
              ) : (
                <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Icon name="person" />
                </span>
              )}
            </div>
          </div>
          <h1 className="text-center font-display text-title-sm font-light">
            {doctor ? `Share with ${doctor}` : "Share your record"}
          </h1>
        </header>

        {alreadyOpen && (
          <Notice tone="urgent">
            A doctor can already see your record.{" "}
            <Link href="/session" className="underline underline-offset-2">
              View session
            </Link>
          </Notice>
        )}

        <section aria-label="What your doctor can see" className="grid grid-cols-2 gap-3">
          {SCOPES.map((s) =>
            s.key === null ? (
              <ScopeTile key={s.id} icon={s.icon} label={s.label} locked />
            ) : s.key === "share_mental_health" ? (
              <ScopeTile
                key={s.id}
                icon={s.icon}
                label={s.label}
                caption="Private by default"
                wide
                privateByDefault
                checked={effective[s.key]}
                onCheckedChange={(v) => toggle("share_mental_health", v)}
              />
            ) : (
              <ScopeTile
                key={s.id}
                icon={s.icon}
                label={s.label}
                checked={effective[s.key]}
                onCheckedChange={(v) => toggle(s.key!, v)}
              />
            ),
          )}
        </section>

        <section aria-labelledby="duration-label" className="flex flex-col gap-2">
          <SectionLabel id="duration-label">For how long</SectionLabel>
          <SegmentedControl<DurationKind>
            label="For how long"
            size="lg"
            options={DURATION_OPTIONS}
            value={prefs.duration_kind}
            onChange={(v) => setPrefs((p) => ({ ...p, duration_kind: v }))}
          />
        </section>

        <SwitchRow
          surface="tile"
          control="track"
          title="Doctor can add notes"
          checked={prefs.allow_notes}
          onCheckedChange={(v) => setPrefs((p) => ({ ...p, allow_notes: v }))}
        />

        {error && (
          <Notice tone="critical" live="assertive">
            {shareErrorMessage(error)}
            {error === "session_live" && (
              <>
                {" "}
                <Link href="/session" className="underline underline-offset-2">
                  View session
                </Link>
              </>
            )}
          </Notice>
        )}
      </div>
    </PatientShell>
  );
}

export default function ShareConfirmPage() {
  return (
    <SessionReady>
      <ShareConfirmScreen />
    </SessionReady>
  );
}
