/** Public date-poll links. Pure helpers shared by the member UI, the guest page, and the vote route. */

import { rankedOptions } from "./model";
import { formatDayHeading, partsInZone } from "./time";
import type { Poll, PollVote } from "./types";

/** The table plays at TPK, so every poll option reads in Pacific time. */
export const POLL_DISPLAY_TZ = "America/Los_Angeles";

export const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;
export const POLL_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

export type PollPlayer = {
  id: string;
  displayName: string;
  characterName?: string;
  pending?: boolean;
  /** Set when this seat comes from the campaign roster. */
  rosterId?: string;
  /** Account linked to a roster seat, when they have joined. */
  memberId?: string;
};

export type GuestBallot = { name: string; picks: string[]; seatId?: string };

export type PollRecord = {
  poll: Poll;
  campaignName: string;
  kind?: "oneshot";
  campaignStatus: "active" | "archived";
  members: PollPlayer[];
  /** Roster seats, when the campaign has any. Poll counts and the name picker use these. */
  roster?: PollPlayer[];
};

export type PublicPollOption = {
  id: string;
  dow: string;
  day: string;
  mon: string;
  /** Start only, e.g. "6:00 PM". */
  start: string;
  /** Start and end when the option has an end, e.g. "6:00 – 10:00 PM". */
  time: string;
  yes: number;
  names: string[];
};

export type PublicPollView = {
  id: string;
  cid: string;
  title: string;
  status: "open" | "locked";
  campaignName: string;
  kind?: "oneshot";
  options: PublicPollOption[];
  players: { id: string; name: string; character?: string; taken: boolean }[];
  voted: number;
  memberCount: number;
  quiet: string[];
  guests: number;
  line: string;
  lockedLabel: string | null;
  mine: { name: string; picks: string[] } | null;
  /** Ballots cast from a public link. Names and picks only — never the device token. */
  guestBallots: GuestBallot[];
};

export function pollPublicPath(cid: string, pid: string): string {
  return `/p/${encodeURIComponent(cid)}/${encodeURIComponent(pid)}`;
}

export function validPollId(value: string): boolean {
  return POLL_ID_RE.test(value);
}

export function nameKey(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function voteHasYes(vote: { picks?: Record<string, boolean> } | undefined): boolean {
  return !!vote && Object.values(vote.picks || {}).some(Boolean);
}

export function yesIds(vote: { picks?: Record<string, boolean> } | undefined): string[] {
  if (!vote?.picks) return [];
  return Object.entries(vote.picks).filter(([, on]) => on).map(([id]) => id);
}

function clock(parts: { hour: number; minute: number }): string {
  const ap = parts.hour >= 12 ? "PM" : "AM";
  const h = parts.hour % 12 || 12;
  const m = String(parts.minute).padStart(2, "0");
  return `${h}:${m} ${ap}`;
}

/** Start time, and the end time when the option stores one later than the start. */
export function optionClocks(
  option: { startsAt: string; endsAt?: string | null },
  tz = POLL_DISPLAY_TZ,
): { start: string; time: string } {
  const startDate = new Date(option.startsAt);
  if (Number.isNaN(startDate.getTime())) return { start: "", time: "" };
  const startParts = partsInZone(startDate, tz);
  const start = clock(startParts);
  if (!option.endsAt) return { start, time: start };
  const endDate = new Date(option.endsAt);
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) return { start, time: start };
  const endParts = partsInZone(endDate, tz);
  const end = clock(endParts);
  const sAp = startParts.hour >= 12 ? "PM" : "AM";
  const eAp = endParts.hour >= 12 ? "PM" : "AM";
  if (sAp === eAp) {
    const sh = startParts.hour % 12 || 12;
    const sm = String(startParts.minute).padStart(2, "0");
    return { start, time: `${sh}:${sm} – ${end}` };
  }
  return { start, time: `${start} – ${end}` };
}

export function optionTimeLabel(option: { startsAt: string; endsAt?: string | null }, tz = POLL_DISPLAY_TZ): string {
  return optionClocks(option, tz).time;
}

export function cleanGuestName(raw: unknown): { name: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Enter your name." };
  const name = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Enter your name." };
  if (name.length > 40) return { error: "That name is too long." };
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'\u2019-]*$/u.test(name)) return { error: "Use a name with letters or numbers." };
  return { name };
}

