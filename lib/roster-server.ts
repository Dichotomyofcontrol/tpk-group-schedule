/**
 * Roster persistence. Demo memory when Admin is off, Firestore otherwise.
 * Server only.
 */
import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { adminConfigured, adminDb } from "./firebase-admin";
import { USERS, buildDemo } from "./demo-data";
import { summaryDocId } from "./character-summary";
import { omitUndefined } from "./omit";
import {
  addDemoRosterPlayer,
  demoRosterByToken,
  editDemoRosterPlayer,
  listDemoRoster,
  markDemoRosterShared,
  removeDemoRosterPlayer,
  saveDemoRosterPlayer,
} from "./roster-demo";
import {
  applyClaim,
  attachKnownMember,
  buildRosterPlayer,
  markLinkShared,
  parseRosterInput,
  parseStoredRoster,
  patchRosterPlayer,
  rosterDocument,
  rosterFailureMessage,
  rosterNameTaken,
  stripRosterSecrets,
  type ClaimPerson,
  type KnownMember,
  type RosterPlayer,
} from "./roster";
import type { Member } from "./types";

function newId(): string {
  return `rp_${randomBytes(6).toString("base64url")}`;
}

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

function rosterRef(db: Firestore, cid: string, id: string) {
  return db.collection("campaigns").doc(cid).collection("roster").doc(id);
}

async function readLive(db: Firestore, cid: string): Promise<RosterPlayer[]> {
  const snap = await db.collection("campaigns").doc(cid).collection("roster").get();
  const players: RosterPlayer[] = [];
  for (const doc of snap.docs) {
    const player = parseStoredRoster(doc.id, cid, doc.data() || {});
    if (player) players.push(player);
  }
  return players.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

function demoKnownMembers(cid: string): KnownMember[] {
  const seen = new Map<string, KnownMember>();
  for (const user of USERS) {
    for (const member of buildDemo(user.id).members[cid] || []) {
      seen.set(member.id, { id: member.id, email: member.email, displayName: member.displayName, characterName: member.characterName, role: member.role, pending: member.pending });
    }
  }
  return [...seen.values()];
}

async function liveKnownMembers(db: Firestore, cid: string): Promise<KnownMember[]> {
  const snap = await db.collection("campaigns").doc(cid).collection("members").get();
  return snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      email: typeof data.email === "string" ? data.email : undefined,
      displayName: typeof data.displayName === "string" ? data.displayName : undefined,
      characterName: typeof data.characterName === "string" ? data.characterName : undefined,
      pending: data.pending === true,
    };
  });
}

function linkedRoster(players: RosterPlayer[], members: KnownMember[]): RosterPlayer[] {
  return players.map((player) => attachKnownMember(player, members, players));
}

async function persistLinks(cid: string, before: RosterPlayer[], after: RosterPlayer[]): Promise<void> {
  for (const player of after) {
    const prev = before.find((item) => item.id === player.id);
    if (!prev || (prev.memberId === player.memberId && prev.status === player.status)) continue;
    if (!adminConfigured()) saveDemoRosterPlayer(player);
    else await rosterRef(adminDb(), cid, player.id).set(rosterDocument(player));
  }
}

export async function loadRoster(cid: string): Promise<RosterPlayer[]> {
  if (!adminConfigured()) {
    const players = listDemoRoster(cid);
    const linked = linkedRoster(players, demoKnownMembers(cid));
    await persistLinks(cid, players, linked);
    return linked;
  }
  const db = adminDb();
  const players = await readLive(db, cid);
  const linked = linkedRoster(players, await liveKnownMembers(db, cid));
  await persistLinks(cid, players, linked);
  return linked;
}

