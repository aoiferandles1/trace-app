"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const WIDE = "(min-width: 1100px)";
const PATIENT_SRC = "/";
const PORTAL_SRC = "/view?demo=1";
/** The size the portal is drawn at inside the laptop, before scaling to fit. */
const LAPTOP = { width: 1100, height: 760 };

function useWide(): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

/**
 * The two devices. From 1100px wide: phone and laptop side by side. Below
 * that there is no room for both, so the phone alone, with a link that opens
 * the portal in a new tab (the second "device").
 */
export function DemoStage() {
  const wide = useWide();
  return (
    <div className="min-h-dvh bg-surface-sunken text-text-primary">
      <main id="main" className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 min-[1100px]:px-8">
        <header className="flex flex-col gap-1.5">
          <p className="text-[28px] font-bold leading-none tracking-[-0.03em] text-indigo-text">trace</p>
          <h1 className="text-h3 font-medium">Try both sides of a GP visit</h1>
          <p className="text-body-sm text-text-tertiary">
            {wide === false
              ? "Start on the phone: tap Try the demo and share Jane's record. Then open the doctor's portal and type the code."
              : "Start on the phone: tap Try the demo and share Jane's record. Then type the code into the laptop."}{" "}
            Sample data only. Trace is a portfolio project by Aoife Randles, not a medical service.{" "}
            <Link href="/terms" className="text-indigo-text underline underline-offset-2">
              Terms
            </Link>
          </p>
        </header>
        {wide === null ? (
          <p role="status" className="py-10 text-center text-body-sm text-text-tertiary">
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
              className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-brand-indigo bg-surface-card px-5 text-button-md font-medium text-indigo-text hovered:bg-brand-indigo-tint"
            >
              Open the doctor&apos;s portal
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <Phone />
          </div>
        )}
      </main>
    </div>
  );
}

function Phone() {
  return (
    <figure className="flex w-full max-w-[414px] shrink-0 flex-col items-center gap-2">
      <div className="w-full rounded-[44px] bg-text-primary p-3 shadow-lg">
        <iframe
          src={PATIENT_SRC}
          title="Patient app, on a phone"
          className="block h-[min(844px,calc(100dvh-180px))] min-h-[560px] w-full rounded-[32px] bg-surface-page"
        />
      </div>
      <figcaption className="text-body-tiny text-text-tertiary">Jane&apos;s phone</figcaption>
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
      <div className="w-full rounded-t-[20px] bg-text-primary px-3 pb-3 pt-5 shadow-lg">
        <div ref={box} className="w-full overflow-hidden rounded-[6px]" style={{ height: LAPTOP.height * scale }}>
          <iframe
            src={PORTAL_SRC}
            title="Doctor's portal, on a laptop"
            className="block origin-top-left bg-surface-page"
            style={{ width: LAPTOP.width, height: LAPTOP.height, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <div aria-hidden="true" className="h-3 w-[104%] rounded-b-[12px] bg-neutral-400" />
      <figcaption className="text-body-tiny text-text-tertiary">Dr Hennessy&apos;s laptop</figcaption>
    </figure>
  );
}
