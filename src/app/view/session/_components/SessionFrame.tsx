"use client";

import { Clock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { AccessCard, PortalHero } from "@/components/portal/AccessCard";
import { LiveBanner } from "@/components/portal/LiveBanner";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar, portalNavItems, type PortalSection } from "@/components/portal/PortalSidebar";
import { SessionNotesPanel, type SaveState, type SessionNotes } from "@/components/portal/SessionNotesPanel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { HintStrip } from "@/components/ui/HintStrip";
import { TextArea } from "@/components/ui/TextArea";
import { formatCountdown, initialsOf } from "@/lib/format";
import { clockOffset, portalApi, PortalApiError, type Patient, type PortalStatus } from "../../_lib/api";
import { formatClock, patientDetails, patientFirstName, patientFullName } from "../../_lib/format";
import { useNow, usePolling } from "../../_lib/hooks";
import { SessionContext, useSession, type SessionContextValue } from "./SessionContext";

/**
 * Everything around the record on /view/session/* (PLAN.md sections 6 to 8):
 *
 * - Polls portal_status every 5 seconds while the session is live.
 * - active: PortalShell with the sidebar, the LIVE banner and countdown, the
 *   page (the record), and the notes panel when the patient allowed notes.
 * - paused (new, no frame): the record is gone; notes can still be saved.
 * - ended (new, no frame): by the patient, the doctor or the timer.
 * - anything else: back to /view.
 *
 * The record pages render only while the status is active, so their data
 * unmounts the moment a poll says the session paused or ended. The polite
 * live region announces the start, 5 and 1 minutes left, pause and end.
 */

const EMPTY_NOTES: SessionNotes = { chiefComplaint: "", assessment: "", plan: "", followUp: "" };
const AUTOSAVE_MS = 1200;

function notesFromStatus(s: PortalStatus): SessionNotes {
  return {
    chiefComplaint: s.notes?.chief_complaint ?? "",
    assessment: s.notes?.assessment ?? "",
    plan: s.notes?.plan ?? "",
    followUp: s.notes?.follow_up ?? "",
  };
}

function toApi(n: SessionNotes) {
  return { chief_complaint: n.chiefComplaint, assessment: n.assessment, plan: n.plan, follow_up: n.followUp };
}

function sectionFor(pathname: string): PortalSection {
  if (pathname.startsWith("/view/session/timeline")) return "timeline";
  if (pathname.startsWith("/view/session/medications")) return "medications";
  if (pathname.startsWith("/view/session/care-team")) return "care-team";
  return "overview";
}

