/**
 * Campaign roster seats. A seat is a player the organizer adds before that
 * person has an account. The personal link claims the seat; polls count seats.
 * Pure helpers. Routes and the demo memory store call these.
 */
import { omitUndefined } from "./omit";
import { cleanGuestName, nameKey, type PollPlayer } from "./poll-public";
import type { Member, Role } from "./types";

export const ROSTER_MAX = 40;

export type RosterStatus = "invited" | "joined";

export type RosterPlayer = {
  id: string;
  cid: string;
  name: string;
  characterName?: string;
  email?: string;
  phone?: string;
  status: RosterStatus;
  /** Personal claim token. Staff can copy the link again. Not shown on the public poll. */
  token: string;
  /** Account that claimed this seat. */
  memberId?: string;
  /** Set by the server when the organizer copies or shares the claim link. Absent until then. */
  linkSharedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RosterInput = {
  name: string;
  characterName?: string;
  email?: string;
  phone?: string;
};

export type ClaimPerson = { id: string; email: string; displayName: string };

export function rosterJoinPath(token: string): string {
  return `/join/${encodeURIComponent(token)}`;
}

/** Vote key for a seat: the linked account, or a stable roster id before they join. */
export function seatsFromRoster(players: RosterPlayer[]): PollPlayer[] {
  return players.map((player) => ({
    id: player.memberId || `roster:${player.id}`,
    displayName: player.name,
    characterName: player.characterName,
    rosterId: player.id,
    memberId: player.memberId,
  }));
}

export function stripRosterSecrets(player: RosterPlayer): RosterPlayer {
  return {
    id: player.id,
    cid: player.cid,
    name: player.name,
    characterName: player.characterName,
    status: player.status,
    token: "",
    memberId: player.memberId,
    linkSharedAt: player.linkSharedAt,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}

export type SeatLabel = "Joined" | "Link copied" | "Not invited";

/** Joined once claimed. Link copied only after a recorded share. Otherwise the seat exists and nobody was invited. */
export function seatLabel(seat: { status: RosterStatus; linkSharedAt?: string }): SeatLabel {
  if (seat.status === "joined") return "Joined";
  return seat.linkSharedAt ? "Link copied" : "Not invited";
}

export function markLinkShared(player: RosterPlayer, now = new Date()): RosterPlayer {
  const stamp = now.toISOString();
  return { ...player, linkSharedAt: stamp, updatedAt: stamp };
}

function cleanCharacter(raw: unknown): { value?: string } | { error: string } {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return { error: "Character name needs letters or numbers." };
  const name = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!name) return {};
  if (name.length > 60) return { error: "That character name is too long." };
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'\u2019-]*$/u.test(name)) return { error: "Character name needs letters or numbers." };
  return { value: name };
}

function cleanEmail(raw: unknown): { value?: string } | { error: string } {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return { error: "That email doesn't look right." };
  const email = raw.trim().toLowerCase();
  if (!email) return {};
  if (email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };
  return { value: email };
}

function cleanPhone(raw: unknown): { value?: string } | { error: string } {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string") return { error: "That phone number doesn't look right." };
  const phone = raw.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!phone) return {};
  if (phone.length > 24 || !/^[0-9+().\-\s]+$/.test(phone)) return { error: "That phone number doesn't look right." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return { error: "That phone number doesn't look right." };
  return { value: phone };
}

export function parseRosterInput(body: unknown): { ok: true; value: RosterInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Send a name." };
  const raw = body as Record<string, unknown>;
  const named = cleanGuestName(raw.name);
  if ("error" in named) return { ok: false, error: named.error === "Enter your name." ? "Enter a name." : named.error };
  const character = cleanCharacter(raw.characterName);
  if ("error" in character) return { ok: false, error: character.error };
  const email = cleanEmail(raw.email);
  if ("error" in email) return { ok: false, error: email.error };
  const phone = cleanPhone(raw.phone);
  if ("error" in phone) return { ok: false, error: phone.error };
  return {
    ok: true,
    value: {
      name: named.name,
      characterName: character.value,
      email: email.value,
      phone: phone.value,
    },
  };
}

export function buildRosterPlayer(cid: string, input: RosterInput, id: string, token: string, now = new Date()): RosterPlayer {
  const stamp = now.toISOString();
  return {
    id,
    cid,
    name: input.name,
    characterName: input.characterName,
    email: input.email,
    phone: input.phone,
    status: "invited",
    token,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function patchRosterPlayer(player: RosterPlayer, input: RosterInput, now = new Date()): RosterPlayer {
  return {
    ...player,
    name: input.name,
    characterName: input.characterName,
    email: input.email,
    phone: input.phone,
    updatedAt: now.toISOString(),
  };
}

export type ClaimOutcome =
  | { ok: true; player: RosterPlayer; member: Member | null; created: boolean; linked: boolean; already: boolean }
  | { ok: false; status: number; error: string };

/** Link a signed-in account to a seat. An existing member is linked, not duplicated. */
export function applyClaim(player: RosterPlayer, roster: RosterPlayer[], members: { id: string }[], person: ClaimPerson, now = new Date()): ClaimOutcome {
  if (!person.id || !person.email) return { ok: false, status: 401, error: "Sign in first." };
  if (player.memberId && player.memberId === person.id) {
    return { ok: true, player, member: null, created: false, linked: true, already: true };
  }
  if (player.memberId && player.memberId !== person.id) {
    return { ok: false, status: 409, error: "This seat is already claimed." };
  }
  if (roster.some((other) => other.id !== player.id && other.memberId === person.id)) {
    return { ok: false, status: 409, error: "You already have a seat at this table." };
  }
  const next: RosterPlayer = { ...player, status: "joined", memberId: person.id, updatedAt: now.toISOString() };
  const existing = members.some((member) => member.id === person.id);
  if (existing) return { ok: true, player: next, member: null, created: false, linked: true, already: false };
  const member: Member = {
    id: person.id,
    uid: person.id,
    email: person.email,
    displayName: person.displayName.trim() || player.name,
    characterName: player.characterName,
    role: "member",
    tags: [],
    joinedAt: now.toISOString(),
  };
  return { ok: true, player: next, member, created: true, linked: false, already: false };
}

/** Firestore rejects undefined. Optional email, phone, and character must be omitted, not stored as undefined. */
export function rosterDocument(player: RosterPlayer): Record<string, unknown> {
  return omitUndefined({ ...player }) as Record<string, unknown>;
}

export function rosterFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "Couldn't save that player.";
  return clean.slice(0, 240);
}

export async function rosterMutationResult(res: Response | null, fallback: string): Promise<{ player: RosterPlayer } | { error: string }> {
  if (!res) return { error: `${fallback} The request didn't reach the server.` };
  const parsed = await readRosterResponse(res);
  const player = parsed.body.player;
  if (res.ok && player && typeof player === "object" && typeof (player as RosterPlayer).id === "string") {
    return { player: player as RosterPlayer };
  }
  return { error: parsed.error || `${fallback.replace(/\.$/, "")} (${res.status}).` };
}

export async function readRosterResponse(res: Response | null): Promise<{ status: number; body: Record<string, unknown>; error: string }> {
  if (!res) return { status: 0, body: {}, error: "" };
  const raw = await res.text().catch(() => "");
  let body: Record<string, unknown> = {};
  if (raw) {
    try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = {}; }
  }
  const fromBody = typeof body.error === "string" ? body.error.trim() : "";
  const fromText = !fromBody && raw && !raw.trim().startsWith("<") ? raw.replace(/\s+/g, " ").trim().slice(0, 240) : "";
  return { status: res.status, body, error: fromBody || fromText };
}

export type KnownMember = { id: string; email?: string; displayName?: string; characterName?: string; role?: Role; pending?: boolean };

/** Link a seat to the one account that already matches it, so the table does not list that person twice. */
export function attachKnownMember(player: RosterPlayer, members: KnownMember[], roster: RosterPlayer[]): RosterPlayer {
  if (player.memberId) {
    if (!members.some((member) => member.id === player.memberId)) return player;
    return player.status === "joined" ? player : { ...player, status: "joined" };
  }
  const emailHits = player.email
    ? members.filter((member) => member.email && member.email.toLowerCase() === player.email)
    : [];
  const key = nameKey(player.name);
  const nameHits = members.filter((member) => nameKey(member.displayName || "") === key || (!!member.characterName && nameKey(member.characterName) === key));
  const pool = emailHits.length === 1 ? emailHits : nameHits;
  const free = pool.filter((member) => !roster.some((other) => other.id !== player.id && other.memberId === member.id));
  if (free.length !== 1) return player;
  return { ...player, memberId: free[0]!.id, status: "joined" };
}

export type TableSeat = {
  key: string;
  name: string;
  characterName?: string;
  email?: string;
  phone?: string;
  status: RosterStatus;
  role?: Role;
  memberId?: string;
  rosterId?: string;
  token?: string;
  linkSharedAt?: string;
};

/** One row per person: joined accounts, plus invited seats that nobody has claimed. */
export function unifyPlayers(members: KnownMember[], roster: RosterPlayer[]): TableSeat[] {
  const active = members.filter((member) => member.id && !member.pending);
  const usedMembers = new Set<string>();
  const rows: TableSeat[] = [];
  for (const seat of roster) {
    const linked = attachKnownMember(seat, active, roster);
    const member = linked.memberId ? active.find((item) => item.id === linked.memberId) : undefined;
    if (member) usedMembers.add(member.id);
    rows.push({
      key: member?.id || `roster:${seat.id}`,
      name: linked.name || member?.displayName || "Player",
      characterName: linked.characterName || member?.characterName,
      email: linked.email,
      phone: linked.phone,
      status: member || linked.memberId ? "joined" : "invited",
      role: member?.role,
      memberId: member?.id || linked.memberId,
      rosterId: seat.id,
      token: seat.token,
      linkSharedAt: seat.linkSharedAt,
    });
  }
  for (const member of active) {
    if (usedMembers.has(member.id)) continue;
    rows.push({
      key: member.id,
      name: member.displayName || member.characterName || "Player",
      characterName: member.characterName,
      email: member.email,
      status: "joined",
      role: member.role,
      memberId: member.id,
    });
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.key)) return false;
    seen.add(row.key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function rosterNameTaken(roster: RosterPlayer[], name: string, exceptId = ""): boolean {
  const key = nameKey(name);
  return roster.some((player) => player.id !== exceptId && nameKey(player.name) === key);
}

export function parseStoredRoster(id: string, cid: string, data: Record<string, unknown>): RosterPlayer | null {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const token = typeof data.token === "string" ? data.token : "";
  if (!name || !token) return null;
  const status: RosterStatus = data.status === "joined" ? "joined" : "invited";
  return {
    id,
    cid,
    name,
    characterName: typeof data.characterName === "string" && data.characterName.trim() ? data.characterName.trim() : undefined,
    email: typeof data.email === "string" && data.email.trim() ? data.email.trim() : undefined,
    phone: typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : undefined,
    status,
    token,
    memberId: typeof data.memberId === "string" && data.memberId ? data.memberId : undefined,
    linkSharedAt: sharedStamp(data.linkSharedAt),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

function sharedStamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString();
}
