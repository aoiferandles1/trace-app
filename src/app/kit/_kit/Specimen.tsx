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
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-20 border-t border-border-default pt-10">
      <h2 id={`${id}-title`} className="font-display text-display-sm font-light">
        {title}
      </h2>
      {description && <p className="mt-2 max-w-3xl text-body-sm text-text-tertiary">{description}</p>}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

export function Specimen({
  title,
  note,
  children,
  className,
  surface = "page",
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Background to show the component on. */
  surface?: "page" | "card" | "indigo";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h3 className="text-h4 font-bold">{title}</h3>
        {note && <p className="text-body-tiny text-text-tertiary">{note}</p>}
      </div>
      <div
        className={cn(
          "rounded-card p-4 sm:p-6",
          surface === "page" && "border border-dashed border-border-strong",
          surface === "card" && "bg-surface-card",
          surface === "indigo" && "on-dark bg-indigo-surface-dark text-white",
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
  return <p className="text-body-tiny text-text-tertiary [.on-dark_&]:text-white">{children}</p>;
}
