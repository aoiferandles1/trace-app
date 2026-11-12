"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSplit, StepRow, StepRows } from "@/components/portal/PortalSplit";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { StateMessage } from "@/components/ui/StateMessage";
import { ThemeColor } from "@/components/ui/ThemeColor";
import { formatCountdown, formatCountdownSpoken } from "@/lib/format";
import { clockOffset, firstStatus, portalApi, PortalApiError, type PortalStatus } from "../_lib/api";
import { formatClock } from "../_lib/format";
import {
  DEMO_CLINICIAN,
  readClinician,
  readDemo,
  saveClinician,
  useDemo,
  useNow,
  usePolling,
  useStoredClinician,
  type Clinician,
} from "../_lib/hooks";

/**
 * /view: everything before the record opens (BRIEF.md 6.1 and 6.2, boards
 * PortalEntryB and PortalWaitB).
 *
 *   loading -> name (who is asking) -> code
 *     wrong / expired / locked: the code step with the error under the boxes
 *   -> waiting (session indigo, polls every 2 s)
 *     -> denied / timed out / withdrawn: one line and "Try again"
 *     -> approved: straight to /view/session
 *
 * The browser only talks to /api/portal/*. Nothing about the patient is
 * known here; the record opens on /view/session.
 *
 * Browser Back steps back through the flow: from the code to the name
 * step (when the doctor came that way), and from waiting to the code (which
 * withdraws the request, as "Cancel request" does). The demo (?demo=1)
 * starts at the code step as Dr Hennessy and never touches the details a
 * real doctor saved in this browser.
 */

type CodeError =
  | { kind: "wrong"; attemptsLeft: number }
  | { kind: "expired" }
  | { kind: "locked"; until: string };

type Screen =
  | { kind: "loading" }
  | { kind: "name" }
  | { kind: "code"; error?: CodeError }
  | { kind: "waiting"; requestExpiresAt: string | null }
  | { kind: "denied" }
  | { kind: "timedout" }
  | { kind: "withdrawn" };

const CODE_ID = "portal-code";
const NAME_ID = "clinician-name";

type Focus = "heading" | "code" | "name" | "none";

/**
 * Starts the flow afresh each time the doctor comes back to /view (Next
 * keeps the page alive, hidden, with whatever step it was on).
 */
export function ViewFlow() {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => () => setVisit((v) => v + 1), []);
  return <Flow key={visit} />;
}

