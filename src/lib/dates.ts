/**
 * Dates for the patient app. The database decides "today" in Irish time
 * (supabase/README.md, "Time"), so every date the app shows or compares is
 * read in Europe/Dublin too, whatever the browser's own time zone is.
 */

export const TZ = "Europe/Dublin";

type Parts = { year: number; month: number; day: number; hour: number; minute: number };

function partsIn(date: Date): Parts {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-01-12": the calendar day in Ireland for this instant. */
export function dayKey(date: Date | string = new Date()): string {
  const p = partsIn(typeof date === "string" ? new Date(date) : date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "09:30": the wall-clock time in Ireland for this instant. */
export function timeKey(date: Date | string): string {
  const p = partsIn(typeof date === "string" ? new Date(date) : date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Turns a date ("2026-01-12") and time ("09:30") typed in Irish time into an
 * ISO timestamp in UTC, handling summer time.
 */
export function dublinToIso(day: string, time = "09:00"): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}

/** Whole days from today (Ireland) to a "YYYY-MM-DD" date. Negative if past. */
export function daysUntil(day: string, from: Date = new Date()): number {
  const [y, m, d] = day.split("-").map(Number);
  const [ty, tm, td] = dayKey(from).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/** Adds days to a "YYYY-MM-DD" date. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function fmt(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone: TZ, ...options }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

/** A "YYYY-MM-DD" date column read as a calendar day (no time zone shift). */
function fromDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "5 JAN 2026" (timeline). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayParts(iso: string) {
  const [y, m, d] = dayKey(iso).split("-").map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function formatTimelineDate(iso: string): string {
  const { y, m, d } = dayParts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "5 Jan" this year, "5 Jan 2025" in any other (Home's Recent, Record, Share history). */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const { y, m, d } = dayParts(iso);
  const thisYear = Number(dayKey(now).slice(0, 4));
  return y === thisYear ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Wed 14 Jan" (Home's Upcoming card). */
export function formatWeekdayDate(iso: string): string {
  const { m, d, weekday } = dayParts(iso);
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

/** "9:30am". */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/[\s.]/g, "")
    .toLowerCase();
}

/** "Monday 12 Jan 2026" (Home's header). */
export function formatHeaderDate(date: Date = new Date()): string {
  const weekday = fmt(date, { weekday: "long" });
  return `${weekday} ${formatTimelineDate(date.toISOString())}`;
}

/** "Monday 12 January 2026, 9:30am" (entry detail). */
export function formatLongDateTime(iso: string): string {
  return `${fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(",", "")}, ${formatTime(iso)}`;
}

/** "12 March 1991" for a date column. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    fromDay(day),
  );
}

/** The year of a date column, as a number. */
export function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

/** The year in Ireland of a timestamp. */
export function yearOfIso(iso: string): number {
  return Number(dayKey(iso).slice(0, 4));
}

/** "Good morning" / "Good afternoon" / "Good evening" for the local hour. */
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
