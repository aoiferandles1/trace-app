"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";

/**
 * The doctor's session notes (board PortalRecordE): on ground, a Sora 20
 * title and a line saying they go to the record, four fields (Chief
 * complaint, Assessment, Plan, Follow-up), then "Save notes" and "End
 * session". Phase 7 adds the resizable, collapsible panel.
 *
 * Controlled: the page owns the draft and the autosave (PLAN.md section 7).
 * `saveState` drives a polite status message ("Saving…", "Saved").
 * Render only when the patient allowed notes (`allow_notes`).
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
  onEndSession,
  saveState = "idle",
  patientFirstName,
  disabled = false,
  className,
}: {
  notes: SessionNotes;
  onChange: (notes: SessionNotes) => void;
  onSave: () => void;
  onEndSession: () => void;
  saveState?: SaveState;
  /** "Jane", for "Notes are written back to Jane's record when the session ends." */
  patientFirstName: string;
  /** When the session is paused or ended. */
  disabled?: boolean;
  className?: string;
}) {
  const titleId = useId();
  return (
    <aside aria-labelledby={titleId} className={cn("flex flex-col gap-3 px-5 py-5.5", className)}>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="font-display text-heading font-light">
          Session notes
        </h2>
        <p className="text-caption text-ink-2">
          Added to {patientFirstName}&rsquo;s record when the session ends.
        </p>
      </div>
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
      <p role="status" className={cn("min-h-5 text-caption", saveState === "error" ? "text-critical" : "text-ink-2")}>
        {STATUS[saveState]}
      </p>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onSave}
          loading={saveState === "saving"}
          disabled={disabled}
        >
          Save notes
        </Button>
        <Button variant="secondary" size="md" fullWidth onClick={onEndSession}>
          End session
        </Button>
      </div>
    </aside>
  );
}
