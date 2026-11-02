/**
 * Deletes the signed-in user's own account. The caller must pass the uid from a
 * verified token. This module never reads a uid from a request body.
 */
import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import { signInCodeDocId } from "./sign-in-code";
import type { TableCharacter } from "./types";

export type NamedCampaign = { id: string; name: string };

export type AccountPlan = {
  blocking: NamedCampaign[];
  deleting: NamedCampaign[];
};

export type CampaignFacts = {
  id: string;
  name: string;
  ownerUid: string;
  /** Member document ids, including this user when they have a row. */
  memberIds: string[];
  organizerIds: string[];
};

export type DeleteResult =
  | { ok: true; deletedCampaigns: string[] }
  | { ok: false; status: number; error: string; blocking?: NamedCampaign[] };

/** Campaigns this person owns or organizes. Other players block deletion. A campaign with nobody else is deleted with the account. */
export function classifyDeletion(uid: string, campaigns: CampaignFacts[]): AccountPlan {
  const blocking: NamedCampaign[] = [];
  const deleting: NamedCampaign[] = [];
  for (const campaign of campaigns) {
    const owns = campaign.ownerUid === uid || campaign.organizerIds.includes(uid);
    if (!owns) continue;
    const others = campaign.memberIds.filter((id) => id !== uid);
    const named = { id: campaign.id, name: campaign.name || campaign.id };
    if (others.length) blocking.push(named);
    else deleting.push(named);
  }
  return { blocking, deleting };
}