/** Joined accounts and invited roster seats, one row each. A seat already linked to an account is not counted twice. */
export function mergeVoteSeats(members: PollPlayer[], roster: PollPlayer[]): PollPlayer[] {
  const active = members.filter((member) => !member.pending && member.displayName?.trim());
  const used = new Set<string>();
  const seats: PollPlayer[] = [];
  for (const seat of roster) {
    let member = active.find((item) => (seat.memberId && item.id === seat.memberId) || item.id === seat.id);
    if (!member) {
      const key = nameKey(seat.displayName || "");
      const hits = active.filter((item) => !used.has(item.id) && (nameKey(item.displayName || "") === key || (!!item.characterName && nameKey(item.characterName) === key)));
      if (hits.length === 1) member = hits[0];
    }
    if (member) used.add(member.id);
    seats.push(member ? {
      id: member.id,
      displayName: seat.displayName || member.displayName,
      characterName: seat.characterName || member.characterName,
      rosterId: seat.rosterId,
      memberId: member.id,
    } : seat);
  }
  for (const member of active) {
    if (used.has(member.id)) continue;
    seats.push({ id: member.id, displayName: member.displayName, characterName: member.characterName, memberId: member.id });
  }
  const seen = new Set<string>();
  return seats.filter((seat) => {
    if (seen.has(seat.id)) return false;
    seen.add(seat.id);
    return true;
  });
}

export function voteSeats(record: Pick<PollRecord, "members" | "roster">): PollPlayer[] {
  const members = record.members.filter((member) => !member.pending);
  if (!record.roster?.length) return members;
  return mergeVoteSeats(members, record.roster);
}

/** Id the name picker shows. A roster seat uses its roster id; a joined account uses the member id. */
export function pickerSeatId(seat: PollPlayer): string {
  return seat.rosterId || seat.id;
}

function seatFromPicker(seats: PollPlayer[], id: string): PollPlayer | undefined {
  return seats.find((seat) => pickerSeatId(seat) === id)
    || seats.find((seat) => seat.id === id || seat.memberId === id || seat.rosterId === id);
}

export function parseGuestBallot(body: unknown): { token: string; name: string; picks: string[]; rosterId?: string } | { error: string; status: number } {
  if (!body || typeof body !== "object") return { error: "Send JSON.", status: 400 };
  const raw = body as { token?: unknown; name?: unknown; picks?: unknown; rosterId?: unknown };
  if (typeof raw.token !== "string" || !GUEST_TOKEN_RE.test(raw.token)) {
    return { error: "This device couldn't start a ballot. Refresh and try again.", status: 400 };
  }
  const named = cleanGuestName(raw.name);
  if ("error" in named) return { error: named.error, status: 400 };
  if (!Array.isArray(raw.picks) || raw.picks.length < 1) return { error: "Pick at least one date that works.", status: 400 };
  if (raw.picks.length > 24 || raw.picks.some((id) => typeof id !== "string" || id.length < 1 || id.length > 80)) {
    return { error: "One of those dates isn't on this poll.", status: 400 };
  }
  const picks = [...new Set(raw.picks as string[])];
  let rosterId: string | undefined;
  if (raw.rosterId != null && raw.rosterId !== "") {
    if (typeof raw.rosterId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(raw.rosterId)) {
      return { error: "That player isn't on this table.", status: 400 };
    }
    rosterId = raw.rosterId;
  }
  return { token: raw.token, name: named.name, picks, rosterId };
}

const hashCache = new Map<string, string>();

