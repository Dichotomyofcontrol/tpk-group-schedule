/**
 * Seth's recorded Almanac stats (Archivist recordings). Server only: this is the
 * one module that reads data/almanac-stats.json. Stats are tied to exact
 * Firestore campaign document ids and handed out only to that campaign's members.
 */
import type { Firestore } from "firebase-admin/firestore";
import raw from "../data/almanac-stats.json";
import type { Award, RecordedPayload } from "./almanac-stats";

if (typeof window !== "undefined") throw new Error("almanac-records.server is server only");

type Moment = Omit<Award, "n">;
type StatsKey = keyof typeof raw.campaigns;

/** Production: Firestore campaign doc id -> stats key. Exact ids only. */
export const LIVE_RECORDED: Readonly<Record<string, StatsKey>> = Object.freeze({
  frostmaiden: "frostmaiden",
  strahd: "strahd",
  "ghosts-of-saltmarsh": "saltmarsh",
});

/** Demo/local data uses its own campaign ids. */
export const DEMO_RECORDED: Readonly<Record<string, StatsKey>> = Object.freeze({
  frostmaiden: "frostmaiden",
  strahd: "strahd",
  saltmarsh: "saltmarsh",
});

/** Story moments cited in the Archivist record, in ceremony order per table. */
const MOMENTS: Moment[] = [
  {
    title: "Coup de Grâce",
    who: "Rosie",
    body: "A crystal-tipped dart to the neck froze Sephek Kaltro solid and ended the campaign's first boss fight. (Rime S3)",
    evidence: "Transcript",
    campaignId: "frostmaiden",
  },
  {
    title: "Bedside Manner",
    who: "Vloskev",
    body: "Emergency surgery on Lysander at a wolf-ringed portcullis, then identified the burgomaster's \"salted meat\" as human thigh. (Strahd S1)",
    evidence: "Transcript",
    campaignId: "strahd",
  },
  {
    title: "Nosebleed Seats",
    who: "Giada",
    body: "Hit Strahd with a psychic burst that drew blood from his nose, in his first appearance. (Strahd S7)",
    evidence: "Archivist handout",
    campaignId: "strahd",
  },
  {
    title: "Hostile Takeover",
    who: "Gor",
    body: "Dominated by an undead spellcaster and turned on his friends, then broke free and knocked it flat. (Saltmarsh S5)",
    evidence: "Archivist handout",
    campaignId: "saltmarsh",
  },
];

/** The payload for the given campaign ids (already membership-checked), rekeyed to those ids. */
export function recordedPayload(cids: string[], map: Readonly<Record<string, StatsKey>>): RecordedPayload {
  const campaigns: RecordedPayload["campaigns"] = {};
  const moments: Moment[] = [];
  for (const cid of cids) {
    if (!Object.prototype.hasOwnProperty.call(map, cid)) continue;
    const key = map[cid];
    campaigns[cid] = raw.campaigns[key];
    for (const moment of MOMENTS) if (moment.campaignId === key) moments.push({ ...moment, campaignId: cid });
  }
  return { recorded: raw.recorded, total: Object.keys(map).length, campaigns, moments };
}

/** Recorded campaign ids where this uid is a real (not pending) member. */
export async function liveMemberCampaigns(db: Firestore, uid: string): Promise<string[]> {
  if (!uid) return [];
  const ids = Object.keys(LIVE_RECORDED);
  const docs = await Promise.all(ids.map((cid) => db.collection("campaigns").doc(cid).collection("members").doc(uid).get()));
  return ids.filter((_, i) => docs[i].exists && docs[i].data()?.pending !== true);
}
