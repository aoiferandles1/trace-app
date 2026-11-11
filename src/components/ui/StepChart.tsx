"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Strength history as a stepped line (BRIEF.md section 3.10, boards
 * MedDetailA2 and PortalRecordE): a 2.5px accent line that steps at each
 * period start, a 10px accent dot there, and the strength above it (12px
 * 600). No y axis.
 *
 * Positions are computed from the data with the boards' own maths (insets
 * 14px left and right, 34px top, 24px bottom; each period gets an equal
 * slice of the width; the lowest strength sits lowest, a single strength is
 * centred). x positions are fractions of the container's width, so the chart
 * always fills its container exactly (318px in a phone card, about 270px in
 * the portal pane) and never scrolls or clips.
 *
 * Labels: the boards put each one above its dot, starting 5px left of the
 * dot's centre. That is where a label goes whenever it is clear of the line,
 * the dots and the other labels. Where it is not (the line drops from 45mg
 * into the last 36mg, so the drop runs through the space above that dot; or
 * many periods in a narrow pane), the label takes the first clear place from
 * a short list: under the dot, then above or under just right of the dot,
 * then ending at the dot. Once the chart has measured itself this is worked
 * out from the real widths; before that (the first paint) a label whose dot
 * the line drops into goes under it, the others above, and a label that would
 * run past the right edge is pulled back inside.
 *
 * Screen readers get a visually hidden table of the same periods; the
 * drawing itself is hidden from them.
 */

export type StepPeriod = {
  value: number;
  /** "Jan 2024" */
  from: string;
  /** "Mar 2024", or "now" for the current period. */
  to: string;
};

const H = 130;
const INSET_X = 14;
const TOP = 34;
const BOTTOM = 24;
/** A label's line height (text-micro). */
const LABEL_H = 16;
/** Room kept between a label and the line (half the 2.5px stroke, plus a little). */
const PAD = 2;

type Rect = { l: number; t: number; r: number; b: number };
type Spot = { left: number; top: number };

const overlaps = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * Where each label goes, in px from the chart's top left, given the chart's
 * width and each label's width.
 */
function placeLabels(values: number[], width: number, labelWidths: number[]): Spot[] {
  const n = values.length;
  const yOf = valueToY(values);
  const xs = values.map((_, i) => INSET_X + ((width - INSET_X * 2) * i) / n);
  const ys = values.map(yOf);
  const blocked: Rect[] = [];
  values.forEach((_, i) => {
    const x = xs[i];
    const y = ys[i];
    const xEnd = INSET_X + ((width - INSET_X * 2) * (i + 1)) / n;
    blocked.push({ l: x - PAD, t: y - PAD, r: xEnd + PAD, b: y + PAD }); // this period's line
    blocked.push({ l: x - 5, t: y - 5, r: x + 5, b: y + 5 }); // its dot
    if (i > 0 && ys[i - 1] !== y) {
      blocked.push({ l: x - PAD, t: Math.min(ys[i - 1], y) - PAD, r: x + PAD, b: Math.max(ys[i - 1], y) + PAD }); // the step
    }
  });
  const clampLeft = (l: number, w: number) => Math.max(0, Math.min(l, width - w));
  const clampTop = (t: number) => Math.max(0, Math.min(t, H - LABEL_H));
  return values.map((_, i) => {
    const x = xs[i];
    const y = ys[i];
    const w = labelWidths[i] ?? 0;
    const candidates: Spot[] = [
      { left: x - 5, top: y - 26 }, // the boards' place: above
      { left: x - 5, top: y + 8 }, // under
      { left: x + 8, top: y - 26 }, // above, right of the dot
      { left: x + 8, top: y + 8 }, // under, right of the dot
      { left: x + 5 - w, top: y - 26 }, // above, ending at the dot
      { left: x + 5 - w, top: y + 8 }, // under, ending at the dot
    ].map((c) => ({ left: Math.round(clampLeft(c.left, w)), top: Math.round(clampTop(c.top)) }));
    const clear = candidates.find((c) => {
      const rect = { l: c.left, t: c.top, r: c.left + w, b: c.top + LABEL_H };
      return !blocked.some((b) => overlaps(rect, b));
    });
    const spot = clear ?? candidates[0];
    blocked.push({ l: spot.left - 2, t: spot.top, r: spot.left + w + 2, b: spot.top + LABEL_H });
    return spot;
  });
}

function valueToY(values: number[]) {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  return (v: number) => (mx === mn ? TOP + (H - TOP - BOTTOM) / 2 : TOP + ((mx - v) / (mx - mn)) * (H - TOP - BOTTOM));
}

export function StepChart({
  periods,
  unit,
  caption,
  className,
}: {
  /** Oldest first. */
  periods: StepPeriod[];
  /** "mg", "mcg" */
  unit: string;
  /** Names the hidden table ("Concerta strength over time"). */
  caption: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const valuesKey = periods.map((p) => p.value).join(",") + unit;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || periods.length === 0) return;
    let live = true;
    const layout = () => {
      if (!live) return;
      const labels = [...el.querySelectorAll<HTMLElement>("[data-chart-label]")];
      const width = el.clientWidth;
      if (width === 0) return;
      setSpots(placeLabels(periods.map((p) => p.value), width, labels.map((l) => l.offsetWidth)));
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    // Label widths change once the web font arrives.
    document.fonts?.ready.then(layout).catch(() => {});
    return () => {
      live = false;
      ro.disconnect();
    };
    // periods is read through valuesKey: a new array with the same values needs no new layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey]);

  const n = periods.length;
  if (n === 0) return null;
  const yOf = valueToY(periods.map((p) => p.value));

  // The line, in a viewBox one unit wide per period, stretched to the inner width.
  let d = "";
  periods.forEach((p, i) => {
    const y = yOf(p.value);
    d += `${i === 0 ? "M" : "L"}${i} ${y} L${i + 1} ${y} `;
  });

  const measured = spots && spots.length === n ? spots : null;

  return (
    <div ref={ref} className={cn("@container relative w-full", className)} style={{ height: H }}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${n} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-y-0 overflow-visible"
        style={{ left: INSET_X, width: `calc(100% - ${INSET_X * 2}px)`, height: H }}
      >
        <path
          d={d.trim()}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="text-accent"
        />
      </svg>
      {periods.map((p, i) => {
        const y = yOf(p.value);
        // Left edge of the dot, as in the boards: x - 5.
        const left = `calc(${INSET_X - 5}px + (100% - ${INSET_X * 2}px) * ${i} / ${n})`;
        const leftCq = `calc(${INSET_X - 5}px + (100cqw - ${INSET_X * 2}px) * ${i} / ${n})`;
        const dropsIn = i > 0 && periods[i - 1].value > p.value;
        const labelStyle: CSSProperties = measured
          ? { left: measured[i].left, top: measured[i].top }
          : {
              left,
              top: dropsIn ? Math.round(y + 8) : Math.round(y - 26),
              // Starts at the dot; if it would pass the right edge, shifts left just enough.
              translate: `min(0px, calc(100cqw - ${leftCq} - 100%)) 0`,
            };
        return (
          <div key={i} aria-hidden="true">
            <span className="absolute size-2.5 rounded-full bg-accent" style={{ left, top: Math.round(y - 5) }} />
            <span data-chart-label="" className="absolute whitespace-nowrap text-micro font-semibold text-ink" style={labelStyle}>
              {p.value}
              {unit}
            </span>
          </div>
        );
      })}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Strength</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={i}>
              <td>
                {p.value}
                {unit}
              </td>
              <td>{p.from}</td>
              <td>{p.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