export function SessionFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [offset, setOffset] = useState(0);
  const [patient, setPatientState] = useState<Patient | null>(null);
  const [notes, setNotesState] = useState<SessionNotes>(EMPTY_NOTES);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [ending, setEnding] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [loadError, setLoadError] = useState(false);
  // Notes typed but not saved when the session ended: kept on screen so the doctor can copy them.
  const [unsaved, setUnsaved] = useState<SessionNotes | null>(null);

  const notesLoaded = useRef(false);
  const lastSaved = useRef(JSON.stringify(EMPTY_NOTES));
  const notesRef = useRef(notes);
  const autosave = useRef<number | undefined>(undefined);

  const prevStatus = useRef<string | null>(null);
  const allowNotes = useRef(false);

  const applyStatus = useCallback(
    (s: PortalStatus) => {
      setOffset(clockOffset(s.server_time));
      setStatus(s);
      allowNotes.current = Boolean(s.allow_notes);

      // Announcements: start, back from a pause, pause, end. (5 and 1 minutes
      // left come from MilestoneAnnouncer.)
      const prev = prevStatus.current;
      prevStatus.current = s.status;
      if (s.status !== prev) {
        if (s.status === "active" && prev === null) setAnnouncement("Session started. You are reading the shared record.");
        if (s.status === "active" && prev === "paused") setAnnouncement("The patient added more time. The record is back.");
        if (s.status === "paused") setAnnouncement("Access paused. The patient's time ran out and the record is hidden.");
        if (s.status === "ended") setAnnouncement("Session ended. Access to the record is closed.");
      }

      if (!notesLoaded.current && (s.status === "active" || s.status === "paused") && s.allow_notes) {
        notesLoaded.current = true;
        const n = notesFromStatus(s);
        lastSaved.current = JSON.stringify(n);
        notesRef.current = n;
        setNotesState(n);
      }
      if (s.status === "ended" && notesLoaded.current && JSON.stringify(notesRef.current) !== lastSaved.current) {
        window.clearTimeout(autosave.current);
        setUnsaved(notesRef.current);
      }
      if (s.status !== "active") setPatientState(null);
      if (!["active", "paused", "ended"].includes(s.status)) router.replace("/view");
    },
    [router],
  );

  const refreshStatus = useCallback(async () => {
    try {
      applyStatus(await portalApi.status());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [applyStatus]);

  useEffect(() => {
    portalApi
      .status()
      .then(applyStatus)
      .catch(() => setLoadError(true));
  }, [applyStatus]);

  const live = status?.status === "active" || status?.status === "paused";
  usePolling(refreshStatus, 5000, live);

  // ---- Notes -------------------------------------------------------------
  const saveNotes = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(autosave.current);
    const current = notesRef.current;
    const json = JSON.stringify(current);
    setSaveState("saving");
    try {
      await portalApi.saveNotes(toApi(current));
      lastSaved.current = json;
      setSaveState("saved");
      // A save that was still on its way when the session ended did reach it.
      if (JSON.stringify(notesRef.current) === json) setUnsaved(null);
      return true;
    } catch (e) {
      setSaveState("error");
      if (e instanceof PortalApiError && e.code === "session_not_active") void refreshStatus();
      return false;
    }
  }, [refreshStatus]);

  const setNotes = useCallback(
    (n: SessionNotes) => {
      notesRef.current = n;
      setNotesState(n);
      setSaveState((s) => (s === "saved" ? "idle" : s));
      window.clearTimeout(autosave.current);
      autosave.current = window.setTimeout(() => {
        if (JSON.stringify(notesRef.current) !== lastSaved.current) void saveNotes();
      }, AUTOSAVE_MS);
    },
    [saveNotes],
  );

  useEffect(() => () => window.clearTimeout(autosave.current), []);

  const endSession = useCallback(async () => {
    setEnding(true);
    try {
      if (allowNotes.current && JSON.stringify(notesRef.current) !== lastSaved.current) {
        await saveNotes();
      }
      applyStatus(await portalApi.end());
    } catch {
      setAnnouncement("The session could not be ended. Check your connection and try again.");
      void refreshStatus();
    } finally {
      setEnding(false);
    }
  }, [applyStatus, refreshStatus, saveNotes]);

  const setPatient = useCallback((p: Patient) => setPatientState(p), []);


  const header = (
    <PortalHeader
      clinician={
        status?.clinician?.name
          ? {
              name: status.clinician.name,
              role: status.clinician.role ?? undefined,
              practice: status.clinician.practice ?? undefined,
            }
          : undefined
      }
    />
  );
  const footer = <PortalFooter />;
  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );

  // ---- Loading -------------------------------------------------------------
  if (!status || !["active", "paused", "ended"].includes(status.status)) {
    return (
      <PortalShell tone="indigo" header={header} footer={footer}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="font-display text-display-sm font-light">
            {loadError ? "The portal could not reach Trace." : "Loading the record"}
          </h1>
          {loadError && (
            <Button variant="tertiary" onClick={() => void refreshStatus()}>
              Try again
            </Button>
          )}
        </div>
      </PortalShell>
    );
  }

  const ctx: SessionContextValue = {
    status,
    offset,
    patient,
    setPatient,
    refreshStatus,
    notes,
    setNotes,
    saveNotes,
    saveState,
    endSession,
    ending,
  };

  const notesPanel = status.allow_notes ? (
    <div id="notes">
      <SessionNotesPanel
        notes={notes}
        onChange={setNotes}
        onSave={() => void saveNotes()}
        onEndSession={() => router.push("/view/session/end")}
        saveState={saveState}
        patientFirstName={patient ? patientFirstName(patient) : "the patient"}
      />
    </div>
  ) : undefined;

  // ---- Ended -------------------------------------------------------------------
  if (status.status === "ended") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell tone="indigo" header={header} footer={footer}>
          {liveRegion}
          <EndedScreen status={status} unsaved={unsaved} />
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  // ---- Paused ------------------------------------------------------------------
  if (status.status === "paused") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell header={header} footer={footer} notes={notesPanel}>
          {liveRegion}
          <PausedScreen status={status} offset={offset} />
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  // ---- Active: c-end -------------------------------------------------------------
  if (pathname === "/view/session/end") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell tone="indigo" header={header} footer={footer}>
          {liveRegion}
          <MilestoneAnnouncer status={status} offset={offset} onAnnounce={setAnnouncement} />
          {children}
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  // ---- Active: the record --------------------------------------------------------
  const scope = status.scope;
  const locked: PortalSection[] = ["documents", "insurance"];
  if (scope && !scope.care_team) locked.push("care-team");
  if (scope && !scope.recent_visits && !scope.full_timeline) locked.push("timeline");
  const name = patient ? patientFullName(patient) : "Patient";

  return (
    <SessionContext.Provider value={ctx}>
      <PortalShell
        header={header}
        footer={footer}
        notes={notesPanel}
        sidebar={
          <PortalSidebar
            patient={{
              name,
              initials: patient ? initialsOf(name) : "",
              details: patientDetails(patient),
            }}
            items={portalNavItems(locked)}
            active={sectionFor(pathname)}
          />
        }
      >
        {liveRegion}
        <MilestoneAnnouncer status={status} offset={offset} onAnnounce={setAnnouncement} />
        <div className="flex flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 lg:px-12 lg:pt-8">
          <Banner status={status} offset={offset} patientName={name} />
          {children}
        </div>
      </PortalShell>
    </SessionContext.Provider>
  );
}

