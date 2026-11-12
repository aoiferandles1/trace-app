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
  createFocusMemory,
  notesText,
  ResizableNotes,
  SessionNotesPanel,
  type SaveState,
  type SessionNotes,
} from "@/components/portal/SessionNotesPanel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { TextArea } from "@/components/ui/TextArea";
import { formatCountdown } from "@/lib/format";
import {
  clockOffset,
  firstStatus,
  portalApi,
  PortalApiError,
  type PortalRecord,
  type PortalStatus,
} from "../../_lib/api";
import {
  formatClock,
  formatDuration,
  initials,
  patientFirstName,
  patientFullName,
  patientLine,
  sharedForLabel,
} from "../../_lib/format";
import { portalHome, useDemo, useInDemoFrame, useNow, usePolling } from "../../_lib/hooks";
import { isGranted, VIEWS, viewDef, viewForPath } from "../../_lib/sections";
import { SessionContext, type EndProblem, type SessionContextValue } from "./SessionContext";
import { NotSharedView } from "./Views";

/**
 * Everything around the record on /view/session/* (BRIEF.md 6.3):
 *
 * - Polls portal_status every 5 seconds while the session is live, and says
 *   so on screen when Trace cannot be reached.
 * - active: the record frame (rail built from the scope, the patient
 *   header with the facts and the draining bar, the view, the resizable
 *   notes). The frame loads the overview once for the header; each view
 *   loads its own section. A view the patient did not grant is never
 *   mounted: "Not shared" shows in its place and nothing is requested.
 * - When the countdown reaches zero the record leaves the screen and memory
 *   at once and the status is checked straight away (the database decides
 *   what comes next, normally paused). The notes stay on screen throughout.
 * - paused: the record is gone; the notes can still be saved.
 * - ended: "Access ended", why, when it started and how long it ran, the
 *   doctor's notes to copy or print, one way on.
 * - anything else: back to /view.
 *
 * One session per frame: SessionScope (below) starts a fresh frame each
 * time the doctor comes back to /view/session from elsewhere, and whenever
 * the status names a different session, so nothing of one session (notes,
 * the record, the scope, the clock) can show in the next.
 *
 * Nothing about the patient is written to browser storage. The polite live
 * region announces the start, 5 and 1 minutes left, pause and end.
 */

const EMPTY_NOTES: SessionNotes = { chiefComplaint: "", assessment: "", plan: "", followUp: "" };
const AUTOSAVE_MS = 1200;
/** Failed polls in a row before the screen says the connection is lost (10 seconds). */
const LOST_AFTER = 2;

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

function saveErrorText(code: string | null): string {
  if (code === "notes_too_long") return "Each notes field holds up to 5,000 characters. Shorten the longest one and save again.";
  if (code === "notes_not_allowed") return "The patient did not allow notes for this session.";
  if (code === "session_not_active") return "Access has closed, so these notes could not be saved.";
  return "Notes could not be saved. Check your connection and try Save notes again.";
}

/**
 * Starts a fresh SessionFrame each time the doctor comes back to
 * /view/session from another page (Next keeps this layout alive, hidden,
 * with its state; see node_modules/next/dist/docs/01-app/02-guides/
 * preserving-ui-state.md), and when the frame meets a different session.
 * The key change drops the old frame and everything under it: the notes,
 * the overview, the views and the sections they loaded.
 */
