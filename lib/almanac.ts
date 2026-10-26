import { recordedCampaign } from "./almanac-stats";
import { membersOf, sessionTitle } from "./model";
import { excerpt, recapPlain } from "./recap";
import { groupStats } from "./stats";
import type { AppState, Campaign, LedgerEntry, Member, Session, TableCharacter } from "./types";
import { worldFor } from "./world";

/** A character counts as former when the campaign keeps a roster and this sheet is not on it, and no seated player uses the name. */
export type Spotlight = {
  name: string;
  /** Class, subclass, and level from the character sheet. Empty when the sheet has none. */
  line: string;
  /** Seated player linked by character name, then by the sheet's owner email. */
  player?: string;
};

export type AlmanacSeat = {
  id: string;
  name: string;
  /** A character name only when it matches a sheet, or when this campaign has no sheets. */
  note?: string;
};

export type AlmanacSpread = {
  id: string;
  name: string;
  archived: boolean;
  system?: string;
  worldWord: string;
  worldPlace: string;
  played: number;
  hours: number;
  streak: number;
  recaps: number;
  partyLevel?: number;
  next: { id: string; title: string; startsAt: string; tz: string; location: string } | null;
  latest: { id: string; title: string; startsAt: string; tz: string; snippet: string } | null;
  previouslyOn?: string;
  party: { name: string; detail?: string }[];
  seats: AlmanacSeat[];
};

export type ChronicleNight = {
  id: string;
  title: string;
  startsAt: string;
  tz: string;
  snippet: string;
  pdf: boolean;
};

export type PlaceNote = { name: string; nights: number };

export type CampaignBook = {
  spread: AlmanacSpread;
  current: Spotlight[];
  former: Spotlight[];
  chronicle: ChronicleNight[];
  /** Played nights with no recap text and no PDF. */
  unwritten: number;
  places: PlaceNote[];
  ledger: LedgerEntry[];
  /** Records this app does not have for the campaign. */
  blanks: Array<"npcs" | "factions" | "ledger" | "places">;
};

const NAME = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function campaignsInAlmanac(state: AppState, uid = state.me.id): Campaign[] {
  const mine = state.campaigns.filter((campaign) => (state.members[campaign.id] ?? []).some((member) => member.id === uid));
  return [...mine.filter((campaign) => campaign.status !== "archived"), ...mine.filter((campaign) => campaign.status === "archived")];
}

export function almanacSpreads(state: AppState, uid = state.me.id, now = new Date()): AlmanacSpread[] {
  return campaignsInAlmanac(state, uid).map((campaign) => spreadFor(state, campaign, uid, now));
}

