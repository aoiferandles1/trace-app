"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { clockOffset, portalApi, PortalApiError, type PortalStatus } from "../_lib/api";
import { formatClock } from "../_lib/format";
import {
  DEMO_CLINICIAN,
  readClinician,
  saveClinician,
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

export function ViewFlow() {
  const router = useRouter();
  const stored = useStoredClinician();
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [offset, setOffset] = useState(0);
  const [digits, setDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"heading" | "code" | "none">("none");

  const clinician = stored ?? undefined;

  const go = useCallback((next: Screen, focus: "heading" | "code" | "none" = "heading") => {
    focusTarget.current = focus;
    setProblem(null);
    setScreen(next);
  }, []);

  // Move focus to what changed: the new step's heading, or the code field
  // (which carries any error through aria-describedby).
  useEffect(() => {
    if (focusTarget.current === "heading") headingRef.current?.focus();
    if (focusTarget.current === "code") document.getElementById(CODE_ID)?.focus();
    focusTarget.current = "none";
  }, [screen]);

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
          // No session yet: the name step, or straight to the code if this
          // browser remembers the doctor (and this is not the demo), with focus
          // in the boxes as on the board: the page has one job.
          else if (readClinician() && !new URLSearchParams(window.location.search).has("demo")) go({ kind: "code" }, "code");
          else go({ kind: "name" }, "none");
      }
    },
    [go, router],
  );

  // First load: the status call also sets the portal cookie. Exactly one
  // call: a second one without the cookie would mint a second token, and
  // whichever answer lands last would replace the cookie, so a code typed
  // meanwhile would belong to a token this browser no longer holds. (React
  // runs effects twice in development; the ref keeps the one request.)
  const firstStatus = useRef<Promise<PortalStatus> | null>(null);
  useEffect(() => {
    let cancelled = false;
    firstStatus.current ??= portalApi.status();
    firstStatus.current
      .then((s) => {
        if (cancelled) return;
        setDemo(new URLSearchParams(window.location.search).has("demo"));
        applyStatus(s, true);
      })
      .catch(() => {
        if (!cancelled) setProblem("The portal could not reach Trace. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  // Waiting: poll every 2 seconds.
  usePolling(
    async () => applyStatus(await portalApi.status(), false),
    2000,
    screen.kind === "waiting",
  );

  async function submitCode(code: string) {
    if (!clinician) {
      go({ kind: "name" });
      return;
    }
    if (code.length !== 4) {
      setProblem("Enter all 4 digits of the code.");
      document.getElementById(CODE_ID)?.focus();
      return;
    }
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
      setSubmitting(false);
    }
  }

  async function cancelRequest() {
    setSubmitting(true);
    try {
      await portalApi.cancel();
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

  if (screen.kind === "loading") {
    return (
      <PortalShell tone="ground" header={header} footer={<PortalFooter demo={demo} />}>
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
          <PortalFooter tone="session" demo={demo}>
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
          />
        </PortalSplit>
      </PortalShell>
    );
  }

  const whatNext = <WhatHappensNext />;

  return (
    <PortalShell tone="ground" header={header} footer={<PortalFooter demo={demo} />}>
      {screen.kind === "name" && (
        <PortalSplit aside={whatNext}>
          <NameStep
            headingRef={headingRef}
            initial={demo ? DEMO_CLINICIAN : (stored ?? null)}
            onDone={(c) => {
              saveClinician(c);
              go({ kind: "code" }, "code");
            }}
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
            onUnlock={() => go({ kind: "code" }, "none")}
            clinician={clinician}
            onChangeDetails={() => go({ kind: "name" })}
          />
        </PortalSplit>
      )}

      {screen.kind === "denied" && (
        <PortalSplit>
          <Outcome
            headingRef={headingRef}
            label="Request declined"
            title="Your patient chose not to share their record."
            body="You can ask them to share again, or continue the consultation without it."
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
  headingRef,
}: {
  initial: Clinician | null;
  onDone: (c: Clinician) => void;
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
            document.getElementById("clinician-name")?.focus();
            return;
          }
          onDone({ name: n.slice(0, 100), role: role.trim().slice(0, 60), practice: practice.trim().slice(0, 120) });
        }}
      >
        <TextField
          id="clinician-name"
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
          <p className="text-caption text-ink-2">Remembered on this computer for next time.</p>
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
  headingRef,
}: {
  requestExpiresAt: string | null;
  offset: number;
  onCancel: () => void;
  cancelling: boolean;
  problem: string | null;
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
  onTryAgain,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  label: string;
  title: string;
  body: string;
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
        Try again
      </Button>
    </div>
  );
}