/** SHA-256 prefix. The poll document stores this, never the device token. */
export async function guestTokenHash(token: string): Promise<string> {
  const cached = hashCache.get(token);
  if (cached) return cached;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tpk-guest-v1:${token}`));
  const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  hashCache.set(token, hex);
  return hex;
}

export function namesForOption(poll: Poll, members: PollPlayer[], optionId: string, meId = ""): string[] {
  const names: string[] = [];
  for (const [id, vote] of Object.entries(poll.votes || {})) {
    if (!vote?.picks?.[optionId]) continue;
    if (meId && id === meId) {
      names.push("You");
      continue;
    }
    const member = members.find((m) => m.id === id);
    const raw = vote.guestToken && vote.name
      ? vote.name
      : (member?.displayName || vote.name || member?.characterName || "Guest");
    names.push(raw.trim().split(/\s+/)[0] || "Guest");
  }
  return names;
}

export function memberYesCount(poll: Poll, members: PollPlayer[], optionId: string): number {
  return members.filter((m) => poll.votes?.[m.id]?.picks?.[optionId]).length;
}

export function participationLine(voted: number, total: number, quiet: string[], guests: number): string {
  const who = quiet.length === 0 ? "" : quiet.length === 1 ? ` · ${quiet[0]} hasn't` : ` · ${quiet.slice(0, -1).join(", ")} and ${quiet[quiet.length - 1]} haven't`;
  const extra = guests > 0 ? ` · ${guests} guest${guests === 1 ? "" : "s"}` : "";
  return `${voted} of ${total} voted${who}${extra}`;
}

export function summarizePoll(poll: Poll, members: PollPlayer[], meId = "") {
  const votedMembers = members.filter((m) => voteHasYes(poll.votes?.[m.id]));
  const quiet = members
    .filter((m) => !votedMembers.some((v) => v.id === m.id))
    .map((m) => (m.displayName || m.characterName || "Player").trim().split(/\s+/)[0])
    .filter(Boolean);
  const guests = Object.entries(poll.votes || {}).filter(([id, vote]) => !members.some((m) => m.id === id) && voteHasYes(vote)).length;
  return {
    voted: votedMembers.length,
    total: members.length,
    quiet,
    guests,
    line: participationLine(votedMembers.length, members.length, quiet, guests),
    namesFor(optionId: string) {
      return namesForOption(poll, members, optionId, meId);
    },
  };
}

function activePlayers(members: PollPlayer[]): PollPlayer[] {
  const seen = new Set<string>();
  const list: PollPlayer[] = [];
  for (const member of members) {
    if (member.pending) continue;
    const name = member.displayName?.trim();
    if (!name) continue;
    const key = member.rosterId || nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(member);
  }
  return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function toPublicPoll(record: PollRecord, token: string | null): Promise<PublicPollView> {
  const { poll } = record;
  const members = voteSeats(record);
  const summary = summarizePoll(poll, members);
  const hash = token && GUEST_TOKEN_RE.test(token) ? await guestTokenHash(token) : null;
  let mine: PublicPollView["mine"] = null;
  if (hash) {
    for (const vote of Object.values(poll.votes || {})) {
      if (vote?.guestToken === hash && vote.name) {
        mine = { name: vote.name, picks: yesIds(vote) };
        break;
      }
    }
  }
  const options = rankedOptions(poll, null).map((row) => {
    const when = formatDayHeading(row.option.startsAt, POLL_DISPLAY_TZ);
    const clocks = optionClocks(row.option);
    return {
      id: row.option.id,
      dow: when.dow,
      day: when.day,
      mon: when.mon,
      start: clocks.start,
      time: clocks.time,
      yes: row.yes,
      names: namesForOption(poll, members, row.option.id),
    };
  });
  let lockedLabel: string | null = null;
  if (poll.status === "locked") {
    const chosen = poll.options.find((o) => o.id === poll.chosenOptionId) ?? options[0];
    if (chosen && "dow" in chosen) lockedLabel = `${chosen.dow} ${chosen.day} ${chosen.mon} · ${chosen.time}`;
    else if (chosen) {
      const when = formatDayHeading(chosen.startsAt, POLL_DISPLAY_TZ);
      lockedLabel = `${when.dow} ${when.day} ${when.mon} · ${optionTimeLabel(chosen)}`;
    } else lockedLabel = "Locked";
  }
  const guestBallots: GuestBallot[] = Object.entries(poll.votes || {})
    .filter((entry): entry is [string, PollVote] => !!entry[1]?.guestToken && !!entry[1]?.name && voteHasYes(entry[1]))
    .map(([id, vote]) => ({ name: vote.name!, picks: yesIds(vote), seatId: members.some((seat) => seat.id === id) ? id : undefined }));
  return {
    id: poll.id,
    cid: poll.cid,
    title: poll.title,
    status: poll.status,
    campaignName: record.campaignName,
    kind: record.kind,
    options,
    players: activePlayers(members).map((m) => {
      const vote = poll.votes?.[m.id];
      const taken = voteHasYes(vote) && vote?.guestToken !== hash;
      return {
        id: pickerSeatId(m),
        name: m.displayName.trim(),
        character: m.characterName && nameKey(m.characterName) !== nameKey(m.displayName) ? m.characterName : undefined,
        taken,
      };
    }),
    voted: summary.voted,
    memberCount: summary.total,
    quiet: summary.quiet,
    guests: summary.guests,
    line: summary.line,
    lockedLabel,
    mine,
    guestBallots,
  };
}

export function pollShareCopy(view: Pick<PublicPollView, "title" | "campaignName" | "options">): { title: string; description: string; imageSub: string } {
  const title = `${view.title} · ${view.campaignName}`.slice(0, 90);
  const when = view.options.slice(0, 3).map((o) => `${o.dow} ${o.day} ${o.mon} ${o.start || o.time}`).join(", ");
  const description = `Pick every date that works for ${view.campaignName}.${when ? ` ${when}.` : ""} No account needed.`.replace(/\s+/g, " ").trim().slice(0, 200);
  const imageSub = when ? `${when}. No account needed.` : "Pick every date that works. No account needed.";
  return { title, description, imageSub };
}

const NAME_TAKEN = "Someone already voted as that name. Use the same device to change it, or add a last initial.";
const PLAYER_VOTED = "That player already voted. Sign in to change it.";

function memberMatches(members: PollPlayer[], nk: string): PollPlayer[] {
  const hits = members.filter((m) => !m.pending && (
    nameKey(m.displayName || "") === nk || (!!m.characterName && nameKey(m.characterName) === nk)
  ));
  return [...new Map(hits.map((m) => [m.id, m])).values()];
}

/**
 * One ballot per device token and per name. The same token updates its ballot.
 * A matching player who has not voted is recorded on their member id so the
 * table's "who voted" line includes them. The raw token is never stored.
 */
function alreadyVoted(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "That player";
  return `${first} already voted.`;
}

async function applyRosterVote(
  poll: Poll,
  input: { token: string; name: string; picks: string[]; rosterId?: string },
  seats: PollPlayer[],
  now: Date,
): Promise<{ poll: Poll; edited: boolean } | { error: string; status: number }> {
  const named = cleanGuestName(input.name);
  if ("error" in named) return { error: named.error, status: 400 };
  const hash = await guestTokenHash(input.token);
  const votes: Poll["votes"] = { ...(poll.votes || {}) };
  let ownedKey: string | null = null;
  for (const [id, vote] of Object.entries(votes)) {
    if (vote?.guestToken === hash) { ownedKey = id; break; }
  }
  if (!ownedKey && Object.keys(votes).length >= 200) return { error: "This poll is full.", status: 409 };

  let seat: PollPlayer | undefined;
  if (input.rosterId) {
    seat = seatFromPicker(seats, input.rosterId);
    if (!seat) return { error: "That player isn't on this table.", status: 400 };
  } else {
    const matches = memberMatches(seats, nameKey(named.name));
    if (matches.length > 1) return { error: "A few players share that name. Pick them from the list.", status: 400 };
    if (matches.length === 1) seat = matches[0];
  }

  const desired = seat ? seat.id : `guest:${hash}`;
  const ballotName = seat ? seat.displayName : named.name;
  const existing = votes[desired];
  if (seat && existing && voteHasYes(existing) && existing.guestToken !== hash) {
    return { error: alreadyVoted(ballotName), status: 409 };
  }
  for (const [id, vote] of Object.entries(votes)) {
    if (id === ownedKey || id === desired) continue;
    if (vote?.guestToken && vote.guestToken !== hash && vote.name && nameKey(vote.name) === nameKey(ballotName) && voteHasYes(vote)) {
      return { error: NAME_TAKEN, status: 409 };
    }
  }
  const picks: Record<string, boolean> = {};
  for (const id of input.picks) picks[id] = true;
  const ballot: PollVote = { picks, updatedAt: now.toISOString(), name: ballotName, guestToken: hash };
  if (ownedKey && ownedKey !== desired) delete votes[ownedKey];
  votes[desired] = ballot;
  return { poll: { ...poll, votes }, edited: !!ownedKey };
}

export async function applyGuestVote(
  poll: Poll,
  input: { token: string; name: string; picks: string[]; rosterId?: string },
  members: PollPlayer[],
  now = new Date(),
): Promise<{ poll: Poll; edited: boolean } | { error: string; status: number }> {
  if (poll.status !== "open") return { error: "This poll is locked.", status: 409 };
  if (!GUEST_TOKEN_RE.test(input.token)) return { error: "This device couldn't start a ballot. Refresh and try again.", status: 400 };
  const known = new Set(poll.options.map((o) => o.id));
  if (input.picks.length < 1 || input.picks.some((id) => !known.has(id))) {
    return { error: "One of those dates isn't on this poll.", status: 400 };
  }
  if (members.some((member) => member.rosterId)) return applyRosterVote(poll, input, members, now);
  const named = cleanGuestName(input.name);
  if ("error" in named) return { error: named.error, status: 400 };
  const hash = await guestTokenHash(input.token);
  const votes: Poll["votes"] = { ...(poll.votes || {}) };
  let ownedKey: string | null = null;
  for (const [id, vote] of Object.entries(votes)) {
    if (vote?.guestToken === hash) { ownedKey = id; break; }
  }
  if (!ownedKey && Object.keys(votes).length >= 200) return { error: "This poll is full.", status: 409 };

  const nk = nameKey(named.name);
  for (const [id, vote] of Object.entries(votes)) {
    if (id === ownedKey) continue;
    if (vote?.guestToken && vote.guestToken !== hash && vote.name && nameKey(vote.name) === nk && voteHasYes(vote)) {
      return { error: NAME_TAKEN, status: 409 };
    }
  }

  const matches = memberMatches(members, nk);
  let desired: string;
  if (matches.length > 1) {
    if (!ownedKey) return { error: "A few players share that name. Add a last initial.", status: 400 };
    desired = ownedKey;
  } else if (matches.length === 1) {
    const member = matches[0]!;
    const existing = votes[member.id];
    if (existing && existing.guestToken !== hash && voteHasYes(existing)) {
      return { error: PLAYER_VOTED, status: 409 };
    }
    desired = member.id;
  } else {
    desired = `guest:${hash}`;
  }

  const picks: Record<string, boolean> = {};
  for (const id of input.picks) picks[id] = true;
  const ballot: PollVote = { picks, updatedAt: now.toISOString(), name: named.name, guestToken: hash };
  if (ownedKey && ownedKey !== desired) delete votes[ownedKey];
  votes[desired] = ballot;
  return { poll: { ...poll, votes }, edited: !!ownedKey };
}

/** Copy public-link ballots onto a local poll so the member card can count them. Returns null when nothing new arrived. */
export function withGuestBallots(poll: Poll, members: PollPlayer[], ballots: GuestBallot[]): Poll | null {
  if (!ballots.length) return null;
  const votes: Poll["votes"] = { ...(poll.votes || {}) };
  let changed = false;
  for (const ballot of ballots) {
    const named = cleanGuestName(ballot.name);
    if ("error" in named) continue;
    const picks = ballot.picks.filter((id) => poll.options.some((o) => o.id === id));
    if (!picks.length) continue;
    const nk = nameKey(named.name);
    if (ballot.seatId && (ballot.seatId.startsWith("roster:") || members.some((member) => member.id === ballot.seatId))) {
      if (votes[ballot.seatId] && voteHasYes(votes[ballot.seatId])) continue;
      const pickMap: Record<string, boolean> = {};
      for (const id of picks) pickMap[id] = true;
      votes[ballot.seatId] = { picks: pickMap, updatedAt: new Date().toISOString(), name: named.name };
      changed = true;
      continue;
    }
    const already = Object.entries(votes).some(([id, vote]) => {
      if (vote?.name && nameKey(vote.name) === nk) return true;
      const member = members.find((m) => m.id === id);
      if (!member || !voteHasYes(vote)) return false;
      return nameKey(member.displayName || "") === nk || (!!member.characterName && nameKey(member.characterName) === nk);
    });
    if (already) continue;
    const matches = memberMatches(members, nk);
    const key = matches.length === 1 ? matches[0]!.id : `guest-view:${nk}`;
    if (votes[key] && voteHasYes(votes[key])) continue;
    const pickMap: Record<string, boolean> = {};
    for (const id of picks) pickMap[id] = true;
    votes[key] = { picks: pickMap, updatedAt: new Date().toISOString(), name: named.name };
    changed = true;
  }
  return changed ? { ...poll, votes } : null;
}