function Flow() {
  const router = useRouter();
  const stored = useStoredClinician();
  const demo = useDemo();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [offset, setOffset] = useState(0);
  const [digits, setDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [failedPolls, setFailedPolls] = useState(0);
  // The demo's doctor lives here only, so trying the demo never replaces a real doctor's saved details.
  const [demoClinician, setDemoClinician] = useState<Clinician>(DEMO_CLINICIAN);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<Focus>("none");
  const inFlight = useRef(false);
  const ignorePop = useRef(false);

  const clinician = demo ? demoClinician : (stored ?? undefined);

  const go = useCallback((next: Screen, focus: Focus = "heading") => {
    focusTarget.current = focus;
    setProblem(null);
    setScreen(next);
  }, []);

  // Move focus to what changed: the new step's heading, or its field (the
  // code field carries any error through aria-describedby).
  useEffect(() => {
    if (focusTarget.current === "heading") headingRef.current?.focus();
    if (focusTarget.current === "code") document.getElementById(CODE_ID)?.focus();
    if (focusTarget.current === "name") document.getElementById(NAME_ID)?.focus();
    focusTarget.current = "none";
  }, [screen]);

  /** A step the browser's Back button should undo. */
  const pushStep = useCallback((step: "code" | "waiting") => {
    window.history.pushState({ traceStep: step }, "");
  }, []);

  /** Routes a portal_status to the right screen. */
  const applyStatus = useCallback(
    (s: PortalStatus, initial: boolean) => {
      const off = clockOffset(s.server_time);
      setOffset(off);
      if (s.locked_until && Date.parse(s.locked_until) > Date.now() + off) {
        if (initial) go({ kind: "code", error: { kind: "locked", until: s.locked_until } }, "heading");
        return;
      }
      switch (s.status) {
        case "requested":
          if (initial) go({ kind: "waiting", requestExpiresAt: s.request_expires_at });
          else setScreen((cur) => (cur.kind === "waiting" ? { ...cur, requestExpiresAt: s.request_expires_at } : cur));
          return;
        case "active":
        case "paused":
          router.replace("/view/session");
          return;
        case "denied":
          go({ kind: "denied" });
          return;
        case "expired":
          go({ kind: "timedout" });
          return;
        case "cancelled":
          go({ kind: "withdrawn" });
          return;
        case "ended":
        case "none":
        default:
          if (!initial) go({ kind: "code" }, "code");
          // No session yet: straight to the code if this browser remembers
          // the doctor, or in the demo (as Dr Hennessy), with focus in the
          // boxes as on the board: the page has one job. Otherwise the name step.
          else if (readDemo() || readClinician()) go({ kind: "code" }, "code");
          else go({ kind: "name" }, "name");
      }
    },
    [go, router],
  );

  // First load: the status call also sets the portal cookie. Exactly one
  // call: a second one without the cookie would mint a second token, and
  // whichever answer lands last would replace the cookie, so a code typed
  // meanwhile would belong to a token this browser no longer holds. (React
  // runs effects twice in development; firstStatus() shares the request.)
  useEffect(() => {
    let cancelled = false;
    firstStatus()
      .then((s) => {
        if (cancelled) return;
        applyStatus(s, true);
      })
      .catch(() => {
        if (!cancelled) setProblem("The portal could not reach Trace. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  // Waiting: poll every 2 seconds, and say so when Trace cannot be reached.
  usePolling(
    async () => {
      try {
        applyStatus(await portalApi.status(), false);
        setFailedPolls(0);
      } catch {
        setFailedPolls((n) => n + 1);
      }
    },
    2000,
    screen.kind === "waiting",
  );

  // Browser Back: waiting goes back to the code (withdrawing the request),
  // the code goes back to the name step when the doctor came from there.
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  });
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      const step = (e.state as { traceStep?: string } | null)?.traceStep;
      const current = screenRef.current.kind;
      if (current === "waiting" && step !== "waiting") {
        void portalApi.cancel().catch(() => undefined);
        go({ kind: "code" }, "code");
      } else if (current === "code" && step !== "code" && step !== "waiting") {
        go({ kind: "name" }, "name");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  async function submitCode(code: string) {
    if (inFlight.current) return;
    if (!clinician) {
      go({ kind: "name" }, "name");
      return;
    }
    if (code.length !== 4) {
      setProblem("Enter all 4 digits of the code.");
      document.getElementById(CODE_ID)?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const r = await portalApi.submitCode({
        code,
        clinician_name: clinician.name,
        clinician_role: clinician.role,
        clinician_practice: clinician.practice,
      });
      setDigits("");
      if (r.result === "requested") {
        setFailedPolls(0);
        pushStep("waiting");
        go({ kind: "waiting", requestExpiresAt: r.request_expires_at });
      } else if (r.result === "locked" || (r.attempts_left === 0 && r.locked_until)) {
        const until = r.locked_until ?? new Date(Date.now() + offset + 15 * 60_000).toISOString();
        go({ kind: "code", error: { kind: "locked", until } }, "heading");
      } else if (r.result === "expired") {
        go({ kind: "code", error: { kind: "expired" } }, "code");
      } else {
        go({ kind: "code", error: { kind: "wrong", attemptsLeft: r.attempts_left ?? 0 } }, "code");
      }
    } catch (e) {
      if (e instanceof PortalApiError && e.code === "portal_busy") {
        // This browser already has a live request or session.
        applyStatus(await portalApi.status(), true);
        return;
      }
      setProblem("The code could not be checked. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function cancelRequest() {
    setSubmitting(true);
    try {
      await portalApi.cancel();
      // Leave the waiting step's history entry behind, so Back does not cancel twice.
      if ((window.history.state as { traceStep?: string } | null)?.traceStep === "waiting") {
        ignorePop.current = true;
        window.history.back();
      }
      go({ kind: "code" }, "code");
    } catch {
      setProblem("The request could not be cancelled. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const waiting = screen.kind === "waiting";
  const tone = waiting ? "session" : "default";
  const header = <PortalHeader clinician={clinician} tone={tone} />;
  const isDemo = Boolean(demo);

  if (screen.kind === "loading") {
    return (
      <PortalShell tone="ground" header={header} footer={<PortalFooter demo={isDemo} />}>
        <PortalSplit>
          <h1 className="sr-only">Clinical Access Portal</h1>
          {problem ? (
            <StateMessage
              tone="error"
              message={problem}
              action={{ label: "Try again", onClick: () => window.location.reload() }}
            />
          ) : (
            <p role="status" className="text-body-lg text-ink-2">
              Loading the portal&hellip;
            </p>
          )}
        </PortalSplit>
      </PortalShell>
    );
  }

  if (waiting) {
    return (
      <PortalShell
        tone="session"
        header={header}
        footer={
          <PortalFooter tone="session" demo={isDemo}>
            <p className="text-caption">The patient keeps their code and can still share later.</p>
          </PortalFooter>
        }
      >
        <ThemeColor tone="session" />
        <PortalSplit
          aside={
            <StepRows tone="session" label="Progress">
              <StepRow tone="session" marker={<StepDone />}>
                Code accepted
              </StepRow>
              <StepRow tone="session" current marker={<StepRing />}>
                Waiting for approval
              </StepRow>
              <StepRow tone="session" muted marker={<StepRing muted />}>
                Open record
              </StepRow>
            </StepRows>
          }
        >
          <WaitingStep
            headingRef={headingRef}
            requestExpiresAt={screen.requestExpiresAt}
            offset={offset}
            onCancel={cancelRequest}
            cancelling={submitting}
            problem={problem}
            connectionLost={failedPolls >= 2}
          />
        </PortalSplit>
      </PortalShell>
    );
  }

  const whatNext = <WhatHappensNext />;

  return (
    <PortalShell tone="ground" header={header} footer={<PortalFooter demo={isDemo} />}>
      {screen.kind === "name" && (
        <PortalSplit aside={whatNext}>
          <NameStep
            headingRef={headingRef}
            initial={clinician ?? null}
            onDone={(c) => {
              if (demo) setDemoClinician(c);
              else saveClinician(c);
              pushStep("code");
              go({ kind: "code" }, "code");
            }}
            onCancel={clinician ? () => go({ kind: "code" }, "code") : undefined}
          />
        </PortalSplit>
      )}

      {screen.kind === "code" && (
        <PortalSplit aside={whatNext}>
          <CodeStep
            headingRef={headingRef}
            digits={digits}
            onDigits={(v) => {
              setProblem(null);
              setDigits(v);
              // Typing again clears a wrong or expired code's message; a lock stays.
              if (screen.error && screen.error.kind !== "locked") setScreen({ kind: "code" });
            }}
            error={screen.error}
            problem={problem}
            offset={offset}
            submitting={submitting}
            onSubmit={() => void submitCode(digits)}
            onComplete={(v) => void submitCode(v)}
            onUnlock={() => go({ kind: "code" }, "none")}
            clinician={clinician}
            onChangeDetails={() => go({ kind: "name" }, "name")}
          />
        </PortalSplit>
      )}

      {screen.kind === "denied" && (
        <PortalSplit>
          <Outcome
            headingRef={headingRef}
            label="Request declined"
            title="Your patient chose not to share their record."
            body="That code is used up. Ask them for a new one to try again, or continue the consultation without it."
            action="Try with a new code"
            onTryAgain={() => go({ kind: "code" }, "code")}
          />
        </PortalSplit>
      )}

      {screen.kind === "timedout" && (
        <PortalSplit>
          <Outcome
            headingRef={headingRef}
            label="No answer"
            title="Your patient didn't answer in time."
            body="Requests close after 5 minutes. Ask your patient for a new code."
            onTryAgain={() => go({ kind: "code" }, "code")}
          />
        </PortalSplit>
      )}

      {screen.kind === "withdrawn" && (
        <PortalSplit>
          <Outcome
            headingRef={headingRef}
            label="Code withdrawn"
            title="Your patient withdrew the code."
            body="They cancelled the share before answering. Ask them for a new code if you still need their record."
            onTryAgain={() => go({ kind: "code" }, "code")}
          />
        </PortalSplit>
      )}
    </PortalShell>
  );
}

/* ---------------------------------------------------------------- pieces */

function Title({ headingRef, children }: { headingRef: React.Ref<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <h1 ref={headingRef} tabIndex={-1} className="font-display text-display font-light">
      {children}
    </h1>
  );
}

/** PortalEntryB's right column. */
function WhatHappensNext() {
  const steps = ["The patient generates a code", "You enter it here", "They approve, you read what they chose to share"];
  return (
    <section aria-labelledby="what-next">
      <h2 id="what-next" className="mb-2 text-caption font-semibold text-ink-2">
        What happens next
      </h2>
      <StepRows>
        {steps.map((s, i) => (
          <StepRow
            key={s}
            marker={
              <span aria-hidden="true" className="w-7 shrink-0 font-display text-numeral-lg font-light text-accent">
                {i + 1}
              </span>
            }
          >
            {s}
          </StepRow>
        ))}
      </StepRows>
    </section>
  );
}

function StepDone() {
  return (
    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-session">
      <Icon name="tick" size={14} strokeWidth={3.5} />
    </span>
  );
}

function StepRing({ muted = false }: { muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={muted ? "size-6 shrink-0 rounded-full border-2 border-on-session-ring" : "size-6 shrink-0 rounded-full border-2 border-white"}
    />
  );
}

function ChangeDetails({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hit-area font-semibold text-accent hovered:underline">
      Change details
    </button>
  );
}

function NameStep({
  initial,
  onDone,
  onCancel,
  headingRef,
}: {
  initial: Clinician | null;
  onDone: (c: Clinician) => void;
  /** Back to the code step with the details unchanged ("Change details" came here). */
  onCancel?: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [practice, setPractice] = useState(initial?.practice ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <Title headingRef={headingRef}>Who is asking?</Title>
        <p className="text-body-lg text-ink-2">
          Your patient sees these details before they decide. Trace does not check them.
        </p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) {
            setError("Enter your name, as your patient knows you.");
            document.getElementById(NAME_ID)?.focus();
            return;
          }
          onDone({ name: n.slice(0, 100), role: role.trim().slice(0, 60), practice: practice.trim().slice(0, 120) });
        }}
      >
        <TextField
          id={NAME_ID}
          label="Your name"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
          required
        />
        <TextField
          label="Role"
          optional
          hint="For example GP or practice nurse"
          autoComplete="organization-title"
          maxLength={60}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <TextField
          label="Practice"
          optional
          autoComplete="organization"
          maxLength={120}
          value={practice}
          onChange={(e) => setPractice(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button type="submit" size="lg" className="w-full sm:w-55">
            Continue
          </Button>
          {onCancel ? (
            <Button variant="text" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <p className="text-caption text-ink-2">Remembered in this browser for next time.</p>
          )}
        </div>
      </form>
    </div>
  );
}

function codeErrorText(error: CodeError | undefined, lockedTime: string, unlocked: boolean): string | undefined {
  if (!error) return undefined;
  if (error.kind === "wrong")
    return `That code doesn't match. ${error.attemptsLeft} ${error.attemptsLeft === 1 ? "try" : "tries"} left before a 15 minute pause.`;
  if (error.kind === "expired") return "That code has expired. Codes last 5 minutes. Ask your patient for a new one.";
  return unlocked
    ? undefined
    : `Too many attempts. Code entry is paused on this browser until ${lockedTime}. Ask your patient for a new code.`;
}

function CodeStep({
  headingRef,
  digits,
  onDigits,
  error,
  problem,
  offset,
  submitting,
  onSubmit,
  onComplete,
  onUnlock,
  clinician,
  onChangeDetails,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  digits: string;
  onDigits: (v: string) => void;
  error?: CodeError;
  problem: string | null;
  offset: number;
  submitting: boolean;
  onSubmit: () => void;
  /** The fourth digit was typed: send it without waiting for Continue. */
  onComplete: (code: string) => void;
  onUnlock: () => void;
  clinician?: Clinician;
  onChangeDetails: () => void;
}) {
  const locked = error?.kind === "locked";
  const now = useNow(offset, 1000, locked);
  const unlocked = locked && Date.parse(error.until) <= now;
  useEffect(() => {
    if (unlocked) onUnlock();
  }, [unlocked, onUnlock]);
  const lockedTime = locked ? formatClock(error.until) : "";

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <Title headingRef={headingRef}>Enter the patient&apos;s code</Title>
        <p className="text-body-lg text-ink-2">Ask your patient to generate a share code in their Trace app.</p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-7"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <CodeInput
          id={CODE_ID}
          length={4}
          size="lg"
          label="Patient's share code"
          labelHidden
          value={digits}
          onChange={onDigits}
          onComplete={onComplete}
          disabled={locked && !unlocked}
          error={codeErrorText(error, lockedTime, unlocked) ?? problem ?? undefined}
        />
        <div className="flex flex-col gap-x-6 gap-y-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" className="w-full shrink-0 sm:w-55" loading={submitting} disabled={locked && !unlocked}>
            Continue
          </Button>
          {clinician && (
            <p className="text-caption text-ink-2">
              Requesting as {clinician.name}. <ChangeDetails onClick={onChangeDetails} />
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function WaitingStep({
  requestExpiresAt,
  offset,
  onCancel,
  cancelling,
  problem,
  connectionLost,
  headingRef,
}: {
  requestExpiresAt: string | null;
  offset: number;
  onCancel: () => void;
  cancelling: boolean;
  problem: string | null;
  /** Polls have failed for a few seconds: the countdown may be out of date. */
  connectionLost: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const now = useNow(offset, 1000);
  const left = requestExpiresAt ? Math.max(0, Date.parse(requestExpiresAt) - now) : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <p className="text-caption font-medium">Request sent</p>
        <Title headingRef={headingRef}>Waiting for the patient to approve</Title>
      </div>
      {left !== null && (
        <div className="flex flex-col gap-0.5">
          <p className="text-caption text-on-session-2">Patient has</p>
          <p aria-hidden="true" className="font-display text-display-xl font-light tabular-nums">
            {formatCountdown(left)}
          </p>
          <p className="sr-only">About {formatCountdownSpoken(Math.ceil(left / 60000) * 60000)} to respond</p>
        </div>
      )}
      {problem && (
        <Notice tone="critical" live="assertive" surface="session">
          {problem}
        </Notice>
      )}
      {connectionLost && !problem && (
        <Notice tone="urgent" live="polite" surface="session">
          Trace can&apos;t be reached. Check your connection; the portal keeps trying.
        </Notice>
      )}
      <Button variant="text" tone="session" className="self-start" onClick={onCancel} loading={cancelling}>
        Cancel request
      </Button>
    </div>
  );
}

function Outcome({
  headingRef,
  label,
  title,
  body,
  action = "Try again",
  onTryAgain,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  label: string;
  title: string;
  body: string;
  action?: string;
  onTryAgain: () => void;
}) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <p className="text-caption font-medium text-ink-2">{label}</p>
        <Title headingRef={headingRef}>{title}</Title>
        <p className="text-body-lg text-ink-2">{body}</p>
      </div>
      <Button size="lg" className="w-full sm:w-55" onClick={onTryAgain}>
        {action}
      </Button>
    </div>
  );
}
