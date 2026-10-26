import { campaignAwards, groupTotals, recordedCampaign, recordedKey, speakerName, type Award } from "./almanac-stats";
import { almanacSpreads, campaignsInAlmanac } from "./almanac";
import type { AppState } from "./types";

const NAME = (value: string | undefined | null) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const first = (value: string) => NAME(value).split(" ")[0] ?? "";

export type MySeat = {
  cid: string;
  campaign: string;
  /** Character played, or null when this person runs the table. */
  character: string | null;
  gm: boolean;
  /** Percent of player talk (players) or of all talk (GM), from speaker-labeled sessions. */
  share?: number;
  /** 1-based rank among players by words spoken. */
  rank?: number;
  of?: number;
  nat20?: number;
  nat1?: number;
};

export type ForYou = {
  totals: { sessions: number; hours: number; wordsLabel: string; campaigns: number } | null;
  /** Nights and hours played in this app, across every joined table. */
  played: { nights: number; hours: number };
  seats: MySeat[];
  streak: { count: number; campaign: string } | null;
  longest: { title: string; date: string; hours: number; campaign: string } | null;
  mostActive: { campaign: string; sessions: number; hours: number } | null;
  next: { cid: string; sid: string; title: string; startsAt: string; tz: string; campaign: string } | null;
  deaths: { name: string; line: string; returned: boolean; campaign: string; cid: string }[];
  awards: (Award & { campaign: string })[];
};

type Talker = { label: string; words: number };

/** The recording's speaker label for this person: their sheet (by email), their seat's character, a unique first-name match, then the GM seat. */
function myLabel(talkers: Talker[], opts: { characters: string[]; displayName: string; gm: boolean }): { label: string; gm: boolean } | null {
  const pcs = talkers.filter((t) => !t.label.includes("GM"));
  for (const character of opts.characters) {
    const hit = pcs.find((t) => NAME(speakerName(t.label)) === NAME(character));
    if (hit) return { label: hit.label, gm: false };
  }
  const byFirst = pcs.filter((t) => first(t.label) === first(opts.displayName));
  if (first(opts.displayName) && byFirst.length === 1) return { label: byFirst[0].label, gm: false };
  if (opts.gm) {
    const gmLabel = talkers.find((t) => t.label.includes("GM"));
    if (gmLabel) return { label: gmLabel.label, gm: true };
  }
  return null;
}

export function forYou(state: AppState, now = new Date()): ForYou {
  const me = state.me;
  const campaigns = campaignsInAlmanac(state, me.id);
  const spreads = almanacSpreads(state, me.id, now);
  const seats: MySeat[] = [];
  const deaths: ForYou["deaths"] = [];
  const awards: ForYou["awards"] = [];
  const keys: string[] = [];
  const mine = new Set<string>();

  for (const campaign of campaigns) {
    const member = (state.members[campaign.id] ?? []).find((row) => row.id === me.id);
    if (!member) continue;
    const gm = member.role === "organizer" && member.tags.includes("dm");
    const sheets = (campaign.characters ?? [])
      .filter((sheet) => sheet.ownerEmail && NAME(sheet.ownerEmail) === NAME(me.email))
      .map((sheet) => sheet.name);
    const characters = [...sheets, member.characterName ?? ""].filter(Boolean);
    const named = characters.filter((name) => NAME(name) !== NAME(member.displayName) || (campaign.characters ?? []).some((sheet) => NAME(sheet.name) === NAME(name)));
    const key = recordedKey(campaign);
    const row = key ? recordedCampaign(key) : null;
    if (!row || !key) {
      if (named[0]) seats.push({ cid: campaign.id, campaign: campaign.name, character: named[0], gm: false });
      else if (member.tags.includes("dm")) seats.push({ cid: campaign.id, campaign: campaign.name, character: null, gm: true });
      continue;
    }
    keys.push(key);
    const hit = myLabel(row.talkers, { characters, displayName: member.displayName || me.displayName, gm: gm || member.tags.includes("dm") });
    const character = hit && !hit.gm ? speakerName(hit.label) : named[0] ?? null;
    const seat: MySeat = { cid: campaign.id, campaign: campaign.name, character: hit?.gm ? null : character, gm: Boolean(hit?.gm) };
    if (hit) {
      const pool = hit.gm ? row.talkers : row.talkers.filter((t) => !t.label.includes("GM"));
      const total = pool.reduce((sum, t) => sum + t.words, 0) || 1;
      const mineWords = row.talkers.find((t) => t.label === hit.label)?.words ?? 0;
      seat.share = Math.round((mineWords / total) * 100);
      if (!hit.gm) {
        seat.rank = pool.findIndex((t) => t.label === hit.label) + 1;
        seat.of = pool.length;
      }
      const n20 = row.nat20By.find((r) => r.label === hit.label)?.count;
      const n1 = row.nat1By.find((r) => r.label === hit.label)?.count;
      if (n20) seat.nat20 = n20;
      if (n1) seat.nat1 = n1;
    }
    if (seat.character || seat.gm) seats.push(seat);
    const names = new Set([seat.character, ...characters].filter(Boolean).map((n) => NAME(n)));
    for (const death of row.deaths) if (names.has(NAME(death.name))) deaths.push({ ...death, campaign: campaign.name, cid: key });
    for (const award of campaignAwards(key)) {
      const who = NAME(award.who);
      if ([...names].some((n) => who === n || who.startsWith(`${n} (`)) || (seat.gm && who.includes(NAME(row.short)))) {
        if (!mine.has(award.title)) { mine.add(award.title); awards.push({ ...award, campaign: campaign.name }); }
      }
    }
  }

  const totals = groupTotals(keys);
  const rows = keys.map((key) => recordedCampaign(key)!).filter(Boolean);
  const nameOf = (key: string) => campaigns.find((c) => recordedKey(c) === key)?.name ?? recordedCampaign(key)?.name ?? key;
  const longestRow = rows.reduce<typeof rows[number] | null>((best, row) => (!best || row.longest.hours > best.longest.hours ? row : best), null);
  const activeRow = rows.reduce<typeof rows[number] | null>((best, row) => (!best || row.sessions > best.sessions ? row : best), null);
  const streakSpread = spreads.reduce<typeof spreads[number] | null>((best, s) => (s.streak > (best?.streak ?? 0) ? s : best), null);
  const upcoming = spreads.filter((s) => s.next).sort((a, b) => a.next!.startsAt.localeCompare(b.next!.startsAt))[0];

  return {
    totals: totals ? { sessions: totals.sessions, hours: totals.hours, wordsLabel: totals.wordsLabel, campaigns: totals.campaigns } : null,
    played: { nights: spreads.reduce((s, x) => s + x.played, 0), hours: spreads.reduce((s, x) => s + x.hours, 0) },
    seats,
    streak: streakSpread && streakSpread.streak > 1 ? { count: streakSpread.streak, campaign: streakSpread.name } : null,
    longest: longestRow ? { ...longestRow.longest, campaign: nameOf(longestRow.id) } : null,
    mostActive: activeRow && rows.length > 1 ? { campaign: nameOf(activeRow.id), sessions: activeRow.sessions, hours: Math.round(activeRow.hours) } : null,
    next: upcoming?.next ? { cid: upcoming.id, sid: upcoming.next.id, title: upcoming.next.title, startsAt: upcoming.next.startsAt, tz: upcoming.next.tz, campaign: upcoming.name } : null,
    deaths,
    awards,
  };
}
