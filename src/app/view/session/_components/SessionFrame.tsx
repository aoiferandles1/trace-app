"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PatientSummaryCard, type HeaderFact } from "@/components/portal/PatientSummaryCard";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalSplit } from "@/components/portal/PortalSplit";
import { RecordFrame } from "@/components/portal/RecordFrame";
import {
  ResizableNotes,
  SessionNotesPanel,
  type SaveState,
  type SessionNotes,
} from "@/components/portal/SessionNotesPanel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Notice } from "@/components/ui/Notice";
import { TextArea } from "@/components/ui/TextArea";
import { formatCountdown } from "@/lib/format";
import { clockOffset, portalApi, PortalApiError, type PortalRecord, type PortalStatus } from "../../_lib/api";
import { formatClock, initials, patientFirstName, patientFullName, patientLine, sharedForLabel } from "../../_lib/format";
import { useNow, usePolling } from "../../_lib/hooks";
import { isGranted, VIEWS, viewDef, viewForPath } from "../../_lib/sections";
import { SessionContext, type SessionContextValue } from "./SessionContext";
import { NotSharedView } from "./Views";

/**
 * Everything around the record on /view/session/* (BRIEF.md 6.3):
 *
 * - Polls portal_status every 5 seconds while the session is live.
 * - active: the record frame (rail built from the scope, the patient
 *   header with the facts and the draining bar, the view, the resizable
 *   notes). The frame loads the overview once for the header; each view
 *   loads its own section. A view the patient did not grant is never
 *   mounted: "Not shared" shows in its place and nothing is requested.
 * - When the countdown reaches zero the record leaves the screen and memory
 *   at once and the status is checked straight away (the database decides
 *   what comes next, normally paused).
 * - paused: the record is gone; the notes can still be saved.
 * - ended: "Access ended", why, what happened to the notes, one way on.
 * - anything else: back to /view.
 *
 * Nothing about the patient is written to browser storage. The polite live
 * region announces the start, 5 and 1 minutes left, pause and end.
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

export function SessionFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [offset, setOffset] = useState(0);
  const [overview, setOverview] = useState<PortalRecord<"overview"> | null>(null);
  const [notes, setNotesState] = useState<SessionNotes>(EMPTY_NOTES);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [ending, setEnding] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [loadError, setLoadError] = useState(false);
  // Notes typed but not saved when the session ended: kept on screen so the doctor can copy them.
  const [unsaved, setUnsaved] = useState<SessionNotes | null>(null);
  // allow_notes is only returned while the session is live; the ended screen still needs it.
  const [notesAllowed, setNotesAllowed] = useState<boolean | null>(null);

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
      if (s.status === "active" || s.status === "paused") setNotesAllowed(Boolean(s.allow_notes));

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
      // The record leaves memory the moment access is not active.
      if (s.status !== "active") setOverview(null);
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

  // ---- The countdown: at zero, drop the record and ask the database ----------
  const timed = status?.status === "active" && status.duration_kind !== "manual" && Boolean(status.expires_at);
  const now = useNow(offset, 1000, timed);
  const msLeft = timed ? Date.parse(status!.expires_at!) - now : null;
  const timeUp = msLeft !== null && msLeft <= 0;
  // At zero the record leaves memory in this same render, not after the next poll.
  if (timeUp && overview) setOverview(null);
  useEffect(() => {
    if (!timeUp) return;
    // Ask now and, while the database still says active (clocks a moment apart), each second.
    const first = window.setTimeout(() => void refreshStatus(), 0);
    const id = window.setInterval(() => void refreshStatus(), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [timeUp, refreshStatus]);

  // ---- The overview, for the header (and the Overview view) -------------------
  const active = status?.status === "active" && !timeUp;
  useEffect(() => {
    if (!active || overview) return;
    let cancelled = false;
    portalApi
      .record("overview")
      .then((r) => {
        if (cancelled) return;
        if (r) setOverview(r);
        else void refreshStatus();
      })
      .catch(() => {
        if (!cancelled) void refreshStatus();
      });
    return () => {
      cancelled = true;
    };
  }, [active, overview, refreshStatus]);

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

  // Next's route announcer reads the page's h1 when the document has no
  // title at that moment (between a navigation and its metadata), and keeps
  // what it read. Here the h1 is the patient's name, which must not outlive
  // the session, so the document always has a title. Runs before the
  // announcer's own effect (children's effects run first).
  useLayoutEffect(() => {
    if (!document.title) document.title = "Clinical Access Portal";
  });

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

  const clinician = status?.clinician?.name
    ? { name: status.clinician.name, role: status.clinician.role ?? undefined, practice: status.clinician.practice ?? undefined }
    : undefined;
  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
  const patient = overview?.patient ?? null;
  const firstName = patientFirstName(patient);

  // ---- Loading, or the countdown just ran out ---------------------------------
  if (!status || !["active", "paused", "ended"].includes(status.status) || timeUp) {
    return (
      <PortalShell tone="ground" header={<PortalHeader clinician={clinician} />} footer={<PortalFooter />}>
        {liveRegion}
        <PortalSplit>
          <h1 className="font-display text-display font-light">
            {loadError ? "The portal could not reach Trace." : timeUp ? "Checking access" : "Loading the record"}
          </h1>
          {loadError && (
            <Button variant="text" className="mt-4 self-start" onClick={() => void refreshStatus()}>
              Try again
            </Button>
          )}
        </PortalSplit>
      </PortalShell>
    );
  }

  const ctx: SessionContextValue = {
    status,
    offset,
    overview,
    firstName,
    refreshStatus,
    notes,
    setNotes,
    saveNotes,
    saveState,
    endSession,
    ending,
  };

  // ---- Ended -------------------------------------------------------------------
  if (status.status === "ended") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell tone="ground" header={<PortalHeader clinician={clinician} />} footer={<PortalFooter />}>
          {liveRegion}
          <EndedScreen status={status} unsaved={unsaved} notesAllowed={notesAllowed} />
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  const notesPanel = (collapse?: { onCollapse: () => void; collapseRef: React.Ref<HTMLButtonElement> }) => (
    <SessionNotesPanel
      notes={notes}
      onChange={setNotes}
      onSave={() => void saveNotes()}
      saveState={saveState}
      patientFirstName={firstName}
      allowed={Boolean(status.allow_notes)}
      onCollapse={collapse?.onCollapse}
      collapseRef={collapse?.collapseRef}
    />
  );

  // ---- Paused ------------------------------------------------------------------
  if (status.status === "paused") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell
          tone="ground"
          header={<PortalHeader clinician={clinician} />}
          footer={<PortalFooter />}
          notes={status.allow_notes ? <aside aria-label="Session notes">{notesPanel()}</aside> : undefined}
        >
          {liveRegion}
          <PausedScreen status={status} offset={offset} onEnd={() => void endSession()} ending={ending} />
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  // ---- Active: the record ------------------------------------------------------
  const viewKey = viewForPath(pathname);
  const view = viewKey ? viewDef(viewKey) : null;
  const granted = view ? isGranted(view, status.scope) : true;
  const rail = (
    <PortalSidebar
      views={VIEWS.map((v) => ({ key: v.key, label: v.label, href: v.href, icon: v.icon, shared: isGranted(v, status.scope) }))}
      active={viewKey}
      clinician={clinician ? { name: clinician.name, practice: clinician.practice } : undefined}
    />
  );

  return (
    <SessionContext.Provider value={ctx}>
      <RecordFrame
        rail={rail}
        header={<RecordHeader status={status} overview={overview} msLeft={msLeft} />}
        notes={<ResizableNotes>{(collapse) => notesPanel(collapse)}</ResizableNotes>}
      >
        {liveRegion}
        <MilestoneAnnouncer msLeft={msLeft} onAnnounce={setAnnouncement} />
        {view && !granted ? <NotSharedView label={view.label} firstName={firstName} /> : children}
      </RecordFrame>
    </SessionContext.Provider>
  );
}

function RecordHeader({
  status,
  overview,
  msLeft,
}: {
  status: PortalStatus;
  overview: PortalRecord<"overview"> | null;
  msLeft: number | null;
}) {
  if (!overview) {
    return (
      <p role="status" className="flex min-h-14 items-center text-body-lg text-ink-2">
        Loading the record&hellip;
      </p>
    );
  }
  const name = patientFullName(overview.patient);
  const c = overview.critical;
  const facts: HeaderFact[] = [
    c.allergies.length > 0
      ? { label: c.allergies.length > 1 ? "Allergies" : "Allergy", value: c.allergies.join(", "), tone: "critical" }
      : { label: "Allergies", value: "None recorded" },
    { label: "Blood type", value: c.blood_type ?? "Not known" },
    ...(c.implants.length > 0 ? [{ label: c.implants.length > 1 ? "Implants" : "Implant", value: c.implants.join(", ") }] : []),
    {
      label: sharedForLabel(status.duration_kind),
      value: msLeft !== null ? `${formatCountdown(Math.max(0, msLeft))} left` : status.duration_kind === "manual" ? "No timer" : "",
    },
  ];
  const total =
    status.approved_at && status.expires_at ? Date.parse(status.expires_at) - Date.parse(status.approved_at) : null;
  return (
    <PatientSummaryCard
      name={name}
      initials={initials(name)}
      details={patientLine(overview.patient)}
      facts={facts}
      action={
        <ButtonLink href="/view/session/end" variant="secondary" size="sm">
          End session
        </ButtonLink>
      }
    >
      {msLeft !== null && total !== null && total > 0 && (
        <Countdown layout="inline" msLeft={msLeft} msTotal={total} label="Time left" />
      )}
    </PatientSummaryCard>
  );
}

/** Announces 5 minutes and 1 minute left, once each, in the frame's live region. */
function MilestoneAnnouncer({ msLeft, onAnnounce }: { msLeft: number | null; onAnnounce: (s: string) => void }) {
  const said = useRef<{ five: boolean; one: boolean }>({ five: false, one: false });
  useEffect(() => {
    if (msLeft === null) return;
    if (msLeft > 5 * 60_000) said.current = { five: false, one: false };
    else if (msLeft > 60_000 && !said.current.five) {
      said.current.five = true;
      onAnnounce("5 minutes of access left.");
    } else if (msLeft <= 60_000 && msLeft > 0 && !said.current.one) {
      said.current = { five: true, one: true };
      onAnnounce("1 minute of access left.");
    }
  }, [msLeft, onAnnounce]);
  return null;
}

