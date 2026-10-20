import { addDaysYmd, addMonthsYmd, ymdInZone, zonedTimeToUtc } from "./time";

export type WeekCadence = {
  interval: number;
  weekday: number;
  startTime: string;
  durationMin: number;
  tz: string;
  anchorDate: string;
};

/**
 * Local dates (YYYY-MM-DD) of a weekly cadence.
 * `dir` walks forward from the anchor (inclusive) or backward (exclusive of anchor
 * when the caller already includes it).
 * Skipping or moving one occurrence is NOT this function's job — it only names the slots.
 */
export function cadenceDates(cadence: WeekCadence, fromYmd: string, untilYmd: string, cap = 400): string[] {
  const interval = Math.max(1, Math.floor(cadence.interval || 1));
  const step = interval * 7;
  // Walk the anchor onto the requested weekday, then step.
  let cursor = cadence.anchorDate;
  // Move cursor backward until it is <= from, staying on the lattice.
  // The anchor is already on the right weekday by contract; if not, nudge it.
  const anchorDow = weekdayOfYmd(cursor);
  const delta = (cadence.weekday - anchorDow + 7) % 7;
  if (delta) cursor = addDaysYmd(cursor, delta);

  while (cursor > fromYmd) {
    const prev = addDaysYmd(cursor, -step);
    if (prev >= cursor) break;
    cursor = prev;
    if (cursor < "1970-01-01") break;
  }
  const out: string[] = [];
  while (cursor <= untilYmd && out.length < cap) {
    if (cursor >= fromYmd) out.push(cursor);
    cursor = addDaysYmd(cursor, step);
  }
  return out;
}

/** Weekday of a YYYY-MM-DD, from the civil date itself (not a time zone). */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function horizonEnd(now: Date, tz: string, months: number): string {
  return addMonthsYmd(ymdInZone(now, tz), Math.max(1, months));
}

export function occurrenceInstant(ymd: string, cadence: WeekCadence): { startsAt: string; endsAt: string } {
  const start = zonedTimeToUtc(ymd, cadence.startTime, cadence.tz);
  const end = new Date(start.getTime() + cadence.durationMin * 60_000);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