export async function createRosterPlayer(cid: string, body: unknown): Promise<RosterPlayer | { error: string; status: number }> {
  const parsed = parseRosterInput(body);
  if (!parsed.ok) return { error: parsed.error, status: 400 };
  if (!adminConfigured()) {
    const added = addDemoRosterPlayer(cid, parsed.value, newId(), newToken());
    if ("error" in added) return { error: added.error, status: added.error === "This roster is full." ? 409 : 400 };
    const linked = attachKnownMember(added, demoKnownMembers(cid), listDemoRoster(cid));
    if (linked.memberId !== added.memberId || linked.status !== added.status) saveDemoRosterPlayer(linked);
    return linked;
  }
  const db = adminDb();
  const campaign = await db.collection("campaigns").doc(cid).get();
  if (!campaign.exists || campaign.data()?.status === "archived") return { error: "That campaign isn't open.", status: 404 };
  const existing = await readLive(db, cid);
  if (existing.length >= 40) return { error: "This roster is full.", status: 409 };
  if (rosterNameTaken(existing, parsed.value.name)) return { error: "That name is already on the roster.", status: 400 };
  const built = buildRosterPlayer(cid, parsed.value, newId(), newToken());
  const player = attachKnownMember(built, await liveKnownMembers(db, cid), existing);
  try {
    await rosterRef(db, cid, player.id).set(rosterDocument(player));
    await db.collection("rosterTokens").doc(player.token).set({ cid, id: player.id });
  } catch (error) {
    return { error: rosterFailureMessage(error), status: 500 };
  }
  await ensurePendingSummary(cid, player.characterName);
  return player;
}

export async function updateRosterPlayer(cid: string, id: string, body: unknown): Promise<RosterPlayer | { error: string; status: number }> {
  const parsed = parseRosterInput(body);
  if (!parsed.ok) return { error: parsed.error, status: 400 };
  if (!adminConfigured()) {
    const edited = editDemoRosterPlayer(cid, id, parsed.value);
    if ("error" in edited) return { error: edited.error, status: edited.error === "That player isn't on the roster." ? 404 : 400 };
    return edited;
  }
  const db = adminDb();
  const ref = rosterRef(db, cid, id);
  const snap = await ref.get();
  const current = snap.exists ? parseStoredRoster(id, cid, snap.data() || {}) : null;
  if (!current) return { error: "That player isn't on the roster.", status: 404 };
  const existing = await readLive(db, cid);
  if (rosterNameTaken(existing, parsed.value.name, id)) return { error: "That name is already on the roster.", status: 400 };
  const player = attachKnownMember(patchRosterPlayer(current, parsed.value), await liveKnownMembers(db, cid), existing);
  try {
    await ref.set(rosterDocument(player));
  } catch (error) {
    return { error: rosterFailureMessage(error), status: 500 };
  }
  await ensurePendingSummary(cid, player.characterName);
  return player;
}

export async function shareRosterLink(cid: string, id: string, now = new Date()): Promise<RosterPlayer | { error: string; status: number }> {
  if (!adminConfigured()) {
    const shared = markDemoRosterShared(cid, id, now);
    if ("error" in shared) return { error: shared.error, status: 404 };
    return shared;
  }
  const db = adminDb();
  const ref = rosterRef(db, cid, id);
  const snap = await ref.get();
  const current = snap.exists ? parseStoredRoster(id, cid, snap.data() || {}) : null;
  if (!current) return { error: "That player isn't on the roster.", status: 404 };
  const player = markLinkShared(current, now);
  try {
    await ref.set(rosterDocument(player));
  } catch (error) {
    return { error: rosterFailureMessage(error), status: 500 };
  }
  return player;
}

export async function deleteRosterPlayer(cid: string, id: string): Promise<{ ok: true } | { error: string; status: number }> {
  if (!adminConfigured()) {
    return removeDemoRosterPlayer(cid, id) ? { ok: true } : { error: "That player isn't on the roster.", status: 404 };
  }
  const db = adminDb();
  const ref = rosterRef(db, cid, id);
  const snap = await ref.get();
  const current = snap.exists ? parseStoredRoster(id, cid, snap.data() || {}) : null;
  if (!current) return { error: "That player isn't on the roster.", status: 404 };
  await ref.delete();
  await db.collection("rosterTokens").doc(current.token).delete().catch(() => undefined);
  return { ok: true };
}

export type SeatPreview = {
  token: string;
  cid: string;
  campaignName: string;
  name: string;
  characterName?: string;
  status: RosterPlayer["status"];
  claimed: boolean;
  mine: boolean;
};