function StateTitle({ label, title }: { label: string; title: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption font-medium text-ink-2">{label}</p>
      <h1 ref={heading} tabIndex={-1} className="font-display text-display font-light">
        {title}
      </h1>
    </div>
  );
}

function PausedScreen({
  status,
  offset,
  onEnd,
  ending,
}: {
  status: PortalStatus;
  offset: number;
  onEnd: () => void;
  ending: boolean;
}) {
  const now = useNow(offset, 1000);
  const closesAt = status.closes_at;
  const left = closesAt ? Date.parse(closesAt) - now : null;
  return (
    <PortalSplit>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <StateTitle label="Access paused" title="Time's up on this share." />
          <p className="text-body-lg text-ink-2">
            The patient&apos;s timer ran out, so their record is hidden. It comes back here if they add more time.
          </p>
          {left !== null && left > 0 && (
            <p className="text-caption text-ink-2">If nothing changes, the session closes at {formatClock(closesAt)}.</p>
          )}
          {status.allow_notes && (
            <p className="text-caption text-ink-2">
              You can still finish your notes. They go to the record when the session ends.
            </p>
          )}
        </div>
        <Button variant="secondary" size="lg" className="w-full sm:w-55" onClick={onEnd} loading={ending}>
          End session now
        </Button>
      </div>
    </PortalSplit>
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
      <Notice tone="urgent" live="assertive">
        Your last changes to the notes were not saved before the session ended, so they are not in the record. Copy
        them now if you need them: they are gone when you leave this page.
      </Notice>
      <TextArea label="Notes not saved" density="compact" rows={6} readOnly value={text} />
    </div>
  );
}

function EndedScreen({
  status,
  unsaved,
  notesAllowed,
}: {
  status: PortalStatus;
  unsaved: SessionNotes | null;
  notesAllowed: boolean | null;
}) {
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
    : (status.allow_notes ?? notesAllowed) && !unsaved
      ? "No session notes were written, so nothing was added to the record."
      : null;
  return (
    <PortalSplit>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <StateTitle label="Access ended" title={title} />
          <p className="text-body-lg text-ink-2">{body}</p>
          {notesLine && <p className="text-body-lg text-ink-2">{notesLine}</p>}
        </div>
        {unsaved && <UnsavedNotes notes={unsaved} />}
        <ButtonLink href="/view" size="lg" className="w-full sm:w-55">
          Enter a new code
        </ButtonLink>
      </div>
    </PortalSplit>
  );
}
