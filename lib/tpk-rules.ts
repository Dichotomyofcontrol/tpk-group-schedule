/** TPK Brewing booking import: the pure part (parsing, rules, matching). Shared by the API and the Assign panel. */
import { ymdInZone, hmInZone } from "./time";

export const TPK_TZ = "America/Los_Angeles";
export const TPK_PLACE = "TPK Brewing";

export type TpkRule = {
  id: string;
  /** "auto" creates the session on import. "suggest" preselects it for Seth to confirm. "ignore" drops marker bookings. */
  mode: "auto" | "suggest" | "ignore";
  /** Game Master named in "Game Master: <name> (4 HR)". Case-insensitive. */
  gm?: string;
  /** 0 Sunday … 6 Saturday, in Pacific time. Empty or absent = any day. */
  weekdays?: number[];
  /** Any of these words in the service name (case-insensitive). */
  contains?: string[];
  /** The whole service name, case-insensitive. */
  exact?: string;
  /** A fixed campaign id (rules saved from the Assign list). */
  cid?: string;
  /** Otherwise the campaign whose name contains this. Two or more hits means suggest, never auto. */
  campaign?: string;
  note?: string;
};

export type TpkConfig = { ownerUid?: string; ownerEmail?: string; rules: TpkRule[]; updatedAt?: string };

export const DEFAULT_RULES: TpkRule[] = [
  { id: "marker-join-leyfarers", mode: "ignore", exact: "Join the Leyfarers", note: "Sign-up marker, not a session." },
  { id: "max-wed-frost", mode: "auto", gm: "Max Hobbs", weekdays: [3], campaign: "Frostmaiden" },
  { id: "max-fri-strahd", mode: "suggest", gm: "Max Hobbs", weekdays: [5], campaign: "Strahd", note: "Usually Strahd on Fridays, but it varies." },
  { id: "sage-weekend-saltmarsh", mode: "auto", gm: "Sage Ricci", weekdays: [6, 0], campaign: "Saltmarsh" },
  { id: "leyfarers", mode: "auto", contains: ["Leyfarer", "TLC"], campaign: "Leyfarer" },
  { id: "beerovia", mode: "auto", contains: ["Beerovia"], campaign: "Beerovia" },
];

export type CampaignLite = { id: string; name: string; tz?: string };

export type Match =
  | { kind: "ignore"; ruleId: string }
  | { kind: "auto"; cid: string; ruleId: string }
  | { kind: "suggest"; cids: string[]; ruleId: string; reason: string }
  | { kind: "none"; reason: string };

export function parseGm(service: string): string | null {
  const m = /game\s*master\s*:\s*([^()]+?)\s*(\(|$)/i.exec(service);
  return m ? m[1].trim() : null;
}

export function weekdayInTz(iso: string, tz = TPK_TZ): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function localDate(iso: string, tz = TPK_TZ): string {
  return ymdInZone(new Date(iso), tz);
}
export function localTime(iso: string, tz = TPK_TZ): string {
  return hmInZone(new Date(iso), tz);
}

/** Stable id from service + start instant, so a re-import with a different offset spelling still lands on the same doc. */
export function bookingKey(service: string, startISO: string): string {
  const ms = new Date(startISO).getTime();
  return `${service.trim().replace(/\s+/g, " ").toLowerCase()}|${new Date(ms).toISOString()}`;
}

/** Hours from "(4 HR)" in the service name, else the payload, else 4. */
export function durationOf(service: string, given?: number): number {
  if (typeof given === "number" && given > 0 && given <= 24) return given;
  const m = /\((\d+(?:\.\d+)?)\s*h(?:ou)?rs?\)/i.exec(service);
  return m ? Number(m[1]) : 4;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

function ruleHits(rule: TpkRule, service: string, startISO: string): boolean {
  const s = norm(service);
  if (rule.exact && s !== norm(rule.exact)) return false;
  if (rule.gm) {
    const gm = parseGm(service);
    if (!gm || norm(gm) !== norm(rule.gm)) return false;
  }
  if (rule.contains?.length && !rule.contains.some((w) => s.includes(norm(w)))) return false;
  if (rule.weekdays?.length && !rule.weekdays.includes(weekdayInTz(startISO))) return false;
  return Boolean(rule.exact || rule.gm || rule.contains?.length);
}

function resolveCampaigns(rule: TpkRule, campaigns: CampaignLite[]): string[] {
  if (rule.cid) return campaigns.some((c) => c.id === rule.cid) ? [rule.cid] : [];
  if (!rule.campaign) return [];
  const want = norm(rule.campaign);
  return campaigns.filter((c) => norm(c.name).includes(want)).map((c) => c.id);
}

/** The one decision: what to do with a booking. Any conflict or ambiguity is never auto. */
export function matchBooking(service: string, startISO: string, rules: TpkRule[], campaigns: CampaignLite[]): Match {
  const hits = rules.filter((r) => ruleHits(r, service, startISO));
  if (!hits.length) return { kind: "none", reason: "No rule matches." };
  const ignore = hits.find((r) => r.mode === "ignore");
  if (ignore) return { kind: "ignore", ruleId: ignore.id };
  // Saved rules (with a fixed cid) win over the name-based defaults when they disagree.
  const fixed = hits.filter((r) => r.cid);
  const pool = fixed.length ? fixed : hits;
  const targets = new Map<string, TpkRule>();
  for (const r of pool) for (const cid of resolveCampaigns(r, campaigns)) if (!targets.has(cid)) targets.set(cid, r);
  if (targets.size === 0) return { kind: "none", reason: "The matching rule's campaign wasn't found." };
  const cids = [...targets.keys()];
  const rule = targets.get(cids[0])!;
  if (cids.length > 1) {
    const rulesHit = new Set(targets.values());
    return { kind: "suggest", cids, ruleId: rule.id, reason: rulesHit.size > 1 ? "Rules disagree." : "More than one campaign fits." };
  }
  if (rule.mode === "suggest" || pool.length > 1 && new Set(pool.map((r) => r.mode)).size > 1) {
    return { kind: "suggest", cids, ruleId: rule.id, reason: rule.note || "Suggested. Confirm it." };
  }
  return { kind: "auto", cid: cids[0], ruleId: rule.id };
}

export type PendingBooking = {
  key: string;
  service: string;
  startISO: string;
  endISO: string;
  location: string;
  status: "pending" | "assigned" | "ignored" | "marker";
  possiblyCancelled?: boolean;
  cid?: string | null;
  sessionId?: string | null;
  linked?: boolean;
  /** Computed per read from the current rules. */
  suggestedCids?: string[];
  reason?: string;
};
