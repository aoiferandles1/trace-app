"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { PortalHero } from "@/components/portal/AccessCard";
import { Button } from "@/components/ui/Button";
import { portalApi } from "../../_lib/api";
import { formatClock, formatDuration, patientFirstName, patientFullName, scopeLists } from "../../_lib/format";
import { useNow } from "../../_lib/hooks";
import { useSession } from "./SessionContext";

/**
 * c-end (867:56288): "End session with Jane Doe", the duration, start time,
 * visit type and number of sections shared, the notes to review, then
 * "Back to record" and "End session" (which closes access on both sides and
 * writes the notes to the patient's record).
 */
export function EndView() {
  const { status, offset, patient, setPatient, refreshStatus, notes, endSession, ending, saveState } = useSession();
  const now = useNow(offset, 30_000);

  // Opened directly (a reload on this page): fetch the name for the heading.
  useEffect(() => {
    if (patient) return;
    let cancelled = false;
    portalApi
      .record("overview")
      .then((r) => {
        if (cancelled) return;
        if (r) setPatient(r.patient);
        else void refreshStatus();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [patient, setPatient, refreshStatus]);

  const name = patient ? patientFullName(patient) : "your patient";
  const first = patient ? patientFirstName(patient) : "the patient";
  const started = status.approved_at;
  const sections = status.scope ? scopeLists(status.scope).shared.length : 0;
  const fields: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: "Chief complaint", value: notes.chiefComplaint },
    { label: "Assessment", value: notes.assessment },
    { label: "Plan", value: notes.plan, wide: true },
    { label: "Follow-up", value: notes.followUp, wide: true },
  ];

  return (
    <div className="pb-16">
      <PortalHero
        title={`End session with ${name}`}
        subtitle="Access closes immediately. Review your notes before saving."
      />
      <dl className="mx-auto mt-8 flex max-w-[600px] flex-wrap justify-center gap-y-4 px-4 text-center">
        {[
          { label: "Duration", value: started ? formatDuration(now - Date.parse(started)) : "" },
          { label: "Started", value: formatClock(started) },
          { label: "Visit type", value: "GP" },
          { label: "Sections shared", value: String(sections) },
        ].map((s, i) => (
          <div
            key={s.label}
            className={i > 0 ? "flex flex-col-reverse border-l border-white/30 px-6 sm:px-8" : "flex flex-col-reverse px-6 sm:px-8"}
          >
            <dt className="mt-1 text-label font-medium uppercase">{s.label}</dt>
            <dd className="font-display text-[28px] font-bold leading-none">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="end-notes"
        className="mx-4 mt-10 max-w-[880px] rounded-pill-tight bg-surface-card p-6 text-text-primary sm:mx-auto sm:p-8"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border-default pb-4">
          <h2 id="end-notes" className="text-body-sm font-bold">
            Session notes
          </h2>
          {status.allow_notes && (
            <Link
              href="/view/session#notes"
              className="hit-area inline-flex h-8 items-center rounded-pill border border-brand-indigo px-4 text-button-sm font-medium text-indigo-text hovered:bg-brand-indigo-tint"
            >
              Edit notes
            </Link>
          )}
        </div>
        {status.allow_notes ? (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.label} className={f.wide ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
                  <h3 className="text-body-sm text-text-tertiary">{f.label}</h3>
                  <p className="min-h-12 whitespace-pre-line rounded-md border border-border-default bg-brand-indigo-tint px-4 py-3 text-body-lg">
                    {f.value.trim() || <span className="text-text-tertiary">Nothing written</span>}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-body-sm text-text-tertiary">
              These notes will be written to {first}&rsquo;s Trace record when you end the session. {first} can read
              everything you write.
            </p>
            {saveState === "error" && (
              <p role="alert" className="mt-3 text-body-sm text-red-700">
                Your latest notes could not be saved. Ending the session will try again.
              </p>
            )}
          </>
        ) : (
          <p className="mt-6 text-body-sm text-text-tertiary">
            The patient did not allow notes for this session, so nothing is added to their record.
          </p>
        )}
      </section>

      <div className="mx-4 mt-8 flex max-w-[880px] flex-col-reverse gap-3 sm:mx-auto sm:flex-row sm:justify-between">
        <Link
          href="/view/session"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-pill border border-white px-6 text-button-lg font-medium text-white hovered:bg-white/10"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          Back to record
        </Link>
        <Button variant="tertiary" size="lg" onClick={() => void endSession()} loading={ending}>
          End session
        </Button>
      </div>
    </div>
  );
}
