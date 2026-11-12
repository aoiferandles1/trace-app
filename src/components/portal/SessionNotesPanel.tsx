"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";

/**
 * The doctor's session notes (BRIEF.md 6.3, board PortalRecordE).
 *
 * SessionNotesPanel: on ground, "Session notes" (Sora 20) with the save
 * status beside it ("Saved 11:29"), one line saying where they go, a
 * collapse button, four fields (Chief complaint, Assessment, Plan,
 * Follow-up) that grow with their text, "Save notes" and "Copy notes".
 * Each field holds up to 5,000 characters (the database's limit); a count
 * shows near the end. When the patient did not allow notes it shows one
 * line saying so and no fields. Controlled: the page owns the draft and the
 * autosave. Autosaves show only as the status beside the heading; "Save
 * notes" spins only when it was pressed (the page announces its result).
 *
 * `focusMemory`: the panel is drawn in a different place when access
 * pauses or comes back, which mounts it again. Pass the same
 * createFocusMemory() each time:
 * the field being typed in, and the caret, carry over to the new panel.
 *
 * ResizableNotes: the panel on the right of the record from 1024px, with a
 * vertical drag handle before it (role="separator", aria-valuenow is the
 * width). Drag it to pull the panel wider or push it closed; it snaps shut
 * under 120px and opens at no less than 240. Keyboard: Left and Right move
 * it 24px (Right from 240 closes it), Enter collapses or opens. Collapsed,
 * it is a 56px strip with an open button, which also says when the notes
 * are not saved. The width is remembered in this browser (a number only).
 * Below 1024px the notes sit under the record, full width, with no handle.
 */

export type SessionNotes = {
  chiefComplaint: string;
  assessment: string;
  plan: string;
  followUp: string;
};

export type SaveState = "idle" | "saving" | "saved" | "error";

/** The database keeps up to this many characters in each field. */
export const NOTES_MAX = 5000;
const COUNT_FROM = 4500;

