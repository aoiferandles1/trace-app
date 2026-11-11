"use client";

import { NotebookPen } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";

/**
 * The doctor's session notes, from Figma "Session Notes" (57:1521) as on
 * c-overview: indigo tint (PortalShell draws the 3px indigo edge), four fields (Chief
 * complaint, Assessment, Plan, Follow-up), a note that they go back to the
 * record, then "Save notes" and "End session".
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
    <aside
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-[22px] bg-brand-indigo-tint px-6 pb-7 pt-8 lg:pt-12",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={titleId} className="flex items-center gap-2 text-body-tiny font-bold">
          <NotebookPen aria-hidden="true" className="size-4" />
          Session notes
        </h2>
        <p className="text-body-tiny text-text-tertiary">Patient granted permission to add notes</p>
      </div>
      <div aria-hidden="true" className="h-px bg-brand-indigo" />
      {FIELDS.map((f) => (
        <TextArea
          key={f.key}
          label={f.label}
          labelStyle="eyebrow"
          density="compact"
          rows={3}
          placeholder="Type notes here..."
          value={notes[f.key]}
          disabled={disabled}
          onChange={(e) => onChange({ ...notes, [f.key]: e.target.value })}
        />
      ))}
      <p className="text-body-tiny text-indigo-text">
        Notes are written back to {patientFirstName}&rsquo;s record when the session ends.
      </p>
      <p
        role="status"
        className={cn(
          "min-h-5 text-body-tiny",
          saveState === "error" ? "text-red-700" : "text-text-tertiary",
        )}
      >
        {STATUS[saveState]}
      </p>
      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="md"
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
