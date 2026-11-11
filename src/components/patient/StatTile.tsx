import { cn } from "@/lib/cn";

/**
 * Headline number, from Figma "Stat Card" (39:285).
 *
 * - `size="md"` (Home): 20px value, 12px label, white card.
 * - `size="lg"` (Profile): 40px Sora Light value in the tone's 700 shade.
 *
 * Tone colours the value only (neutral is ink). Value and label are read
 * together ("3 medications"). Lay several out with a 3-column grid.
 */

const toneText = {
  neutral: "text-text-primary",
  indigo: "text-indigo-text",
  teal: "text-teal-700",
  peach: "text-peach-700",
} as const;

export function StatTile({
  value,
  label,
  tone = "neutral",
  size = "md",
  className,
}: {
  value: string | number;
  label: string;
  tone?: keyof typeof toneText;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center rounded-card border border-border-default bg-surface-card text-center shadow-sm",
        size === "md" ? "gap-0.5 px-2 py-2.5" : "gap-1 px-2 py-5",
        className,
      )}
    >
      <p
        className={cn(
          toneText[tone],
          size === "md" ? "text-h3 font-medium" : "font-display text-[40px] font-light leading-none",
        )}
      >
        {value}
        <span className="sr-only"> {label}</span>
      </p>
      <p
        aria-hidden="true"
        className={cn(
          "truncate",
          size === "md" ? "text-body-tiny text-text-tertiary" : "text-body-sm font-medium",
          size === "lg" && (tone === "neutral" ? "text-text-tertiary" : toneText[tone]),
        )}
      >
        {label}
      </p>
    </div>
  );
}
