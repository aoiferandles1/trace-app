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

/** Countries offered on About you and Edit profile. Ireland first: Trace is built for Irish patients. */
export const COUNTRIES = [
  "Ireland",
  "United Kingdom",
  "France",
  "Germany",
  "Italy",
  "Netherlands",
  "Poland",
  "Portugal",
  "Spain",
  "United States",
  "Other",
].map((c) => ({ value: c, label: c }));
