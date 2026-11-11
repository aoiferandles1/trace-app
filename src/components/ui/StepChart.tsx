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
 * the portal pane) and never scrolls or clips. A label that would run past
 * the right edge is pulled back inside it.
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
  const n = periods.length;
  if (n === 0) return null;
  const vals = periods.map((p) => p.value);
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const yOf = (v: number) => (mx === mn ? TOP + (H - TOP - BOTTOM) / 2 : TOP + ((mx - v) / (mx - mn)) * (H - TOP - BOTTOM));

  // The line, in a viewBox one unit wide per period, stretched to the inner width.
  let d = "";
  periods.forEach((p, i) => {
    const y = yOf(p.value);
    d += `${i === 0 ? "M" : "L"}${i} ${y} L${i + 1} ${y} `;
  });

  return (
    <div className={cn("@container relative w-full", className)} style={{ height: H }}>
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
        return (
          <div key={i} aria-hidden="true">
            <span className="absolute size-2.5 rounded-full bg-accent" style={{ left, top: Math.round(y - 5) }} />
            <span
              className="absolute whitespace-nowrap text-micro font-semibold text-ink"
              style={{
                left,
                top: Math.round(y - 26),
                // Starts at the dot; if it would pass the right edge, shifts left just enough.
                translate: `min(0px, calc(100cqw - ${leftCq} - 100%)) 0`,
              }}
            >
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