async function playerByToken(token: string): Promise<{ player: RosterPlayer; campaignName: string } | null> {
  if (!adminConfigured()) {
    const player = demoRosterByToken(token);
    if (!player) return null;
    const campaign = buildDemo("seth").campaigns.find((item) => item.id === player.cid);
    if (!campaign || campaign.status === "archived") return null;
    return { player, campaignName: campaign.name };
  }
  const db = adminDb();
  const lookup = await db.collection("rosterTokens").doc(token).get();
  const hit = lookup.data() as { cid?: string; id?: string } | undefined;
  if (!hit?.cid || !hit.id) return null;
  const [campaignSnap, playerSnap] = await Promise.all([
    db.collection("campaigns").doc(hit.cid).get(),
    rosterRef(db, hit.cid, hit.id).get(),
  ]);
  if (!campaignSnap.exists || campaignSnap.data()?.status === "archived" || !playerSnap.exists) return null;
  const player = parseStoredRoster(hit.id, hit.cid, playerSnap.data() || {});
  if (!player || player.token !== token) return null;
  return { player, campaignName: String(campaignSnap.data()?.name || "Campaign") };
}

export async function previewSeat(token: string, viewerId = ""): Promise<SeatPreview | null> {
  const found = await playerByToken(token);
  if (!found) return null;
  return {
    token,
    cid: found.player.cid,
    campaignName: found.campaignName,
    name: found.player.name,
    characterName: found.player.characterName,
    status: found.player.status,
    claimed: !!found.player.memberId,
    mine: !!viewerId && found.player.memberId === viewerId,
  };
}

export async function claimRosterSeat(token: string, person: ClaimPerson): Promise<
  | { ok: true; player: RosterPlayer; member: Member | null; created: boolean; linked: boolean; already: boolean; campaignName: string }
  | { ok: false; status: number; error: string }
> {
  const found = await playerByToken(token);
  if (!found) return { ok: false, status: 404, error: "This seat isn't open." };
  if (!adminConfigured()) {
    const roster = listDemoRoster(found.player.cid);
    const members = buildDemo(person.id).members[found.player.cid] || [];
    const result = applyClaim(found.player, roster, members, person);
    if (!result.ok) return result;
    saveDemoRosterPlayer(result.player);
    return { ...result, campaignName: found.campaignName };
  }
  const db = adminDb();
  const memberSnap = await db.collection("campaigns").doc(found.player.cid).collection("members").get();
  const members = memberSnap.docs.map((doc) => ({ id: doc.id }));
  const roster = await readLive(db, found.player.cid);
  const current = roster.find((player) => player.id === found.player.id) || found.player;
  const result = applyClaim(current, roster, members, person);
  if (!result.ok) return result;
  await rosterRef(db, current.cid, current.id).set(rosterDocument(result.player));
  if (result.member) {
    await db.collection("campaigns").doc(current.cid).collection("members").doc(person.id).set(omitUndefined(result.member));
  }
  await ensurePendingSummary(current.cid, result.player.characterName || result.member?.characterName);
  return { ...result, campaignName: found.campaignName };
}

/** Open a pending summary doc if this character does not have one yet. Never writes prose. */
async function ensurePendingSummary(cid: string, name?: string) {
  const clean = name?.trim();
  if (!clean || !adminConfigured()) return;
  try {
    const ref = adminDb().collection("campaigns").doc(cid).collection("characterSummaries").doc(summaryDocId(clean));
    const snap = await ref.get();
    if (snap.exists) return;
    await ref.set({ name: clean, status: "pending", updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("character summary pending", error instanceof Error ? error.message : "unknown");
  }
}

export function rosterForClient(players: RosterPlayer[], staff: boolean): RosterPlayer[] {
  return staff ? players.map((player) => ({ ...player })) : players.map(stripRosterSecrets);
}

export function demoStaff(cid: string, personaId: string): boolean {
  if (!personaId) return false;
  const member = (buildDemo(personaId).members[cid] || []).find((item) => item.id === personaId);
  return member?.role === "organizer" || member?.role === "coorganizer";
}

export function demoMember(cid: string, personaId: string): boolean {
  if (!personaId) return false;
  return (buildDemo(personaId).members[cid] || []).some((item) => item.id === personaId);
}