function Banner({ status, offset, patientName }: { status: PortalStatus; offset: number; patientName: string }) {
  const router = useRouter();
  const manual = status.duration_kind === "manual";
  const now = useNow(offset, 1000, !manual);
  const left = status.expires_at ? Date.parse(status.expires_at) - now : null;
  return (
    <LiveBanner
      patientName={patientName}
      timeLeft={!manual && left !== null ? formatCountdown(left) : undefined}
      onEndSession={() => router.push("/view/session/end")}
    />
  );
}

/** Announces 5 minutes and 1 minute left, once each, in the frame's live region. */
function MilestoneAnnouncer({
  status,
  offset,
  onAnnounce,
}: {
  status: PortalStatus;
  offset: number;
  onAnnounce: (s: string) => void;
}) {
  const manual = status.duration_kind === "manual";
  const now = useNow(offset, 1000, !manual);
  const left = status.expires_at ? Date.parse(status.expires_at) - now : null;
  const said = useRef<{ five: boolean; one: boolean }>({ five: false, one: false });
  useEffect(() => {
    if (left === null || manual) return;
    if (left > 5 * 60_000) said.current = { five: false, one: false };
    else if (left > 60_000 && !said.current.five) {
      said.current.five = true;
      onAnnounce("5 minutes of access left.");
    } else if (left <= 60_000 && left > 0 && !said.current.one) {
      said.current = { five: true, one: true };
      onAnnounce("1 minute of access left.");
    }
  }, [left, manual, onAnnounce]);
  return null;
}

function PausedScreen({ status, offset }: { status: PortalStatus; offset: number }) {
  const { endSession, ending } = useSession();
  const now = useNow(offset, 1000);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const closesAt = status.closes_at;
  const left = closesAt ? Date.parse(closesAt) - now : null;
  return (
    <div className="px-4 py-12 sm:px-8 lg:py-20">
      <AccessCard
        headingRef={heading}
        eyebrow="Access paused"
        tone="peach"
        title="Time's up on this share."
        body="The patient's timer ran out, so their record is hidden. It comes back here if they add more time."
      >
        {left !== null && left > 0 && (
          <p className="flex items-center gap-2 text-label font-medium text-indigo-text">
            <Clock aria-hidden="true" className="size-4 shrink-0" />
            If nothing changes, the session closes at {formatClock(closesAt)}.
          </p>
        )}
        {status.allow_notes && (
          <HintStrip tone="indigo">You can still finish your notes. They go to the record when the session ends.</HintStrip>
        )}
        <Button variant="secondary" size="lg" fullWidth onClick={() => void endSession()} loading={ending}>
          End session now
        </Button>
      </AccessCard>
    </div>
  );
}

/** The doctor's last changes that never reached the record, to copy elsewhere. */
function UnsavedNotes({ notes }: { notes: SessionNotes }) {
  const text = [
    ["Chief complaint", notes.chiefComplaint],
    ["Assessment", notes.assessment],
    ["Plan", notes.plan],
    ["Follow-up", notes.followUp],
  ]
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n\n");
  if (!text) return null;
  return (
    <div className="flex flex-col gap-3">
      <HintStrip tone="peach" live="assertive">
        Your last changes to the notes were not saved before the session ended, so they are not in the record. Copy
        them now if you need them: they are gone when you leave this page.
      </HintStrip>
      <TextArea label="Notes not saved" labelStyle="eyebrow" density="compact" rows={6} readOnly value={text} />
    </div>
  );
}

function EndedScreen({ status, unsaved }: { status: PortalStatus; unsaved: SessionNotes | null }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const by = status.ended_by;
  const title =
    by === "patient"
      ? "Your patient ended the session."
      : by === "timeout"
        ? "The session has closed."
        : "You ended the session.";
  const body =
    by === "patient"
      ? "They stopped sharing from their phone. Access to their record is closed."
      : by === "timeout"
        ? "The patient's time ran out and they did not add more. Access to their record is closed."
        : "Access to the record is closed on both sides.";
  const notesLine = status.notes_saved_to_record
    ? "Your session notes were saved to the patient's record."
    : status.allow_notes
      ? "No session notes were written, so nothing was added to the record."
      : null;
  return (
    <>
      <PortalHero title="Session ended." />
      <div className="px-4 pt-12 pb-16 sm:pt-[60px]">
        <AccessCard headingRef={heading} eyebrow="Session ended" tone="neutral" title={title} body={body}>
          {notesLine && <HintStrip tone={status.notes_saved_to_record ? "teal" : "neutral"}>{notesLine}</HintStrip>}
          {unsaved && <UnsavedNotes notes={unsaved} />}
          <ButtonLink href="/view" size="lg" fullWidth>
            Start a new session
          </ButtonLink>
        </AccessCard>
      </div>
    </>
  );
}
