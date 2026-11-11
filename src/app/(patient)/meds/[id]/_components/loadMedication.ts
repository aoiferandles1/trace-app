import { loadSection, type RecordMedication } from "@/lib/patient/record";
import { isUuid } from "@/lib/patient/types";

/** One medication in the redesigned shape (my_record "medications"), or null if it isn't the patient's. */
export async function loadMedication(id: string): Promise<RecordMedication | null> {
  if (!isUuid(id)) return null;
  const { data } = await loadSection("medications");
  return [...data.current, ...data.past].find((m) => m.id === id) ?? null;
}
