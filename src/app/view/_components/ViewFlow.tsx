"use client";

import { Clock, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PortalShell } from "@/components/layout/PortalShell";
import { AccessCard, PortalHero, StepList } from "@/components/portal/AccessCard";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { Avatar } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { HintStrip } from "@/components/ui/HintStrip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TextField } from "@/components/ui/TextField";
import { formatCountdown, formatCountdownSpoken, initialsOf } from "@/lib/format";
import { clockOffset, portalApi, PortalApiError, type PortalRecord, type PortalStatus } from "../_lib/api";
import { durationLabel, patientFirstName, patientFullName } from "../_lib/format";
import {
  DEMO_CLINICIAN,
  prefersReducedMotion,
  readClinician,
  saveClinician,
  useNow,
  usePolling,
  useStoredClinician,
  type Clinician,
} from "../_lib/hooks";
import { FirstTimeAccordion } from "./FirstTimeAccordion";

/**
 * /view: everything before the record opens (PLAN.md section 6).
 *
 *   loading (c-loading) -> name step (new) -> code (c-code)
 *     wrong (c-code-error) / expired (c-code-expired) / locked (c-code-locked)
 *   -> waiting (c-waiting, polls every 2 s) -> denied (c-denied)
 *                                          -> timed out (new) / withdrawn (new)
 *                                          -> opening (c-opening) -> /view/session
 *
 * The browser only talks to /api/portal/*. Nothing about the patient is known
 * here until the session is active; the opening screen reads the patient's
 * name from the first record call.
 */

type Screen =
  | { kind: "loading" }
  | { kind: "name" }
  | { kind: "code" }
  | { kind: "wrong"; attemptsLeft: number; digits: string }
  | { kind: "expired" }
  | { kind: "locked"; until: string }
  | { kind: "waiting"; requestExpiresAt: string | null }
  | { kind: "denied" }
  | { kind: "timedout" }
  | { kind: "withdrawn" }
  | { kind: "opening"; record: PortalRecord; durationKind: string | null };

