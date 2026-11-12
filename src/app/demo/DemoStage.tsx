"use client";

import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { StepRow, StepRows } from "@/components/portal/PortalSplit";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const WIDE = "(min-width: 1100px)";
/** Narrower than this is a phone: no frame, just a way into each side. */
const ROOMY = "(min-width: 700px)";
const PATIENT_SRC = "/";
const PORTAL_SRC = "/view?demo=1";
/** The size the portal is drawn at inside the laptop, before scaling to fit. */
const LAPTOP = { width: 1100, height: 760 };

function useMedia(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/**
 * The two devices. From 1100px wide: phone and laptop side by side. Below
 * that there is no room for both, so the phone alone, with a link that opens
 * the portal in a new tab (the second "device"). On a phone (under 700px) a
 * phone drawn inside a phone only gets in the way, so there is no frame:
 * the steps, and a button into each side, each in its own tab.
 */
export function DemoStage() {
  const wide = useMedia(WIDE);
  const roomy = useMedia(ROOMY);
  if (roomy === false) return <OnAPhone />;
  return (
    <div className="min-h-dvh bg-ground text-ink">
      <main id="main" className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 min-[1100px]:px-8">
        <header className="flex flex-col gap-1.5">
          <p className="font-display text-wordmark font-light">trace</p>
          <h1 className="font-display text-title font-light">Try both sides of a GP visit</h1>
          <p className="text-caption text-ink-2">
            {wide === false
              ? "Start on the phone: tap Try the demo and share Jane's record. Then open the doctor's portal and type the code."
              : "Start on the phone: tap Try the demo and share Jane's record. Then type the code into the laptop."}{" "}
            Sample data only. Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
            <Link href="/terms" className="text-accent underline underline-offset-2">
              Terms
            </Link>
          </p>
        </header>
        {wide === null ? (
          <p role="status" className="py-10 text-center text-caption text-ink-2">
            Loading the demo&hellip;
          </p>
        ) : wide ? (
          <div className="flex items-start gap-10">
            <Phone />
            <Laptop />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <a
              href={PORTAL_SRC}
              target="_blank"
              rel="noopener"
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              Open the doctor&apos;s portal
              <Icon name="external" size={16} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <Phone />
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * /demo on a phone. Each side opens in its own named tab, so the two buttons
 * come back to the same two tabs however often they are tapped (and, saved
 * to the home screen, each side is its own app: Trace and Trace Portal).
 */
function OnAPhone() {
  const steps = [
    "In Jane's app, tap Try the demo, then Share record. You get a four digit code.",
    "In the doctor's portal, type the code.",
    "Back in Jane's app, tap Allow access.",
  ];
  return (
    <div className="min-h-dvh bg-ground pb-[env(safe-area-inset-bottom)] text-ink">
      <main id="main" className="mx-auto flex max-w-[480px] flex-col gap-6 px-5 py-6">
        <header className="flex flex-col gap-1.5">
          <p className="font-display text-wordmark font-light">trace</p>
          <h1 className="font-display text-title font-light">Try both sides of a GP visit</h1>
          <p className="text-caption text-ink-2">
            Sample data only. Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
            <Link href="/terms" className="text-accent underline underline-offset-2">
              Terms
            </Link>
          </p>
        </header>
        <StepRows label="How to try it">
          {steps.map((step, i) => (
            <StepRow
              key={step}
              marker={
                <span aria-hidden="true" className="w-7 shrink-0 font-display text-numeral-lg font-light text-accent">
                  {i + 1}
                </span>
              }
            >
              {step}
            </StepRow>
          ))}
        </StepRows>
        <div className="flex flex-col gap-3">
          <a href={PATIENT_SRC} target="trace-patient" className={buttonClasses({ size: "lg", fullWidth: true })}>
            Open Jane&apos;s app
            <span className="sr-only">(opens in its own tab)</span>
          </a>
          <a
            href={PORTAL_SRC}
            target="trace-portal"
            className={buttonClasses({ variant: "secondary", size: "lg", fullWidth: true })}
          >
            Open the doctor&apos;s portal
            <span className="sr-only">(opens in its own tab)</span>
          </a>
        </div>
        <p className="text-caption text-ink-2">
          Each side opens in its own tab. To keep them on your phone, open a side and add it to your home screen.
        </p>
      </main>
    </div>
  );
}

function Phone() {
  return (
    <figure className="flex w-full max-w-[414px] shrink-0 flex-col items-center gap-2">
      <div className="w-full rounded-feature border border-border-card bg-surface p-2">
        <iframe
          src={PATIENT_SRC}
          title="Patient app, on a phone"
          className="block h-[min(844px,calc(100dvh-180px))] min-h-[560px] w-full rounded-card bg-ground"
        />
      </div>
      <figcaption className="text-caption text-ink-2">Jane&apos;s phone</figcaption>
    </figure>
  );
}

function Laptop() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / LAPTOP.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="w-full rounded-tile border border-border-card bg-surface p-2">
        <div ref={box} className="w-full overflow-hidden rounded-rail" style={{ height: LAPTOP.height * scale }}>
          <iframe
            src={PORTAL_SRC}
            title="Doctor's portal, on a laptop"
            className="block origin-top-left bg-ground"
            style={{ width: LAPTOP.width, height: LAPTOP.height, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <figcaption className="text-caption text-ink-2">Dr Hennessy&apos;s laptop</figcaption>
    </figure>
  );
}