type Store = {
  deleteFile(path: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
};

export function bucketStore(bucket: Bucket): Store {
  return {
    async deleteFile(path) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
    async deletePrefix(prefix) {
      await bucket.deleteFiles({ prefix, force: true });
    },
  };
}

function waitlistId(email: string): string {
  return email.replace(/[^a-z0-9]/g, "_").slice(0, 120);
}

function portraitPaths(characters: TableCharacter[] | undefined, email: string): string[] {
  const paths: string[] = [];
  for (const character of characters || []) {
    const path = character.imagePath || "";
    if (!path.startsWith("recaps/avatars/")) continue;
    if ((character.ownerEmail || "").toLowerCase() !== email) continue;
    paths.push(path);
  }
  return paths;
}

function allPortraitPaths(characters: TableCharacter[] | undefined): string[] {
  return (characters || []).map((character) => character.imagePath || "").filter((path) => path.startsWith("recaps/avatars/"));
}

async function campaignFacts(db: Firestore, cid: string, uid: string): Promise<CampaignFacts | null> {
  const ref = db.collection("campaigns").doc(cid);
  const [campaign, members] = await Promise.all([ref.get(), ref.collection("members").get()]);
  if (!campaign.exists) return null;
  const data = campaign.data() || {};
  const memberIds = members.docs.map((doc) => doc.id);
  const organizerIds = members.docs.filter((doc) => doc.get("role") === "organizer").map((doc) => doc.id);
  return {
    id: cid,
    name: typeof data.name === "string" ? data.name : cid,
    ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "",
    memberIds,
    organizerIds,
  };
}

async function involvedCampaignIds(db: Firestore, uid: string, email: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const [byUid, byEmail, owned] = await Promise.all([
    db.collectionGroup("members").where("uid", "==", uid).get(),
    email ? db.collectionGroup("members").where("email", "==", email).get() : Promise.resolve(null),
    db.collection("campaigns").where("ownerUid", "==", uid).get(),
  ]);
  for (const doc of byUid.docs) {
    const cid = doc.ref.parent.parent?.id;
    if (cid && (doc.id === uid || doc.get("uid") === uid)) ids.add(cid);
  }
  if (byEmail) {
    for (const doc of byEmail.docs) {
      const cid = doc.ref.parent.parent?.id;
      if (cid) ids.add(cid);
    }
  }
  for (const doc of owned.docs) ids.add(doc.id);
  return ids;
}

export async function planAccountDeletion(db: Firestore, uid: string, email: string): Promise<AccountPlan> {
  const ids = await involvedCampaignIds(db, uid, email);
  const facts: CampaignFacts[] = [];
  for (const cid of ids) {
    const fact = await campaignFacts(db, cid, uid);
    if (fact) facts.push(fact);
  }
  return classifyDeletion(uid, facts);
}

async function stripVotesAndAttendance(db: Firestore, cid: string, uid: string): Promise<void> {
  const [polls, sessions] = await Promise.all([
    db.collection("campaigns").doc(cid).collection("polls").get(),
    db.collection("campaigns").doc(cid).collection("sessions").get(),
  ]);
  for (const poll of polls.docs) {
    const votes = poll.get("votes");
    if (!votes || typeof votes !== "object" || Array.isArray(votes) || !(uid in (votes as object))) continue;
    const next = { ...(votes as Record<string, unknown>) };
    delete next[uid];
    await poll.ref.update({ votes: next });
  }
  for (const session of sessions.docs) {
    const attendance = session.get("attendance");
    if (Array.isArray(attendance)) {
      const next = attendance.filter((row) => !row || typeof row !== "object" || (row as { uid?: string }).uid !== uid);
      if (next.length !== attendance.length) await session.ref.update({ attendance: next });
    } else if (attendance && typeof attendance === "object" && uid in (attendance as object)) {
      const next = { ...(attendance as Record<string, unknown>) };
      delete next[uid];
      await session.ref.update({ attendance: next });
    }
  }
}

async function deleteOwnSeats(db: Firestore, cid: string, uid: string, email: string): Promise<void> {
  const seats = await db.collection("campaigns").doc(cid).collection("roster").get();
  for (const seat of seats.docs) {
    const memberId = seat.get("memberId");
    const seatEmail = typeof seat.get("email") === "string" ? seat.get("email").toLowerCase() : "";
    if (memberId !== uid && seatEmail !== email) continue;
    const token = seat.get("token");
    if (typeof token === "string" && token) await db.collection("rosterTokens").doc(token).delete().catch(() => undefined);
    await seat.ref.delete();
  }
}

async function deleteOwnMemberDocs(db: Firestore, cid: string, uid: string, email: string): Promise<void> {
  const members = await db.collection("campaigns").doc(cid).collection("members").get();
  for (const doc of members.docs) {
    const docEmail = typeof doc.get("email") === "string" ? doc.get("email").toLowerCase() : "";
    if (doc.id === uid || doc.get("uid") === uid || (email && docEmail === email)) await doc.ref.delete();
  }
}

async function clearOwnPortraits(db: Firestore, store: Store, cid: string, email: string, keep: Set<string>): Promise<void> {
  const ref = db.collection("campaigns").doc(cid);
  const snap = await ref.get();
  const characters = (snap.get("characters") || []) as TableCharacter[];
  const owned = portraitPaths(characters, email);
  if (!owned.length) return;
  const drop = new Set(owned);
  const next = characters.map((character) => {
    if (!character.imagePath || !drop.has(character.imagePath)) return character;
    if ((character.ownerEmail || "").toLowerCase() !== email) return character;
    const { imagePath: _gone, ...rest } = character;
    void _gone;
    return rest;
  });
  await ref.update({ characters: next });
  for (const path of owned) {
    if (!keep.has(path)) await store.deleteFile(path);
  }
}

async function deleteCampaignTree(db: Firestore, store: Store, cid: string): Promise<void> {
  const ref = db.collection("campaigns").doc(cid);
  const snap = await ref.get();
  const characters = (snap.get("characters") || []) as TableCharacter[];
  await store.deletePrefix(`recaps/${cid}/`);
  await store.deletePrefix(`campaigns/${cid}/`);
  await store.deletePrefix(`recaps/avatars/${cid}_`);
  for (const path of allPortraitPaths(characters)) await store.deleteFile(path);
  const legacy = await db.collection("recapFiles").where("cid", "==", cid).get();
  for (const doc of legacy.docs) {
    await store.deleteFile(`recaps/${doc.id}`);
    await doc.ref.delete();
  }
  const invites = await db.collection("invites").where("cid", "==", cid).get();
  for (const doc of invites.docs) await doc.ref.delete();
  const seats = await ref.collection("roster").get();
  for (const seat of seats.docs) {
    const token = seat.get("token");
    if (typeof token === "string" && token) await db.collection("rosterTokens").doc(token).delete().catch(() => undefined);
  }
  await db.recursiveDelete(ref);
}

/** Deletes only `uid`. A blocking campaign stops the whole delete, so nobody else's data is touched. */
export async function deleteOwnAccount(db: Firestore, store: Store, uid: string, email: string): Promise<DeleteResult> {
  const normalized = email.trim().toLowerCase();
  const plan = await planAccountDeletion(db, uid, normalized);
  if (plan.blocking.length) {
    const names = plan.blocking.map((campaign) => campaign.name).join(", ");
    return {
      ok: false,
      status: 409,
      error: `Transfer ${names} before deleting your account. Other players are still on ${plan.blocking.length === 1 ? "that campaign" : "those campaigns"}.`,
      blocking: plan.blocking,
    };
  }
  const userRef = db.collection("users").doc(uid);
  const user = await userRef.get();
  const calToken = user.get("calToken");
  const deleting = new Set(plan.deleting.map((campaign) => campaign.id));
  const involved = await involvedCampaignIds(db, uid, normalized);

  const survivingPortraits = new Set<string>();
  for (const cid of involved) {
    if (deleting.has(cid)) continue;
    const snap = await db.collection("campaigns").doc(cid).get();
    for (const path of allPortraitPaths(snap.get("characters") as TableCharacter[] | undefined)) {
      const characters = (snap.get("characters") || []) as TableCharacter[];
      const own = new Set(portraitPaths(characters, normalized));
      if (!own.has(path)) survivingPortraits.add(path);
    }
  }

  for (const cid of deleting) await deleteCampaignTree(db, store, cid);
  for (const cid of involved) {
    if (deleting.has(cid)) continue;
    await stripVotesAndAttendance(db, cid, uid);
    await deleteOwnSeats(db, cid, uid, normalized);
    await clearOwnPortraits(db, store, cid, normalized, survivingPortraits);
    await deleteOwnMemberDocs(db, cid, uid, normalized);
  }
  if (typeof calToken === "string" && calToken) await db.collection("calTokens").doc(calToken).delete().catch(() => undefined);
  const tokens = await db.collection("calTokens").where("uid", "==", uid).get();
  for (const doc of tokens.docs) await doc.ref.delete();
  if (normalized) {
    await db.collection("signInCodes").doc(signInCodeDocId(normalized)).delete().catch(() => undefined);
    await db.collection("waitlist").doc(waitlistId(normalized)).delete().catch(() => undefined);
  }
  await db.recursiveDelete(userRef);
  return { ok: true, deletedCampaigns: [...deleting] };
}