/** Null when this person is not a member, including archived tables they never joined. */
export function campaignBook(state: AppState, cid: string, uid = state.me.id, now = new Date()): CampaignBook | null {
  const campaign = state.campaigns.find((item) => item.id === cid);
  if (!campaign) return null;
  if (!(state.members[cid] ?? []).some((member) => member.id === uid)) return null;
  const members = membersOf(state, cid);
  const { current, former } = characterSpotlights(campaign, members);
  const nights = playedNights(state, cid, now);
  const chronicle = nights.filter(hasWrittenRecap).map((session) => toNight(state, session));
  const places = placeNotes(campaign, nights);
  const ledger = [...(campaign.ledger ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const recorded = recordedCampaign(campaign.id);
  const blanks: CampaignBook["blanks"] = ["factions"];
  if (!recorded?.npcs.length) blanks.push("npcs");
  if (!ledger.length) blanks.push("ledger");
  if (!places.length && !recorded?.locations.length) blanks.push("places");
  return {
    spread: spreadFor(state, campaign, uid, now),
    current,
    former,
    chronicle,
    unwritten: nights.filter((session) => !hasWrittenRecap(session)).length,
    places,
    ledger,
    blanks,
  };
}

export function characterSpotlights(campaign: Campaign, members: Member[]): { current: Spotlight[]; former: Spotlight[] } {
  const roster = new Set((campaign.roster ?? []).map(NAME).filter(Boolean));
  const hasRoster = roster.size > 0;
  const sheets = campaign.characters ?? [];
  const current: Spotlight[] = [];
  const former: Spotlight[] = [];
  for (const sheet of sheets) {
    const name = sheet.name.trim();
    if (!name) continue;
    const played = members.some((member) => member.characterName && NAME(member.characterName) === NAME(name));
    const onRoster = !hasRoster || roster.has(NAME(name));
    const spot = { name, line: sheetLine(sheet), player: playerFor(sheet, members) };
    if (onRoster || played) current.push(spot);
    else former.push(spot);
  }
  if (hasRoster) {
    const order = (campaign.roster ?? []).map(NAME);
    current.sort((a, b) => order.indexOf(NAME(a.name)) - order.indexOf(NAME(b.name)));
  }
  return { current, former };
}

function spreadFor(state: AppState, campaign: Campaign, uid: string, now: Date): AlmanacSpread {
  const world = worldFor(campaign);
  const sessions = state.sessions.filter((session) => session.cid === campaign.id);
  const stats = groupStats(sessions, now);
  const members = membersOf({ ...state, me: { ...state.me, id: uid } }, campaign.id);
  const { current } = characterSpotlights(campaign, members);
  const nights = playedNights(state, campaign.id, now);
  const written = nights.filter(hasWrittenRecap);
  const latest = written.length ? toNight(state, written[written.length - 1]) : null;
  const nextSession = sessions
    .filter((session) => session.status === "scheduled" && new Date(session.endsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const sheetNames = new Set(current.map((spot) => NAME(spot.name)));
  return {
    id: campaign.id,
    name: campaign.name,
    archived: campaign.status === "archived",
    system: campaign.system?.trim() || undefined,
    worldWord: world.word,
    worldPlace: world.place,
    played: stats.played,
    hours: stats.hours,
    streak: stats.streak,
    recaps: written.length,
    partyLevel: campaign.partyLevel,
    next: nextSession
      ? {
          id: nextSession.id,
          title: sessionTitle(state, nextSession),
          startsAt: nextSession.startsAt,
          tz: nextSession.tz,
          location: nextSession.location,
        }
      : null,
    latest: latest && latest.snippet ? { id: latest.id, title: latest.title, startsAt: latest.startsAt, tz: latest.tz, snippet: latest.snippet } : null,
    previouslyOn: campaign.previouslyOn?.trim() || undefined,
    party: current.map((spot) => ({ name: spot.name, detail: spot.player && NAME(spot.player) !== NAME(spot.name) ? spot.player : spot.line || undefined })),
    seats: members.map((member) => ({
      id: member.id,
      name: member.displayName,
      note: seatNote(member, sheetNames),
    })),
  };
}

function seatNote(member: Member, sheetNames: Set<string>): string | undefined {
  const character = member.characterName?.trim();
  if (character && (sheetNames.size === 0 || sheetNames.has(NAME(character))) && NAME(character) !== NAME(member.displayName)) return character;
  if (member.tags.includes("dm") || member.role === "organizer") return "Runs the table";
  if (member.role === "coorganizer") return "Co-organizer";
  return undefined;
}

function playerFor(sheet: TableCharacter, members: Member[]): string | undefined {
  const byName = members.find((member) => member.characterName && NAME(member.characterName) === NAME(sheet.name));
  if (byName) return byName.displayName;
  const email = sheet.ownerEmail?.trim().toLowerCase();
  const byEmail = email ? members.find((member) => member.email.toLowerCase() === email) : undefined;
  return byEmail?.displayName;
}

function sheetLine(sheet: TableCharacter): string {
  return [sheet.charClass, sheet.subclass, sheet.level ? `level ${sheet.level}` : ""].filter(Boolean).join(" · ");
}

function playedNights(state: AppState, cid: string, now: Date): Session[] {
  return state.sessions
    .filter((session) => session.cid === cid && session.status !== "cancelled" && new Date(session.startsAt).getTime() < now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function hasWrittenRecap(session: Session): boolean {
  return Boolean(recapPlain(session) || session.pdfPath || session.pdfName);
}

function toNight(state: AppState, session: Session): ChronicleNight {
  const plain = recapPlain(session);
  return {
    id: session.id,
    title: sessionTitle(state, session),
    startsAt: session.startsAt,
    tz: session.tz,
    snippet: plain ? excerpt(plain, 180) : "",
    pdf: Boolean(session.pdfPath || session.pdfName),
  };
}

function placeNotes(campaign: Campaign, nights: Session[]): PlaceNote[] {
  const counts = new Map<string, number>();
  for (const session of nights) {
    const name = session.location.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const name of [campaign.cadence?.location, campaign.defaultLocation]) {
    const clean = name?.trim();
    if (clean && !counts.has(clean)) counts.set(clean, 0);
  }
  return [...counts.entries()]
    .map(([name, nightsPlayed]) => ({ name, nights: nightsPlayed }))
    .sort((a, b) => b.nights - a.nights || a.name.localeCompare(b.name));
}
