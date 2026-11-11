import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Kit-only scaffolding: a titled section and a labelled specimen. Not for app screens. */

export function KitSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-20 border-t border-border-card pt-10">
      <h2 id={`${id}-title`} className="font-display text-title font-light">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-3xl text-body text-ink-2">{description}</p>}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

export type KitSurface = "ground" | "surface" | "session" | "accent";

const surfaces: Record<KitSurface, string> = {
  ground: "border border-dashed border-border-control bg-ground text-ink",
  surface: "bg-surface text-ink",
  session: "on-session bg-session text-white",
  accent: "bg-accent text-white",
};

/**
 * One component on one surface. `desk` wraps it in `.desk`, so the context
 * tokens take their portal values (12px radii, 40px buttons, 26px titles).
 */
export function Specimen({
  title,
  note,
  children,
  className,
  surface = "ground",
  desk = false,
  width,
  bleed = false,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  surface?: KitSurface;
  desk?: boolean;
  /** "phone": a 390px frame with the phone's 20px gutter. "desk": up to 1280px. */
  width?: "phone" | "desk";
  /** No padding: for full-width pieces (headers, the tab bar). */
  bleed?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h3 className="text-row font-medium">
          {title}
          {desk && <span className="ml-2 text-caption font-normal text-ink-2">desktop tokens</span>}
        </h3>
        {note && <p className="text-caption text-ink-2">{note}</p>}
      </div>
      <div
        className={cn(
          "rounded-tile",
          surfaces[surface],
          desk && "desk",
          bleed ? "overflow-hidden" : width === "phone" ? "w-full max-w-[390px] px-5 py-4" : "p-4 sm:p-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A small caption under a specimen inside a grid. */
export function StateLabel({ children }: { children: ReactNode }) {
  return <p className="text-micro text-ink-2 [.on-session_&]:text-on-session-2">{children}</p>;
}

/** A grid of states: each child is shown with its label under it. */
export function States({ items, className }: { items: Array<[string, ReactNode]>; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-6 gap-y-5", className)}>
      {items.map(([label, node]) => (
        <div key={label} className="flex flex-col items-start gap-2">
          {node}
          <StateLabel>{label}</StateLabel>
        </div>
      ))}
    </div>
  );
}
