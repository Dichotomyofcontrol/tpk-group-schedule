/** UTC instants + IANA zones, using Intl so the browser and Node agree. */

const pad = (n: number) => String(n).padStart(2, "0");

export function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: bag.weekday, // Sun, Mon, …
  };
}

/** Wall-clock date + time in an IANA zone → UTC Date. */
export function zonedTimeToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const p = partsInZone(new Date(utcGuess), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(utcGuess - (asUtc - utcGuess));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function ymdInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function hmInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayIndex(short: string): number {
  return WEEKDAYS.indexOf(short);
}

export function weekdayName(index: number, width: "short" | "long" = "long"): string {
  const names = width === "short"
    ? WEEKDAYS
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[index] ?? "";
}

export function formatZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);
}

export function zoneAbbrev(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export function zoneLong(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return name ? `${name}` : timeZone;
  } catch {
    return timeZone;
  }
}

export function formatTime(date: Date, timeZone: string): string {
  return formatZone(date, timeZone, { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(start: Date, end: Date, timeZone: string): string {
  const a = formatTime(start, timeZone);
  const b = formatTime(end, timeZone);
  const abbr = zoneAbbrev(start, timeZone);
  return `${a.replace(/\s?(AM|PM)/, "")} – ${b} ${abbr}`.replace("  ", " ");
}

/** Compact range: "6:30 – 10:30 PM PDT". */
export function formatRangePretty(startIso: string, endIso: string, timeZone: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const abbr = zoneAbbrev(start, timeZone);
  const sParts = partsInZone(start, timeZone);
  const eParts = partsInZone(end, timeZone);
  const sAp = sParts.hour >= 12 ? "PM" : "AM";
  const eAp = eParts.hour >= 12 ? "PM" : "AM";
  const sh = sParts.hour % 12 || 12;
  const eh = eParts.hour % 12 || 12;
  const sm = pad(sParts.minute);
  const em = pad(eParts.minute);
  if (sAp === eAp) return `${sh}:${sm} – ${eh}:${em} ${eAp} ${abbr}`;
  return `${sh}:${sm} ${sAp} – ${eh}:${em} ${eAp} ${abbr}`;
}

export function formatDayHeading(iso: string, timeZone: string): { dow: string; day: string; mon: string } {
  const p = partsInZone(new Date(iso), timeZone);
  const mon = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" })
    .format(new Date(iso))
    .toUpperCase();
  return { dow: p.weekday.toUpperCase(), day: String(p.day), mon };
}

export function formatMonthLabel(iso: string, timeZone: string): string {
  return formatZone(new Date(iso), timeZone, { month: "long", year: "numeric" });
}

export function sameCalendarDay(a: Date, b: Date, timeZone: string): boolean {
  return ymdInZone(a, timeZone) === ymdInZone(b, timeZone);
}

/** Whole calendar days from today (in zone) until the session's local date. */
export function daysUntil(iso: string, timeZone: string, now = new Date()): number {
  const a = ymdInZone(now, timeZone);
  const b = ymdInZone(new Date(iso), timeZone);
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const utcA = Date.UTC(ay, am - 1, ad);
  const utcB = Date.UTC(by, bm - 1, bd);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function relativeWhen(iso: string, timeZone: string, now = new Date()): string {
  const days = daysUntil(iso, timeZone, now);
  if (days < 0) return days === -1 ? "Yesterday" : `${Math.abs(days)} days ago`;
  if (days === 0) {
    const hours = (new Date(iso).getTime() - now.getTime()) / 3_600_000;
    if (hours < 0) return "Earlier today";
    if (hours < 1) return "Starting soon";
    if (hours < 8) return `In ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
    return "Tonight";
  }
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const out = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), day));
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`;
}

export function parseLegacyTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || /^tbd$/i.test(s)) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 8) h += 12; // bare "6:00" at a game table is evening
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

export function parseDurationMinutes(raw: string | undefined, fallback = 240): number {
  if (!raw) return fallback;
  const hrs = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (hrs) return Math.round(Number(hrs[1]) * 60);
  const mins = raw.match(/(\d+)\s*m/i);
  if (mins) return Number(mins[1]);
  return fallback;
}

export const COMMON_ZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "Pacific/Honolulu",
  "Europe/London",
  "UTC",
];

export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}
