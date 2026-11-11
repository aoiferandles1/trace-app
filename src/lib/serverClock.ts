/**
 * The database's clock, as seen from the patient's browser.
 *
 * Countdowns run from timestamps the database gives (expires_at,
 * code_expires_at). A phone whose clock is wrong would count down from the
 * wrong "now", so every Supabase response's Date header (which Supabase
 * exposes to the browser) is used to measure how far this device's clock is
 * from the server's. No database change is needed.
 *
 * The Date header has one-second resolution and the response takes time to
 * arrive, so each response only says the offset lies in a range:
 *   server time when the response was made is in [D, D + 1s)
 *   local time when it was made is in [sent, received]
 * Ranges from several responses are intersected. While 0 is inside the range
 * the device clock is treated as right and nothing changes, so a phone with
 * a correct clock never sees its countdown jump. Otherwise the middle of the
 * range is used. If a new range does not overlap (the device clock was
 * changed), it starts again from that response.
 *
 * The database still decides every state; this only moves the numbers shown.
 */

let lo = -Infinity;
let hi = Infinity;
let offset = 0;

/** Responses slower than this say too little to be worth using. */
const MAX_ROUND_TRIP_MS = 10_000;

export function noteServerDate(header: string | null, sentAt: number, receivedAt: number): void {
  if (!header) return;
  const serverSeconds = Date.parse(header);
  if (!Number.isFinite(serverSeconds) || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return;
  const sampleLo = serverSeconds - receivedAt;
  const sampleHi = serverSeconds + 1000 - sentAt;
  const nextLo = Math.max(lo, sampleLo);
  const nextHi = Math.min(hi, sampleHi);
  if (nextLo > nextHi) {
    lo = sampleLo;
    hi = sampleHi;
  } else {
    lo = nextLo;
    hi = nextHi;
  }
  offset = lo <= 0 && 0 <= hi ? 0 : Math.round((lo + hi) / 2);
}

/** Milliseconds to add to Date.now() for the database's time (0 when this clock looks right). */
export function serverOffset(): number {
  return offset;
}

/** Now, by the database's clock. */
export function serverNow(): number {
  return Date.now() + offset;
}

/** A fetch for the Supabase client that measures the clock on every response. */
export const clockedFetch: typeof fetch = async (input, init) => {
  const sentAt = Date.now();
  const res = await fetch(input, init);
  noteServerDate(res.headers.get("date"), sentAt, Date.now());
  return res;
};
