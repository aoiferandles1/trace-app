"use client";

import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
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
