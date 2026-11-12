import { cn } from "@/lib/cn";

/**
 * The share code as the patient sees it (CodeA2): four white boxes, 88px
 * tall with radius 18, the digits in Sora 300 at 44px, on session indigo.
 *
 * The boxes are hidden from screen readers; `label` is what they hear
 * instead (default "Your code: 9 0 7 0").
 *
 * With `onCopy` the whole code is a button that copies it (B2); its name is
 * the label then "Copy it".
 */
export function CodeDisplay({
  code,
  label,
  onCopy,
  className,
}: {
  code: string;
  /** Spoken form. Defaults to "Your code: 9 0 7 0". */
  label?: string;
  onCopy?: () => void;
  className?: string;
}) {
  const digits = code.split("");
  const boxes = (
    <span aria-hidden="true" className="flex gap-2.5">
      {digits.map((d, i) => (
        <span
          key={i}
          className="flex h-22 flex-1 items-center justify-center rounded-code bg-white font-display text-code font-light text-ink"
        >
          {d}
        </span>
      ))}
    </span>
  );
  const spoken = <span className="sr-only">{label ?? `Your code: ${digits.join(" ")}`}</span>;
  if (onCopy) {
    return (
      <button type="button" onClick={onCopy} className={cn("flex flex-col rounded-code text-left", className)}>
        {spoken}
        <span className="sr-only">. Copy it</span>
        {boxes}
      </button>
    );
  }
  return (
    <div className={cn("flex flex-col", className)}>
      {spoken}
      {boxes}
    </div>
  );
}