const FIELDS: Array<{ key: keyof SessionNotes; label: string }> = [
  { key: "chiefComplaint", label: "Chief complaint" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
  { key: "followUp", label: "Follow-up" },
];

export type FocusSpot = { key: keyof SessionNotes; start: number; end: number };

/** Where typing was when the panel went away, for the next panel to pick up. */
export type FocusMemory = { keep: (spot: FocusSpot) => void; take: () => FocusSpot | null };

export function createFocusMemory(): FocusMemory {
  let spot: FocusSpot | null = null;
  return {
    keep: (s) => {
      spot = s;
    },
    take: () => {
      const s = spot;
      spot = null;
      return s;
    },
  };
}

/** The notes as plain text, labelled, for copying or printing. */
export function notesText(n: SessionNotes): string {
  return FIELDS.map((f) => [f.label, n[f.key].trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n\n");
}

export function SessionNotesPanel({
  notes,
  onChange,
  onSave,
  saveState = "idle",
  savedAt,
  errorText = "Notes could not be saved. Check your connection and try Save notes again.",
  manualSave = false,
  patientFirstName,
  allowed = true,
  disabled = false,
  onCollapse,
  collapseRef,
  focusMemory,
  className,
}: {
  notes: SessionNotes;
  onChange: (notes: SessionNotes) => void;
  onSave: () => void;
  saveState?: SaveState;
  /** "11:29": when the notes last reached the record's draft. */
  savedAt?: string | null;
  /** What went wrong, in words, when saveState is "error". */
  errorText?: string;
  /** True while a save the doctor asked for is on its way (the button spins). */
  manualSave?: boolean;
  /** "Jane", for "Added to Jane's record when the session ends." */
  patientFirstName: string;
  /** false when the patient did not allow notes: one line, no fields. */
  allowed?: boolean;
  disabled?: boolean;
  /** Shows the collapse button (from 1024px). */
  onCollapse?: () => void;
  collapseRef?: React.Ref<HTMLButtonElement>;
  focusMemory?: FocusMemory;
  className?: string;
}) {
  const base = useId();
  const fieldId = (key: keyof SessionNotes) => `${base}-${key}`;
  const [said, setSaid] = useState("");

  // Carry the field being typed in across a remount (see focusMemory above).
  useLayoutEffect(() => {
    const m = focusMemory?.take();
    if (m) {
      const el = document.getElementById(`${base}-${m.key}`);
      if (el instanceof HTMLTextAreaElement) {
        el.focus({ preventScroll: true });
        try {
          el.setSelectionRange(m.start, m.end);
        } catch {
          // The caret is a nicety.
        }
      }
    }
    return () => {
      const active = document.activeElement;
      if (!focusMemory || !(active instanceof HTMLTextAreaElement)) return;
      const f = FIELDS.find((x) => active.id === `${base}-${x.key}`);
      if (f) focusMemory.keep({ key: f.key, start: active.selectionStart, end: active.selectionEnd });
    };
  }, [focusMemory, base]);

  const status =
    saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : savedAt ? `Saved ${savedAt}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(notesText(notes));
      setSaid("Notes copied");
    } catch {
      setSaid("The notes could not be copied. Select the text and copy it instead.");
    }
  }

  const anyText = FIELDS.some((f) => notes[f.key].trim());

  return (
    <div className={cn("flex flex-col gap-3 px-5 py-5.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            {/* Sora 300 at 20/26, the board's size for this title (text-year is that role). */}
            <h2 className="font-display text-year font-light">Session notes</h2>
            {allowed && status && (
              <p className={cn("text-meta", saveState === "error" ? "font-semibold text-critical" : "text-ink-2")}>
                {status}
              </p>
            )}
          </div>
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
          {FIELDS.map((f) => {
            const length = notes[f.key].length;
            return (
              <TextArea
                key={f.key}
                id={fieldId(f.key)}
                label={f.label}
                density="compact"
                rows={2}
                maxLength={NOTES_MAX}
                hint={length >= COUNT_FROM ? `${length.toLocaleString("en-IE")} of 5,000 characters` : undefined}
                textareaClassName="field-sizing-content max-h-96"
                value={notes[f.key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...notes, [f.key]: e.target.value })}
              />
            );
          })}
          {saveState === "error" && (
            <p role="alert" className="text-caption text-critical">
              {errorText}
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="mt-1"
            onClick={() => {
              setSaid("");
              onSave();
            }}
            loading={manualSave && saveState === "saving"}
            disabled={disabled}
          >
            Save notes
          </Button>
          {anyText && (
            <Button variant="text" size="md" className="self-start" onClick={() => void copy()}>
              Copy notes
            </Button>
          )}
          <p role="status" className="sr-only">
            {said}
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
/** A width in pixels, nothing else: no patient data goes into browser storage. */
const WIDTH_KEY = "trace.portal.notesWidth";

function maxFor(viewport: number): number {
  return Math.max(MIN_OPEN, Math.min(MAX_WIDTH, viewport - RESERVED));
}

function snap(w: number): number {
  return w < SNAP_SHUT ? 0 : Math.max(MIN_OPEN, w);
}

function readWidth(fallback: number): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_KEY);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= MAX_WIDTH ? snap(n) : fallback;
  } catch {
    return fallback;
  }
}

function writeWidth(w: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(w)));
  } catch {
    // Private mode: the width is just not remembered.
  }
}

export function ResizableNotes({
  children,
  label = "Session notes",
  id,
  attention,
  startCollapsed = false,
  remember = true,
}: {
  /** The panel. Receives the collapse handler and the ref for its collapse button. */
  children: (collapse: { onCollapse: () => void; collapseRef: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  label?: string;
  /** The panel's id, for a "Go to notes" link. */
  id?: string;
  /** Shown on the collapsed strip, so a closed panel cannot hide it ("Not saved"). */
  attention?: string;
  /** Start closed (the /demo laptop frame, where the record needs the room). */
  startCollapsed?: boolean;
  /** Remember the width in this browser. */
  remember?: boolean;
}) {
  // The remembered width (a browser-only value; the server draws the default).
  const [width, setWidthState] = useState(() => {
    const start = startCollapsed ? 0 : DEFAULT_WIDTH;
    return typeof window === "undefined" || !remember ? start : readWidth(start);
  });
  const [maxW, setMaxW] = useState(() => (typeof window === "undefined" ? MAX_WIDTH : maxFor(window.innerWidth)));
  const drag = useRef<{ x: number; w: number } | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"open" | "collapse" | null>(null);
  const autoId = useId();
  const panelId = id ?? autoId;

  const setWidth = (next: number | ((w: number) => number), save = true) => {
    setWidthState((w) => {
      const v = typeof next === "function" ? next(w) : next;
      if (save && remember) writeWidth(v);
      return v;
    });
  };

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
      // At the narrowest open width, one more step closes it (aria-valuemin is 0).
      setWidth(collapsed || shown <= MIN_OPEN ? 0 : snap(clamp(shown - STEP)));
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
    const d = drag.current;
    setWidth(clamp(d.w + (d.x - e.clientX)), false);
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
          "min-w-0 scroll-mt-4 border-t border-border-card bg-ground lg:h-full lg:shrink-0 lg:overflow-y-auto lg:border-t-0",
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
              label={attention ? `Open session notes. ${attention}` : "Open session notes"}
              size={40}
              tone="framed"
              onClick={() => {
                focusAfter.current = "collapse";
                setWidth(Math.min(OPEN_WIDTH, maxW));
              }}
            />
            <span
              aria-hidden="true"
              className={cn("text-center text-micro", attention ? "font-semibold text-critical" : "text-ink-2")}
            >
              {attention ?? "Notes"}
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
