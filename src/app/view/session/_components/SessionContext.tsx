"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SessionNotes, SaveState } from "@/components/portal/SessionNotesPanel";
import { portalApi, type Patient, type PortalRecord, type PortalStatus, type RecordSection } from "../../_lib/api";

export type SessionContextValue = {
  status: PortalStatus;
  /** Milliseconds to add to Date.now() for the database clock. */
  offset: number;
  patient: Patient | null;
  setPatient: (p: Patient) => void;
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

/**
 * Loads one section of the record. Pages only render while the session is
 * active (SessionFrame unmounts them otherwise), so the data they hold goes
 * with them when access pauses or ends.
 *
 * Returns undefined while loading. A null record means access closed between
 * polls; the frame is told to check the status at once.
 */
export function useSectionRecord(section: RecordSection): PortalRecord | undefined {
  const { setPatient, refreshStatus } = useSession();
  const [record, setRecord] = useState<PortalRecord | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    portalApi
      .record(section)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          void refreshStatus();
          return;
        }
        setRecord(r);
        setPatient(r.patient);
      })
      .catch(() => {
        if (!cancelled) void refreshStatus();
      });
    return () => {
      cancelled = true;
    };
    // Load once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
  return record;
}
