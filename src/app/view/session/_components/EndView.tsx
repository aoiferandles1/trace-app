"use client";

import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { useEffect } from "react";
import { PortalHero } from "@/components/portal/AccessCard";
import { Button, buttonClasses } from "@/components/ui/Button";
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

  const name = patient ? patientFullName(patient) : null;
  const first = patient ? patientFirstName(patient) : null;
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
        title={name ? `End session with ${name}` : "End session"}
        subtitle="Access closes immediately. Review your notes before saving."
      />
      <dl className="mt-8 flex flex-wrap gap-x-16 gap-y-4 px-5 sm:px-14">
        {[
          { label: "Duration", value: started ? formatDuration(now - Date.parse(started)) : "" },
          { label: "Started", value: formatClock(started) },
          { label: "Visit type", value: "GP" },
          { label: "Sections shared", value: String(sections) },
        ].map((s) => (
          <div key={s.label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-meta leading-4 text-ink-2">{s.label}</dt>
            <dd className="font-display text-numeral-lg font-light">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="end-notes"
        className="mx-5 mt-10 max-w-[880px] rounded-card border border-border-card bg-surface p-5 text-ink sm:mx-14 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border-card pb-4">
          <h2 id="end-notes" className="font-display text-heading font-light">
            Session notes
          </h2>
          {status.allow_notes && (
            <Link
              href="/view/session#notes"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Edit notes
            </Link>
          )}
        </div>
        {status.allow_notes ? (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.label} className={f.wide ? "flex flex-col gap-0.5 sm:col-span-2" : "flex flex-col gap-0.5"}>
                  <h3 className="text-meta leading-4 text-ink-2">{f.label}</h3>
                  <p className="whitespace-pre-line text-body-lg">
                    {f.value.trim() || <span className="text-ink-2">Nothing written</span>}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-caption text-ink-2">
              These notes will be written to {first ? `${first}'s` : "the patient's"} Trace record when you end the
              session. {first ?? "They"} can read everything you write.
            </p>
            {saveState === "error" && (
              <p role="alert" className="mt-3 text-caption text-critical">
                Your latest notes could not be saved. Ending the session will try again.
              </p>
            )}
          </>
        ) : (
          <p className="mt-6 text-caption text-ink-2">
            The patient did not allow notes for this session, so nothing is added to their record.
          </p>
        )}
      </section>

      <div className="mx-5 mt-8 flex max-w-[880px] flex-col-reverse gap-3 sm:mx-14 sm:flex-row sm:justify-between">
        <Link href="/view/session" className={buttonClasses({ variant: "secondary", size: "lg" })}>
          <Icon name="chevron-left" size={20} />
          Back to record
        </Link>
        <Button variant="primary" size="lg" onClick={() => void endSession()} loading={ending}>
          End session
        </Button>
      </div>
    </div>
  );
}
