/**
 * "Add to calendar" (F6): a one-event .ics file the phone or computer opens
 * in its own calendar app. Made in the browser; nothing is sent anywhere.
 */

/** Escapes text for an iCalendar value. */
function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}

/** "20261125T093000Z" from an ISO time. */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export type CalendarEvent = {
  title: string;
  /** A timed event: its start (ISO), lasting `minutes`. */
  start?: string;
  minutes?: number;
  /** An all-day event: "YYYY-MM-DD". */
  day?: string;
  location?: string | null;
};

export function icsFor(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trace//Patient app//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@trace`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
  ];
  if (e.day) {
    const d = e.day.replace(/-/g, "");
    const [y, m, dd] = e.day.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10).replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`);
  } else if (e.start) {
    const end = new Date(Date.parse(e.start) + (e.minutes ?? 30) * 60_000).toISOString();
    lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(end)}`);
  }
  lines.push(`SUMMARY:${esc(e.title)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Saves the event as a .ics file. */
export function downloadIcs(e: CalendarEvent, fileName: string) {
  const blob = new Blob([icsFor(e)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
