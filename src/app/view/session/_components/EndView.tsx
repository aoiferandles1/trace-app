"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatClock, formatDuration, patientFullName } from "../../_lib/format";
import { useNow } from "../../_lib/hooks";
import { useSession } from "./SessionContext";
import { EndProblemNotice } from "./SessionFrame";

/**
 * /view/session/end: the step before ending, inside the record frame (the
 * header's "End session" leads here). Ending closes access on both sides at
 * once and writes the notes to the patient's record, so the doctor sees
 * how long the session ran and that the patient can read the notes (the
 * notes panel beside it already says where they go), then "End session" or
 * back to the view they came from.
 *
 * If the latest notes cannot be saved first, the session stays open and
 * says so, with a way to end it without them; if ending fails, it says so.
 */
export function EndView() {
  const { status, offset, overview, firstName, endSession, ending, saveState, endProblem, returnTo } = useSession();
  const now = useNow(offset, 30_000);
  const name = overview ? patientFullName(overview.patient) : null;
  const started = status.approved_at;
  const who = firstName === "the patient" ? "The patient" : firstName;

  return (
    <div className="flex max-w-150 flex-col gap-7 pt-8.5">
      <div className="flex flex-col gap-2.5">
        <h2 className="font-display text-title-md font-light">{name ? `End session with ${name}` : "End session"}</h2>
        <p className="text-body-lg text-ink-2">Access closes on both sides straight away.</p>
      </div>
      {started && (
        <dl className="flex flex-wrap gap-x-16 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta leading-4 text-ink-2">Started</dt>
            <dd className="text-row-lg font-semibold">{formatClock(started)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta leading-4 text-ink-2">Duration</dt>
            <dd className="text-row-lg font-semibold">{formatDuration(now - Date.parse(started))}</dd>
          </div>
        </dl>
      )}
      <p className="text-body-lg">
        {status.allow_notes
          ? `${who} can read everything you write.`
          : `${who} did not allow notes, so nothing is added to the record.`}
      </p>
      {saveState === "error" && !endProblem && (
        <p role="alert" className="text-caption text-critical">
          Your latest notes could not be saved. Ending the session will try again.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg" className="w-full sm:w-55" onClick={() => void endSession()} loading={ending}>
            End session
          </Button>
          <Link href={returnTo} className="flex min-h-11 items-center text-label font-semibold text-accent hovered:underline">
            Back to the record
          </Link>
        </div>
        <EndProblemNotice
          problem={endProblem}
          ending={ending}
          onEndAnyway={() => void endSession({ withoutLatestNotes: true })}
        />
      </div>
    </div>
  );
}
