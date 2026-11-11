import { BLOOD_TYPES } from "./types";

/** Select options shared by the sign-up steps and the edit forms. */

export const BLOOD_TYPE_OPTIONS = [
  { value: "", label: "Not known" },
  ...BLOOD_TYPES.map((b) => ({ value: b, label: b })),
];

export const CONDITION_STATUS_OPTIONS = [
  { value: "ongoing", label: "Ongoing" },
  { value: "managed", label: "Managed" },
  { value: "resolved", label: "Resolved" },
];

export const CARE_KIND_OPTIONS = [
  { value: "gp", label: "GP" },
  { value: "specialist", label: "Specialist" },
  { value: "pharmacy", label: "Pharmacy" },
];
