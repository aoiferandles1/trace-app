"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";

/**
 * The doctor's session notes (BRIEF.md 6.3, board PortalRecordE).
 *
 * SessionNotesPanel: on ground, "Session notes" (Sora 20) and one line
 * saying where they go, a collapse button, four fields (Chief complaint,
 * Assessment, Plan, Follow-up) and "Save notes". When the patient did not
 * allow notes it shows one line saying so and no fields. Controlled: the
 * page owns the draft and the autosave; `saveState` drives a polite status
 * line under the button.
 *
 * ResizableNotes: the panel on the right of the record from 1024px, with a
 * vertical drag handle before it (role="separator", aria-valuenow is the
 * width). Drag it to pull the panel wider or push it closed; it snaps shut
 * under 120px and opens at no less than 240. Keyboard: Left and Right move
 * it 24px, Enter collapses or opens. Collapsed, it is a 56px strip with an
 * open button. Below 1024px the notes sit under the record, full width,
 * with no handle.
 */

export type SessionNotes = {
  chiefComplaint: string;
  assessment: string;
  plan: string;
  followUp: string;
};

export type SaveState = "idle" | "saving" | "saved" | "error";

const FIELDS: Array<{ key: keyof SessionNotes; label: string }> = [
  { key: "chiefComplaint", label: "Chief complaint" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
  { key: "followUp", label: "Follow-up" },
];

const STATUS: Record<SaveState, string> = {
  idle: "",
  saving: "Saving notes…",
  saved: "Notes saved",
  error: "Notes could not be saved. Check your connection and try Save notes again.",
};

export function SessionNotesPanel({
  notes,
  onChange,
  onSave,
  saveState = "idle",
  patientFirstName,
  allowed = true,
  disabled = false,
  onCollapse,
  collapseRef,
  className,
}: {
  notes: SessionNotes;
  onChange: (notes: SessionNotes) => void;
  onSave: () => void;
  saveState?: SaveState;
  /** "Jane", for "Added to Jane's record when the session ends." */
  patientFirstName: string;
  /** false when the patient did not allow notes: one line, no fields. */
  allowed?: boolean;
  disabled?: boolean;
  /** Shows the collapse button (from 1024px). */
  onCollapse?: () => void;
  collapseRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 px-5 py-5.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Sora 300 at 20/26, the board's size for this title (text-year is that role). */}
          <h2 className="font-display text-year font-light">
            Session notes
          </h2>
          <p className="text-caption text-ink-2">
            {allowed
              ? `Added to ${patientFirstName}’s record when the session ends.`
              : `${patientFirstName === "the patient" ? "The patient" : patientFirstName} did not allow notes for this session.`}
          </p>
        </div>
        {onCollapse && (
          <div className="hidden lg:block">
            <IconButton
              ref={collapseRef}
              icon="chevron-right"
              iconSize={20}
              label="Collapse session notes"
              size={36}
              tone="muted"
              onClick={onCollapse}
            />
          </div>
        )}
      </div>
      {allowed && (
        <>
          {FIELDS.map((f) => (
            <TextArea
              key={f.key}
              label={f.label}
              density="compact"
              rows={2}
              value={notes[f.key]}
              disabled={disabled}
              onChange={(e) => onChange({ ...notes, [f.key]: e.target.value })}
            />
          ))}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-1"
            onClick={onSave}
            loading={saveState === "saving"}
            disabled={disabled}
          >
            Save notes
          </Button>
          <p role="status" className={cn("min-h-5 text-caption", saveState === "error" ? "text-critical" : "text-ink-2")}>
            {STATUS[saveState]}
          </p>
        </>
      )}
    </div>
  );
}

const DEFAULT_WIDTH = 300;
const OPEN_WIDTH = 320;
const MIN_OPEN = 240;
const SNAP_SHUT = 120;
const STEP = 24;
const MAX_WIDTH = 560;
/** The rail, the handle and the narrowest the record may get. */
const RESERVED = 232 + 14 + 400;

function maxFor(viewport: number): number {
  return Math.max(MIN_OPEN, Math.min(MAX_WIDTH, viewport - RESERVED));
}

function snap(w: number): number {
  return w < SNAP_SHUT ? 0 : Math.max(MIN_OPEN, w);
}

export function ResizableNotes({
  children,
  label = "Session notes",
}: {
  /** The panel. Receives the collapse handler and the ref for its collapse button. */
  children: (collapse: { onCollapse: () => void; collapseRef: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  label?: string;
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [maxW, setMaxW] = useState(() => (typeof window === "undefined" ? MAX_WIDTH : maxFor(window.innerWidth)));
  const drag = useRef<{ x: number; w: number } | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"open" | "collapse" | null>(null);
  const panelId = useId();

  useEffect(() => {
    const onResize = () => setMaxW(maxFor(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // After the collapse or open buttons, focus moves to the control that replaced them.
  useEffect(() => {
    if (focusAfter.current === "open") openRef.current?.focus();
    if (focusAfter.current === "collapse") collapseRef.current?.focus();
    focusAfter.current = null;
  }, [width]);

  const clamp = (w: number) => Math.max(0, Math.min(maxW, w));
  const shown = width === 0 ? 0 : Math.min(width, maxW);
  const collapsed = shown < SNAP_SHUT;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth(collapsed ? MIN_OPEN : snap(clamp(shown + STEP)));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(snap(clamp(shown - STEP)));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setWidth(collapsed ? Math.min(OPEN_WIDTH, maxW) : 0);
    } else if (e.key === "Home") {
      e.preventDefault();
      setWidth(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setWidth(maxW);
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; dragging still works inside the handle.
    }
    drag.current = { x: e.clientX, w: collapsed ? 56 : shown };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setWidth(clamp(drag.current.w + (drag.current.x - e.clientX)));
  }

  function onPointerEnd() {
    if (!drag.current) return;
    drag.current = null;
    setWidth((w) => snap(w));
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize session notes. Arrow keys resize, Enter collapses or opens."
        aria-controls={panelId}
        aria-valuenow={Math.round(shown)}
        aria-valuemin={0}
        aria-valuemax={Math.round(maxW)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="hidden w-3.5 shrink-0 cursor-col-resize touch-none select-none items-center justify-center border-l border-border-card bg-ground focus-visible:-outline-offset-2 lg:flex"
      >
        <span aria-hidden="true" className="h-11 w-1 rounded-full bg-tree-line" />
      </div>
      <aside
        id={panelId}
        aria-label={label}
        style={{ "--notes-w": `${shown}px` } as React.CSSProperties}
        className={cn(
          "min-w-0 border-t border-border-card bg-ground lg:h-full lg:shrink-0 lg:overflow-y-auto lg:border-t-0",
          collapsed ? "lg:w-14" : "lg:w-(--notes-w)",
        )}
      >
        <div className={cn(collapsed && "lg:hidden")}>
          {children({
            onCollapse: () => {
              focusAfter.current = "open";
              setWidth(0);
            },
            collapseRef,
          })}
        </div>
        {collapsed && (
          <div className="hidden flex-col items-center gap-2 py-5.5 lg:flex">
            <IconButton
              ref={openRef}
              icon="pencil"
              label="Open session notes"
              size={40}
              tone="framed"
              onClick={() => {
                focusAfter.current = "collapse";
                setWidth(Math.min(OPEN_WIDTH, maxW));
              }}
            />
            <span aria-hidden="true" className="text-micro text-ink-2">
              Notes
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