export function SessionScope({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  // Runs when Next hides the layout (the doctor left /view/session/*).
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  const restart = useCallback(() => setVisit((v) => v + 1), []);
  return (
    <SessionFrame key={visit} onNewSession={restart}>
      {children}
    </SessionFrame>
  );
}

export function SessionFrame({ children, onNewSession }: { children: ReactNode; onNewSession: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const demo = useDemo();
  const inDemoFrame = useInDemoFrame();
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [offset, setOffset] = useState(0);
  const [overview, setOverview] = useState<PortalRecord<"overview"> | null>(null);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [notes, setNotesState] = useState<SessionNotes>(EMPTY_NOTES);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [manualSave, setManualSave] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endProblem, setEndProblem] = useState<EndProblem>(null);
  const [announcement, setAnnouncement] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [failedPolls, setFailedPolls] = useState(0);
  // Notes typed but not saved when the session ended: kept on screen so the doctor can copy them.
  const [unsaved, setUnsaved] = useState<SessionNotes | null>(null);
  // The notes as they stood when the session ended, for Copy and Print.
  const [finalNotes, setFinalNotes] = useState<SessionNotes | null>(null);
  // allow_notes is only returned while the session is live; the ended screen still needs it.
  const [notesAllowed, setNotesAllowed] = useState<boolean | null>(null);

  const notesLoaded = useRef(false);
  const lastSaved = useRef(JSON.stringify(EMPTY_NOTES));
  const notesRef = useRef(notes);
  const autosave = useRef<number | undefined>(undefined);
  const prevStatus = useRef<string | null>(null);
  const allowNotes = useRef(false);
  const sessionMark = useRef<string | null>(null);
  const retired = useRef(false);
  const [focusMemory] = useState(createFocusMemory);
  // The view the doctor was on before the End session step, for its "Back to the record".
  const [returnTo, setReturnTo] = useState("/view/session");

  if (!pathname.startsWith("/view/session/end") && pathname !== returnTo) setReturnTo(pathname);

  const applyStatus = useCallback(
    (s: PortalStatus) => {
      if (retired.current) return;
      // A different session than the one this frame opened with: start afresh.
      if (s.approved_at && sessionMark.current && s.approved_at !== sessionMark.current) {
        retired.current = true;
        window.clearTimeout(autosave.current);
        onNewSession();
        return;
      }
      if (s.approved_at) sessionMark.current = s.approved_at;

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
      if (s.status === "ended" && prev !== "ended" && notesLoaded.current) {
        window.clearTimeout(autosave.current);
        setFinalNotes(notesRef.current);
        if (JSON.stringify(notesRef.current) !== lastSaved.current) setUnsaved(notesRef.current);
      }
      // The record leaves memory the moment access is not active.
      if (s.status !== "active") setOverview(null);
      if (!["active", "paused", "ended"].includes(s.status)) router.replace(portalHome(demo));
    },
    [router, onNewSession, demo],
  );

  const refreshStatus = useCallback(async () => {
    try {
      applyStatus(await portalApi.status());
      setLoadError(false);
      setFailedPolls(0);
    } catch {
      setLoadError(true);
      setFailedPolls((n) => n + 1);
    }
  }, [applyStatus]);

  // The first status call (shared if React mounts this twice; see firstStatus).
  useEffect(() => {
    let cancelled = false;
    firstStatus()
      .then((s) => {
        if (!cancelled) applyStatus(s);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
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
    if (!active || overview || overviewFailed) return;
    let cancelled = false;
    portalApi
      .record("overview")
      .then((r) => {
        if (cancelled) return;
        if (r) setOverview(r);
        else void refreshStatus();
      })
      .catch(() => {
        if (cancelled) return;
        setOverviewFailed(true);
        void refreshStatus();
      });
    return () => {
      cancelled = true;
    };
  }, [active, overview, overviewFailed, refreshStatus]);

  // ---- Notes -------------------------------------------------------------
  const saveNotes = useCallback(
    async (manual = false): Promise<boolean> => {
      window.clearTimeout(autosave.current);
      const current = notesRef.current;
      const json = JSON.stringify(current);
      setManualSave(manual);
      setSaveState("saving");
      try {
        await portalApi.saveNotes(toApi(current));
        lastSaved.current = json;
        setSaveState("saved");
        setSaveError(null);
        setSavedAt(formatClock(new Date(Date.now() + offset).toISOString()));
        if (manual) setAnnouncement("Notes saved");
        // A save that was still on its way when the session ended did reach it.
        if (JSON.stringify(notesRef.current) === json) setUnsaved(null);
        return true;
      } catch (e) {
        const code = e instanceof PortalApiError ? e.code : null;
        setSaveState("error");
        setSaveError(saveErrorText(code));
        if (code === "session_not_active") void refreshStatus();
        return false;
      } finally {
        setManualSave(false);
      }
    },
    [refreshStatus, offset],
  );

  const setNotes = useCallback(
    (n: SessionNotes) => {
      notesRef.current = n;
      setNotesState(n);
      window.clearTimeout(autosave.current);
      autosave.current = window.setTimeout(() => {
        if (JSON.stringify(notesRef.current) !== lastSaved.current) void saveNotes(false);
      }, AUTOSAVE_MS);
    },
    [saveNotes],
  );

  // Leaving /view/session (Next hides it) or starting afresh: stop the
  // autosave, and send the last keystrokes to this session if they are not
  // saved yet. Never once the frame has met another session.
  useLayoutEffect(
    () => () => {
      window.clearTimeout(autosave.current);
      if (retired.current || !allowNotes.current || !notesLoaded.current) return;
      if (JSON.stringify(notesRef.current) === lastSaved.current) return;
      portalApi.saveNotes(toApi(notesRef.current)).catch(() => {
        // Nothing more can be done from a page that is gone.
      });
    },
    [],
  );

  // Next's route announcer reads the page's h1 when the document has no
  // title at that moment (between a navigation and its metadata), and keeps
  // what it read. Here the h1 is the patient's name, which must not outlive
  // the session, so the document always has a title. Runs before the
  // announcer's own effect (children's effects run first).
  useLayoutEffect(() => {
    if (!document.title) document.title = "Clinical Access Portal";
  });

  const endSession = useCallback(
    async (options?: { withoutLatestNotes?: boolean }) => {
      setEnding(true);
      setEndProblem(null);
      try {
        if (allowNotes.current && JSON.stringify(notesRef.current) !== lastSaved.current) {
          const saved = await saveNotes(false);
          // Ending would leave the latest notes out of the record: ask first.
          if (!saved && !options?.withoutLatestNotes) {
            setEndProblem("notes");
            return;
          }
        }
        applyStatus(await portalApi.end());
      } catch {
        // Said on screen, as an alert, where the doctor pressed End session.
        setEndProblem("failed");
        void refreshStatus();
      } finally {
        setEnding(false);
      }
    },
    [applyStatus, refreshStatus, saveNotes],
  );

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
  const connectionLost =
    failedPolls >= LOST_AFTER ? (
      <Notice tone="urgent" live="polite" className="mb-5">
        Trace can&apos;t be reached. Check your connection; the portal keeps trying.
      </Notice>
    ) : null;
  const footer = <PortalFooter demo={Boolean(demo)} />;

  // ---- Loading --------------------------------------------------------------
  if (!status || !["active", "paused", "ended"].includes(status.status)) {
    return (
      <PortalShell tone="ground" header={<PortalHeader clinician={clinician} />} footer={footer}>
        {liveRegion}
        <PortalSplit>
          <h1 className="font-display text-display font-light">
            {loadError ? "The portal could not reach Trace." : "Loading the record"}
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
    endProblem,
    returnTo,
  };

  // ---- Ended -------------------------------------------------------------------
  if (status.status === "ended") {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell tone="ground" header={<PortalHeader clinician={clinician} />} footer={footer}>
          {liveRegion}
          <EndedScreen
            status={status}
            unsaved={unsaved}
            finalNotes={finalNotes}
            notesAllowed={notesAllowed}
            newCodeHref={portalHome(demo)}
          />
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  const notesAttention = saveState === "error" ? "Not saved" : undefined;
  const notesPanel = (collapse?: { onCollapse: () => void; collapseRef: React.Ref<HTMLButtonElement> }) => (
    <SessionNotesPanel
      notes={notes}
      onChange={setNotes}
      onSave={() => void saveNotes(true)}
      saveState={saveState}
      savedAt={savedAt}
      errorText={saveError ?? undefined}
      manualSave={manualSave}
      patientFirstName={firstName}
      allowed={Boolean(status.allow_notes)}
      onCollapse={collapse?.onCollapse}
      collapseRef={collapse?.collapseRef}
      focusMemory={focusMemory}
    />
  );

  // ---- Paused, or the countdown just ran out (the same frame, so the notes stay put) ----
  if (status.status === "paused" || timeUp) {
    return (
      <SessionContext.Provider value={ctx}>
        <PortalShell
          tone="ground"
          header={<PortalHeader clinician={clinician} />}
          footer={footer}
          notes={
            status.allow_notes ? (
              <aside id="session-notes" aria-label="Session notes">
                {notesPanel()}
              </aside>
            ) : undefined
          }
        >
          {liveRegion}
          <PortalSplit>
            {connectionLost}
            {status.status === "paused" ? (
              <PausedScreen
                status={status}
                offset={offset}
                onEnd={(o) => void endSession(o)}
                ending={ending}
                problem={endProblem}
              />
            ) : (
              <h1 className="font-display text-display font-light">Checking access</h1>
            )}
          </PortalSplit>
        </PortalShell>
      </SessionContext.Provider>
    );
  }

  // ---- Active: the record ------------------------------------------------------
  const viewKey = viewForPath(pathname);
  const view = viewKey ? viewDef(viewKey) : null;
  const granted = view ? isGranted(view, status.scope) : true;
  const allergies = overview?.critical.allergies ?? [];
  const summary = overview ? (
    <p className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-0.5 text-caption">
      {allergies.length > 0 && (
        <span className="flex items-center gap-1.5 font-semibold">
          <Icon name="warning" size={16} />
          <span className="sr-only">{allergies.length > 1 ? "Allergies: " : "Allergy: "}</span>
          {allergies.join(", ")}
          <span aria-hidden="true">{allergies.length > 1 ? " allergies" : " allergy"}</span>
        </span>
      )}
      {msLeft !== null && <span className="tabular-nums">{formatCountdown(Math.max(0, msLeft))} left</span>}
    </p>
  ) : null;
  const rail = (
    <PortalSidebar
      views={VIEWS.map((v) => ({ key: v.key, label: v.label, href: v.href, icon: v.icon, shared: isGranted(v, status.scope) }))}
      active={viewKey}
      clinician={clinician ? { name: clinician.name, practice: clinician.practice } : undefined}
      summary={summary}
    />
  );

  return (
    <SessionContext.Provider value={ctx}>
      <RecordFrame
        rail={rail}
        header={
          <>
            {connectionLost}
            <RecordHeader
              status={status}
              overview={overview}
              msLeft={msLeft}
              failed={overviewFailed}
              onRetry={() => setOverviewFailed(false)}
            />
          </>
        }
        notes={
          status.allow_notes ? (
            <ResizableNotes id="session-notes" attention={notesAttention} startCollapsed={inDemoFrame} remember={!inDemoFrame}>
              {(collapse) => notesPanel(collapse)}
            </ResizableNotes>
          ) : undefined
        }
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
  failed,
  onRetry,
}: {
  status: PortalStatus;
  overview: PortalRecord<"overview"> | null;
  msLeft: number | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const end = (
    <ButtonLink href="/view/session/end" variant="secondary" size="sm">
      End session
    </ButtonLink>
  );
  if (!overview) {
    if (failed) {
      return (
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div role="alert" className="flex flex-wrap items-center gap-x-4">
            <p className="text-body-lg">The record could not be loaded.</p>
            <Button variant="text" onClick={onRetry}>
              Try again
            </Button>
          </div>
          {end}
        </div>
      );
    }
    // Quiet while it loads: the view below says "Loading…" once, for both.
    return <div aria-hidden="true" className="min-h-14" />;
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
      label: sharedForLabel(status.duration_kind, status.approved_at, status.expires_at),
      value: msLeft !== null ? `${formatCountdown(Math.max(0, msLeft))} left` : status.duration_kind === "manual" ? "No timer" : "",
    },
    // Without the notes column, the one thing to know about notes sits here.
    ...(status.allow_notes ? [] : [{ label: "Session notes", value: "Not allowed" }]),
  ];
  const total =
    status.approved_at && status.expires_at ? Date.parse(status.expires_at) - Date.parse(status.approved_at) : null;
  const warning =
    msLeft === null || msLeft > 5 * 60_000
      ? null
      : msLeft > 60_000
        ? "Less than 5 minutes left. The record hides when the time runs out, unless the patient adds more."
        : "Less than a minute left. The record hides when the time runs out.";
  return (
    <PatientSummaryCard
      name={name}
      initials={initials(name)}
      details={patientLine(overview.patient)}
      facts={facts}
      action={
        <>
          {status.allow_notes && (
            <a
              href="#session-notes"
              className="flex min-h-11 items-center px-2 text-caption font-semibold text-accent hovered:underline lg:hidden"
            >
              Go to notes
            </a>
          )}
          {end}
        </>
      }
    >
      {msLeft !== null && total !== null && total > 0 && (
        <Countdown layout="inline" msLeft={msLeft} msTotal={total} label="Time left" />
      )}
      {/* Visible only: the frame's live region already announces 5 and 1 minutes. */}
      {warning && <Notice tone="urgent">{warning}</Notice>}
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
  // Focus moves to the new state, unless the doctor is typing notes (the live region says what changed).
  useEffect(() => {
    if (!(document.activeElement instanceof HTMLTextAreaElement)) heading.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption font-medium text-ink-2">{label}</p>
      <h1 ref={heading} tabIndex={-1} className="font-display text-display font-light">
        {title}
      </h1>
    </div>
  );
}

/** What went wrong with "End session", under the button that tried. */
export function EndProblemNotice({
  problem,
  onEndAnyway,
  ending,
}: {
  problem: EndProblem;
  onEndAnyway: () => void;
  ending: boolean;
}) {
  if (!problem) return null;
  if (problem === "failed") {
    return (
      <Notice tone="critical" live="assertive">
        The session could not be ended. Check your connection and try again.
      </Notice>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Notice tone="critical" live="assertive">
        Your latest notes could not be saved, so the session is still open. Try again, or end it without them.
      </Notice>
      <Button variant="destructive" onClick={onEndAnyway} disabled={ending}>
        End without the latest notes
      </Button>
    </div>
  );
}

function PausedScreen({
  status,
  offset,
  onEnd,
  ending,
  problem,
}: {
  status: PortalStatus;
  offset: number;
  onEnd: (options?: { withoutLatestNotes?: boolean }) => void;
  ending: boolean;
  problem: EndProblem;
}) {
  const now = useNow(offset, 1000);
  const closesAt = status.closes_at;
  const left = closesAt ? Date.parse(closesAt) - now : null;
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <StateTitle label="Access paused" title="Time's up on this share." />
        <p className="text-body-lg text-ink-2">
          The patient&apos;s timer ran out, so their record is hidden. It comes back here if they add more time.
        </p>
        {left !== null && left > 0 && (
          <p className="text-caption text-ink-2">If nothing changes, the session closes at {formatClock(closesAt)}.</p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Button variant="secondary" size="lg" className="w-full sm:w-55" onClick={() => onEnd()} loading={ending}>
          End session now
        </Button>
        <EndProblemNotice problem={problem} ending={ending} onEndAnyway={() => onEnd({ withoutLatestNotes: true })} />
      </div>
    </div>
  );
}

/** Copy and Print for the doctor's own notes once the session is over. */
function NotesActions({ text }: { text: string }) {
  const [said, setSaid] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-x-6 print:hidden">
      <Button
        variant="text"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setSaid("Notes copied");
          } catch {
            setSaid("The notes could not be copied. Select the text and copy it instead.");
          }
        }}
      >
        Copy notes
      </Button>
      <Button variant="text" onClick={() => window.print()}>
        Print notes
      </Button>
      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}

function EndedScreen({
  status,
  unsaved,
  finalNotes,
  notesAllowed,
  newCodeHref,
}: {
  status: PortalStatus;
  unsaved: SessionNotes | null;
  finalNotes: SessionNotes | null;
  notesAllowed: boolean | null;
  newCodeHref: string;
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
  const unsavedText = unsaved ? notesText(unsaved) : "";
  const savedText = !unsaved && finalNotes ? notesText(finalNotes) : "";
  const started = status.approved_at;
  const endedAt = status.ended_at;
  return (
    <PortalSplit>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <StateTitle label="Access ended" title={title} />
          <p className="text-body-lg text-ink-2">{body}</p>
          {notesLine && <p className="text-body-lg text-ink-2">{notesLine}</p>}
        </div>
        {started && endedAt && (
          <dl className="flex flex-wrap gap-x-16 gap-y-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-meta leading-4 text-ink-2">Started</dt>
              <dd className="text-row-lg font-semibold">{formatClock(started)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-meta leading-4 text-ink-2">Duration</dt>
              <dd className="text-row-lg font-semibold">{formatDuration(Date.parse(endedAt) - Date.parse(started))}</dd>
            </div>
          </dl>
        )}
        {unsavedText && (
          <div className="flex flex-col gap-3">
            <Notice tone="urgent" live="assertive">
              Your last changes to the notes were not saved before the session ended, so they are not in the record.
              Copy them now if you need them: they are gone when you leave this page.
            </Notice>
            <TextArea
              label="Notes not saved"
              density="compact"
              rows={6}
              readOnly
              value={unsavedText}
              textareaClassName="field-sizing-content"
            />
            <NotesActions text={unsavedText} />
          </div>
        )}
        {savedText && (
          <section aria-labelledby="ended-notes" className="flex flex-col gap-2">
            <h2 id="ended-notes" className="font-display text-year font-light">
              Your notes
            </h2>
            <p className="whitespace-pre-wrap text-body">{savedText}</p>
            <NotesActions text={savedText} />
          </section>
        )}
        <ButtonLink href={newCodeHref} size="lg" className="w-full sm:w-55 print:hidden">
          Enter a new code
        </ButtonLink>
      </div>
    </PortalSplit>
  );
}