function siteHost(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) return "Trace";
  try {
    return new URL(url).host;
  } catch {
    return "Trace";
  }
}

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

  // Move focus to the new state's heading (or the code field), so keyboard and
  // screen reader users land on what changed.
  useEffect(() => {
    if (focusTarget.current === "heading") headingRef.current?.focus();
    if (focusTarget.current === "code") document.getElementById("portal-code")?.focus();
    focusTarget.current = "none";
  }, [screen]);

  const openRecord = useCallback(
    async (status: PortalStatus) => {
      const record = await portalApi.record("overview");
      if (!record) {
        // Access closed between the poll and this call. Let the session page explain.
        router.replace("/view/session");
        return;
      }
      go({ kind: "opening", record, durationKind: status.duration_kind });
    },
    [go, router],
  );

  /** Routes a portal_status to the right screen. Returns true if it handled it. */
  const applyStatus = useCallback(
    async (s: PortalStatus, initial: boolean) => {
      setOffset(clockOffset(s.server_time));
      if (s.locked_until && Date.parse(s.locked_until) > Date.now() + clockOffset(s.server_time)) {
        if (initial) go({ kind: "locked", until: s.locked_until });
        return;
      }
      switch (s.status) {
        case "requested":
          if (initial) go({ kind: "waiting", requestExpiresAt: s.request_expires_at });
          else setScreen((cur) => (cur.kind === "waiting" ? { ...cur, requestExpiresAt: s.request_expires_at } : cur));
          return;
        case "active":
          if (initial) router.replace("/view/session");
          else await openRecord(s);
          return;
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
          // browser remembers the doctor (and this is not the demo).
          else if (readClinician() && !new URLSearchParams(window.location.search).has("demo")) go({ kind: "code" }, "code");
          else go({ kind: "name" });
      }
    },
    [go, openRecord, router],
  );

  // First load: c-loading while the status call sets the portal cookie.
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    portalApi
      .status()
      .then(async (s) => {
        if (!cancelled) setDemo(new URLSearchParams(window.location.search).has("demo"));
        const wait = prefersReducedMotion() ? 0 : Math.max(0, 600 - (Date.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        if (!cancelled) await applyStatus(s, true);
      })
      .catch(() => {
        if (!cancelled) setProblem("The portal could not reach Trace. Check your connection and reload the page.");
      });
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);


  // Waiting: poll every 2 seconds (PLAN.md section 6).
  usePolling(
    async () => {
      const s = await portalApi.status();
      await applyStatus(s, false);
    },
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
      if (r.result === "requested") {
        go({ kind: "waiting", requestExpiresAt: r.request_expires_at });
      } else if (r.result === "locked" || (r.attempts_left === 0 && r.locked_until)) {
        go({ kind: "locked", until: r.locked_until ?? new Date(Date.now() + 15 * 60_000).toISOString() });
      } else if (r.result === "expired") {
        go({ kind: "expired" });
      } else {
        go({ kind: "wrong", attemptsLeft: r.attempts_left ?? 0, digits: code });
        return;
      }
      setDigits("");
    } catch (e) {
      if (e instanceof PortalApiError && e.code === "portal_busy") {
        // This browser already has a live request or session.
        const s = await portalApi.status();
        await applyStatus(s, true);
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

  const header = <PortalHeader clinician={clinician ?? undefined} />;
  const footer = <PortalFooter />;

  if (screen.kind === "loading") {
    return (
      <PortalShell tone="indigo" header={header} footer={footer}>
        <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
          <h1 className="font-display text-[64px] font-bold leading-none tracking-[-0.03em] sm:text-[80px]">
            trace
            <span className="sr-only"> Clinical Access Portal</span>
          </h1>
          <p className="text-body-lg">{siteHost()}/view · Clinical Access Portal</p>
          {problem ? (
            <p role="alert" className="max-w-[420px] rounded-md bg-surface-card px-4 py-3 text-body-sm text-red-700">
              {problem}
            </p>
          ) : (
            <p role="status" className="flex items-center gap-2">
              <span className="sr-only">Loading the portal</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="size-2.5 animate-pulse rounded-full bg-white"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </p>
          )}
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell tone="indigo" header={header} footer={footer}>
      <PortalHero
        title="Read your patient's record."
        subtitle="Nothing to install. No hospital integration. Your patient controls exactly what you see, and for how long."
      />
      <p className="mt-12 mb-6 text-center text-label font-medium uppercase tracking-[0.14em] sm:mt-[60px]">
        Clinical access · New session
      </p>
      <div className="px-4">
        {screen.kind === "name" && (
          <NameCard
            headingRef={headingRef}
            initial={demo ? DEMO_CLINICIAN : (stored ?? null)}
            onDone={(c) => {
              saveClinician(c);
              go({ kind: "code" }, "code");
            }}
          />
        )}

        {(screen.kind === "code" || screen.kind === "wrong") && (
          <AccessCard
            headingRef={headingRef}
            eyebrow={screen.kind === "wrong" ? "Incorrect code" : "New session"}
            tone={screen.kind === "wrong" ? "red" : "indigo"}
            title={screen.kind === "wrong" ? "That code doesn't match." : "Enter the patient's code."}
            body={
              screen.kind === "wrong"
                ? "Check with your patient and try again."
                : "Ask your patient to generate a share code in their Trace app."
            }
          >
            <form
              noValidate
              className="flex flex-col gap-5"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (screen.kind === "wrong") {
                  // "Try again": clear the boxes and start over.
                  setDigits("");
                  go({ kind: "code" }, "code");
                  return;
                }
                void submitCode(digits);
              }}
            >
              <CodeInput
                id="portal-code"
                length={4}
                label="Patient's share code"
                labelHidden
                value={digits}
                onChange={(v) => {
                  if (screen.kind === "wrong") go({ kind: "code" }, "none");
                  setProblem(null);
                  setDigits(v);
                }}
                error={
                  screen.kind === "wrong"
                    ? `That code doesn't match. ${screen.attemptsLeft} ${screen.attemptsLeft === 1 ? "try" : "tries"} left before a 15 minute pause.`
                    : problem ?? undefined
                }
              />
              <Button type="submit" size="lg" fullWidth loading={submitting}>
                {screen.kind === "wrong" ? "Try again" : "Continue"}
              </Button>
            </form>
            {clinician && <RequestingAs clinician={clinician} onChange={() => go({ kind: "name" })} />}
            <NeedHelp />
          </AccessCard>
        )}

        {screen.kind === "expired" && (
          <AccessCard
            headingRef={headingRef}
            eyebrow="Code expired"
            tone="peach"
            title="This code has expired."
            body="Codes last 5 minutes. Ask your patient for a new one."
          >
            <Button size="lg" fullWidth onClick={() => go({ kind: "code" }, "code")}>
              Enter a new code
            </Button>
            <NeedHelp />
          </AccessCard>
        )}

        {screen.kind === "locked" && (
          <LockedCard
            headingRef={headingRef}
            until={screen.until}
            offset={offset}
            onUnlock={() => go({ kind: "code" }, "code")}
          />
        )}

        {screen.kind === "waiting" && (
          <WaitingCard
            headingRef={headingRef}
            requestExpiresAt={screen.requestExpiresAt}
            offset={offset}
            onCancel={cancelRequest}
            cancelling={submitting}
            problem={problem}
          />
        )}

        {screen.kind === "denied" && (
          <AccessCard
            headingRef={headingRef}
            eyebrow="Not shared"
            tone="neutral"
            title="Your patient chose not to share their record."
            body="You can ask them to share again, or continue the consultation without it."
          >
            <HintStrip tone="neutral" icon={<Info aria-hidden="true" className="size-4 shrink-0" />}>
              This is normal. Patients are in control.
            </HintStrip>
            <div className="flex flex-col gap-3">
              <Button size="lg" fullWidth onClick={() => go({ kind: "code" }, "code")}>
                Enter a new code
              </Button>
              <Button variant="secondary" size="lg" fullWidth onClick={() => go({ kind: "name" })}>
                Close
              </Button>
            </div>
            <NeedHelp />
          </AccessCard>
        )}

        {screen.kind === "timedout" && (
          <AccessCard
            headingRef={headingRef}
            eyebrow="No answer"
            tone="peach"
            title="Your patient didn't answer in time."
            body="Requests close after 5 minutes. Ask your patient for a new code."
          >
            <Button size="lg" fullWidth onClick={() => go({ kind: "code" }, "code")}>
              Enter a new code
            </Button>
            <NeedHelp />
          </AccessCard>
        )}

        {screen.kind === "withdrawn" && (
          <AccessCard
            headingRef={headingRef}
            eyebrow="Not shared"
            tone="neutral"
            title="Your patient withdrew the code."
            body="They cancelled the share before answering. Ask them for a new code if you still need their record."
          >
            <Button size="lg" fullWidth onClick={() => go({ kind: "code" }, "code")}>
              Enter a new code
            </Button>
            <NeedHelp />
          </AccessCard>
        )}

        {screen.kind === "opening" && (
          <OpeningCard
            headingRef={headingRef}
            record={screen.record}
            durationKind={screen.durationKind}
            onDone={() => {
              // Next keeps this route alive (hidden) after navigating away;
              // drop the patient's name from it before leaving.
              go({ kind: "loading" }, "none");
              router.replace("/view/session");
            }}
          />
        )}
      </div>
      <FirstTimeAccordion className="mt-16 mb-16 sm:mt-[80px]" />
    </PortalShell>
  );
}

function NeedHelp() {
  return (
    <a
      href="#first-time"
      className="mx-auto rounded-xs py-3.5 text-button-md font-medium text-indigo-text hovered:underline"
      onClick={() => setTimeout(() => document.getElementById("first-time")?.focus(), 0)}
    >
      Need help?
    </a>
  );
}

function RequestingAs({ clinician, onChange }: { clinician: Clinician; onChange: () => void }) {
  return (
    <p className="text-center text-body-sm text-text-tertiary">
      Requesting as {[clinician.name, clinician.role, clinician.practice].filter(Boolean).join(", ")}.{" "}
      <button
        type="button"
        onClick={onChange}
        className="hit-area rounded-xs font-medium text-indigo-text underline underline-offset-2"
      >
        Change details
      </button>
    </p>
  );
}

function NameCard({
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
    <AccessCard
      headingRef={headingRef}
      eyebrow="New session"
      title="Who is asking?"
      body="Your patient sees these details on their phone before they decide. Trace does not check them."
    >
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
        <Button type="submit" size="lg" fullWidth>
          Continue
        </Button>
      </form>
      <p className="text-center text-body-sm text-text-tertiary">Remembered on this computer for next time.</p>
    </AccessCard>
  );
}

function LockedCard({
  until,
  offset,
  onUnlock,
  headingRef,
}: {
  until: string;
  offset: number;
  onUnlock: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const now = useNow(offset, 1000);
  const left = Date.parse(until) - now;
  const unlocked = left <= 0;
  const time = new Intl.DateTimeFormat("en-IE", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Dublin",
  }).format(new Date(until));
  return (
    <AccessCard
      headingRef={headingRef}
      eyebrow="Too many attempts"
      tone="red"
      title="Too many attempts."
      body={
        <>
          <p>Ask your patient to generate a new code.</p>
          <p className="mt-2 text-body-sm">
            {unlocked ? "You can try again now." : `Code entry is paused for this browser until ${time}.`}
          </p>
        </>
      }
    >
      <CodeInput id="portal-code" length={4} label="Patient's share code" labelHidden value="" onChange={() => {}} disabled />
      <Button size="lg" fullWidth disabled={!unlocked} onClick={onUnlock}>
        Enter a new code
      </Button>
      <NeedHelp />
    </AccessCard>
  );
}

function WaitingCard({
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
  const left = requestExpiresAt ? Date.parse(requestExpiresAt) - now : null;
  return (
    <AccessCard
      headingRef={headingRef}
      eyebrow="Request sent"
      tone="teal"
      title="Waiting for patient to approve."
      body="Patient will see exactly what you're asking to view, and chooses what to share."
    >
      {left !== null && (
        <p className="flex items-center gap-2 px-3.5 text-label font-medium text-indigo-text">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <span aria-hidden="true">Patient has {formatCountdown(left)} to respond</span>
          <span className="sr-only">The patient has about {formatCountdownSpoken(Math.ceil(left / 60000) * 60000)} to respond</span>
        </p>
      )}
      <StepList
        steps={[
          { label: "Code accepted", state: "done" },
          { label: "Waiting for approval", state: "current" },
          { label: "Open record", state: "todo" },
        ]}
      />
      {problem && (
        <p role="alert" className="text-body-sm text-red-700">
          {problem}
        </p>
      )}
      <div className="flex flex-col items-center gap-2">
        <Button variant="ghost" size="md" onClick={onCancel} loading={cancelling}>
          Cancel request
        </Button>
        <p className="text-center text-body-tiny text-text-tertiary">The patient keeps their code and can still share later</p>
      </div>
    </AccessCard>
  );
}

function OpeningCard({
  record,
  durationKind,
  onDone,
  headingRef,
}: {
  record: PortalRecord;
  durationKind: string | null;
  onDone: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const [progress, setProgress] = useState(0);
  const first = patientFirstName(record.patient);
  const full = patientFullName(record.patient);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const reduce = prefersReducedMotion();
    const step = reduce ? 100 : 20;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + step);
        if (next >= 100) {
          window.clearInterval(id);
          window.setTimeout(() => done.current(), reduce ? 0 : 300);
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const steps = ["Critical safety", "Conditions & medications", "Recent visits & care team"];
  return (
    <AccessCard
      headingRef={headingRef}
      eyebrow="Approved"
      tone="teal"
      title={`Opening ${first}'s record.`}
      body={`Loading the sections ${first} chose to share.`}
    >
      <div className="flex items-center gap-3 rounded-pill-loose bg-brand-indigo-tint p-1.5 pr-4">
        <Avatar initials={initialsOf(full)} size="sm" tone="solid" />
        <div className="min-w-0">
          <p className="text-body-sm font-medium">{full}</p>
          <p className="text-body-tiny text-text-tertiary">
            {["GP visit profile", durationLabel(durationKind)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-8">
        <p className="flex justify-between text-body-tiny">
          <span className="text-text-tertiary">Loading record</span>
          <span aria-hidden="true" className="font-medium text-indigo-text">
            {progress}%
          </span>
        </p>
        <ProgressBar value={progress} label="Loading record" valueText={`${progress}%`} />
      </div>
      <StepList
        steps={steps.map((label, i) => ({
          label,
          state: progress >= (i + 1) * 33 ? "done" : progress >= i * 33 ? "current" : "todo",
        }))}
      />
      <p className="text-center text-body-tiny text-text-tertiary">Encrypted in transit · read-only · access logged</p>
    </AccessCard>
  );
}
