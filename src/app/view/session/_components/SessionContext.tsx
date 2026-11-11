"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SaveState, SessionNotes } from "@/components/portal/SessionNotesPanel";
import { portalApi, PortalApiError, type PortalRecord, type PortalStatus, type RecordSection } from "../../_lib/api";

export type SessionContextValue = {
  status: PortalStatus;
  /** Milliseconds to add to Date.now() for the database clock. */
  offset: number;
  /** The overview section, loaded once by the frame while the session is active (the header reads it). */
  overview: PortalRecord<"overview"> | null;
  /** "Jane", or "the patient" before the record has loaded. */
  firstName: string;
  refreshStatus: () => Promise<void>;
  notes: SessionNotes;
  setNotes: (n: SessionNotes) => void;
  saveNotes: () => Promise<boolean>;
  saveState: SaveState;
  endSession: () => Promise<void>;
  ending: boolean;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionFrame");
  return ctx;
}

export type SectionState<S extends RecordSection> =
  | { state: "loading" }
  | { state: "ready"; record: PortalRecord<S> }
  | { state: "error" };

/**
 * Loads one section of the record for a view. Views render only while the
 * session is active and only for a section the patient granted (the frame
 * checks the scope before it mounts them), so a section that was not
 * granted is never asked for, and the data a view holds goes with it when
 * access pauses or ends.
 *
 * `enabled: false` skips the request (a second section a view needs only
 * when its scope was granted). A null record means access closed between
 * polls; the frame is told to check the status at once.
 */
export function useSection<S extends RecordSection>(section: S, enabled = true): SectionState<S> {
  const { refreshStatus } = useSession();
  const [result, setResult] = useState<SectionState<S>>({ state: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    portalApi
      .record(section)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          void refreshStatus();
          return;
        }
        setResult({ state: "ready", record: r });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({ state: "error" });
        if (!(e instanceof PortalApiError) || e.code !== "not_shared") void refreshStatus();
      });
    return () => {
      cancelled = true;
    };
    // Load once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, enabled]);
  return result;
}
