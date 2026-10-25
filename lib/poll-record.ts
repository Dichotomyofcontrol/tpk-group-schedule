/** Load a poll for the public page. Admin SDK in production, the demo table otherwise. */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminConfigured, adminDb } from "./firebase-admin";
import { dedupeMembers } from "./model";
import { demoPollRecord } from "./poll-demo";
import { POLL_DISPLAY_TZ, validPollId, type PollPlayer, type PollRecord } from "./poll-public";
import type { Member, Poll, PollOption } from "./types";

function asOptions(value: unknown): PollOption[] {
  if (!Array.isArray(value)) return [];
  const options: PollOption[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const option = row as PollOption;
    if (typeof option.id !== "string" || typeof option.startsAt !== "string") continue;
    if (Number.isNaN(new Date(option.startsAt).getTime())) continue;
    options.push({
      id: option.id.slice(0, 80),
      startsAt: option.startsAt,
      endsAt: typeof option.endsAt === "string" ? option.endsAt : undefined,
      tz: typeof option.tz === "string" && option.tz ? option.tz : POLL_DISPLAY_TZ,
    });
  }
  return options;
}

export function pollFromData(id: string, cid: string, data: Record<string, unknown>): Poll | null {
  const options = asOptions(data.options);
  if (options.length < 2) return null;
  const votes = data.votes && typeof data.votes === "object" ? data.votes as Poll["votes"] : {};
  return {
    id,
    cid,
    title: String(data.title || "Which night works?").slice(0, 120),
    options,
    status: data.status === "locked" ? "locked" : "open",
    chosenOptionId: typeof data.chosenOptionId === "string" ? data.chosenOptionId : null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    closesAt: typeof data.closesAt === "string" ? data.closesAt : null,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : null,
    votes,
  };
}

function membersFromDocs(docs: QueryDocumentSnapshot[]): PollPlayer[] {
  const list: Member[] = docs.map((doc) => {
    const data = doc.data();
    const role = data.role === "organizer" || data.role === "coorganizer" || data.role === "member" ? data.role : "member";
    return {
      id: doc.id,
      uid: typeof data.uid === "string" ? data.uid : undefined,
      email: typeof data.email === "string" ? data.email : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      characterName: typeof data.characterName === "string" ? data.characterName : undefined,
      role,
      tags: [],
      joinedAt: "",
      pending: data.pending === true,
    };
  });
  return dedupeMembers(list).map((member) => ({
    id: member.id,
    displayName: member.displayName,
    characterName: member.characterName,
    pending: member.pending,
  }));
}

export async function loadPollRecord(cid: string, pid: string): Promise<PollRecord | null> {
  if (!validPollId(cid) || !validPollId(pid)) return null;
  if (!adminConfigured()) return demoPollRecord(cid, pid);
  const db = adminDb();
  const [campaignSnap, pollSnap, membersSnap] = await Promise.all([
    db.collection("campaigns").doc(cid).get(),
    db.collection("campaigns").doc(cid).collection("polls").doc(pid).get(),
    db.collection("campaigns").doc(cid).collection("members").get(),
  ]);
  if (!campaignSnap.exists || !pollSnap.exists) return null;
  const campaign = campaignSnap.data() || {};
  if (campaign.status === "archived" || !campaign.name) return null;
  const poll = pollFromData(pid, cid, pollSnap.data() || {});
  if (!poll) return null;
  return {
    poll,
    campaignName: String(campaign.name).slice(0, 80),
    kind: campaign.kind === "oneshot" ? "oneshot" : undefined,
    campaignStatus: "active",
    members: membersFromDocs(membersSnap.docs),
  };
}
