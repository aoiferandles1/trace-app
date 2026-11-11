import { cn } from "@/lib/cn";

/**
 * Blood result range (BRIEF.md section 3.11, board PortalRecordE): a 6px
 * border-row track, the normal range shaded in range-band, and a 12px dot
 * for the value. Out of range, the dot is urgent and the value says "low"
 * or "high" in words, never colour alone.
 *
 * The scale runs 30% of the range's width either side of it (never below
 * zero), and the dot is kept 3% inside each end, as on the board.
 *
 * - RangeBar: the bar only, role="img" with its reading as the name.
 * - ResultRow: the board's row: name, value line (with the flag), and the
 *   bar in a 120px column.
 */

export type ResultFlag = "low" | "high" | null;

export function resultFlag(value: number, low: number, high: number): ResultFlag {
  return value < low ? "low" : value > high ? "high" : null;
}

function scale(value: number, low: number, high: number) {
  const span = high - low;
  const mn = Math.max(0, low - span * 0.3);
  const mx = high + span * 0.3;
  const pct = (x: number) => (mx === mn ? 50 : Math.max(3, Math.min(97, ((x - mn) / (mx - mn)) * 100)));
  return { band: [pct(low), pct(high)] as const, dot: pct(value) };
}

export function RangeBar({
  name,
  value,
  unit = "",
  low,
  high,
  className,
}: {
  name: string;
  value: number;
  unit?: string;
  low: number;
  high: number;
  className?: string;
}) {
  const s = scale(value, low, high);
  const flag = resultFlag(value, low, high);
  const reading = `${name} ${value}${unit ? ` ${unit}` : ""}, ${flag ?? "in range"}. Normal range ${low} to ${high}.`;
  return (
    <span role="img" aria-label={reading} className={cn("relative block h-1.5 rounded-full bg-border-row", className)}>
      <span
        className="absolute top-0 h-1.5 rounded-full bg-range-band"
        style={{ left: `${s.band[0]}%`, width: `${s.band[1] - s.band[0]}%` }}
      />
      <span
        className={cn("absolute -top-0.75 -ml-1.5 size-3 rounded-full", flag ? "bg-urgent" : "bg-accent")}
        style={{ left: `${s.dot}%` }}
      />
    </span>
  );
}

export function ResultRow({
  name,
  value,
  unit = "",
  low,
  high,
  className,
}: {
  name: string;
  value: number;
  unit?: string;
  low: number;
  high: number;
  className?: string;
}) {
  const flag = resultFlag(value, low, high);
  return (
    <div className={cn("grid grid-cols-[1fr_120px] items-center gap-x-5", className)}>
      <span className="flex min-w-0 flex-col">
        <span className="text-row font-medium">{name}</span>
        <span className={cn("text-caption", flag ? "font-semibold text-urgent" : "text-ink-2")}>
          {`${value} ${unit}`.trim()}
          {flag && `, ${flag}`}
        </span>
      </span>
      <RangeBar name={name} value={value} unit={unit} low={low} high={high} />
    </div>
  );
}
