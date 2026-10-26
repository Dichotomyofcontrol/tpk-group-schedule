import raw from "../data/almanac-stats.json";

/** One mined campaign. `sessions` is the count; `sessionsList` is every recorded night. */
export type RecordedCampaign = (typeof raw.campaigns)[keyof typeof raw.campaigns] & { id: string };

export type FloorHolder = { name: string; share: number; width: number };

export type Award = {
  /** Stable ceremony number, 01–09, even when a player cannot see every table. */
  n: string;
  title: string;
  who: string;
  body: string;
  evidence: string;
  campaignId: string;
};

export type GroupTotals = {
  sessions: number;
  hours: number;
  wordsLabel: string;
  /** Recorded campaigns included in the totals. */
  campaigns: number;
  full: boolean;
};

const CAMPAIGNS = raw.campaigns as Record<string, (typeof raw.campaigns)[keyof typeof raw.campaigns]>;
const RECORDED_IDS = Object.keys(CAMPAIGNS);

const SMALL = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function recordedCampaign(cid: string): RecordedCampaign | null {
  const row = CAMPAIGNS[cid];
  if (!row) return null;
  return { id: cid, ...row };
}

/** Character inside a speaker label, or the person's name when the label is the GM. */
export function speakerName(label: string): string {
  const character = label.match(/\((.+?)\s*\[/);
  if (character) return character[1].trim();
  const player = label.match(/^(.+?)\s*\(/);
  return (player?.[1] ?? label).trim();
}

/** "Ross (Giago [PC])" reads as Giago (Ross), the way the ceremony names the winner. */
export function openMicName(label: string): string {
  const match = label.match(/^(.+?)\s*\((.+?)\s*\[PC\]\)/);
  if (!match) return speakerName(label);
  const player = match[1].trim().split(/\s+/)[0] || match[1].trim();
  return `${match[2].trim()} (${player})`;
}

export function floorHolders(row: RecordedCampaign): FloorHolder[] {
  const pcs = row.talkers.filter((talker) => !talker.label.includes("GM")).map((talker) => ({
    name: speakerName(talker.label),
    words: talker.words,
  }));
  const top = pcs[0]?.words || 1;
  const total = pcs.reduce((sum, holder) => sum + holder.words, 0) || 1;
  return pcs.map((holder) => ({
    name: holder.name,
    share: Math.round((holder.words / total) * 100),
    width: Math.round((holder.words / top) * 100),
  }));
}

export function byWhom(rows: { label: string; count: number }[]): string {
  return rows.map((row) => `${speakerName(row.label)} ${row.count}`).join(" · ");
}

export function recordDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(month || 1) - 1];
  return `${name} ${day}, ${year}`;
}

export function thousandWords(words: number): number {
  return Math.round(words / 1000);
}

function word(n: number): string {
  return SMALL[n] ?? String(n);
}

function series(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function buildAwards(): Award[] {
  const rime = recordedCampaign("frostmaiden");
  const salt = recordedCampaign("saltmarsh");
  if (!rime || !salt) return [];
  const stayed = rime.deaths.filter((death) => !death.returned).map((death) => death.name);
  const back = rime.deaths.filter((death) => death.returned).map((death) => death.name);
  const top = rime.npcs[0];
  const auril = rime.npcs.find((npc) => npc.name === "Auril") ?? rime.npcs[1];
  const lead = rime.talkers.find((talker) => !talker.label.includes("GM")) ?? salt.talkers.find((talker) => !talker.label.includes("GM"));
  const saltLead = salt.talkers.find((talker) => !talker.label.includes("GM"));
  const ratio = rime.nat1 > 0 ? ` Roughly ${Math.round(rime.nat20 / rime.nat1)} to 1 in the dice's favor.` : "";
  const rows: Omit<Award, "n">[] = [
    {
      title: "The Revolving Door",
      who: `${rime.short} party`,
      body: `${word(rime.deaths.length)} PC deaths in ${rime.sessions} sessions: ${series(rime.deaths.map((death) => death.name))}. ${word(back.length)} of them came back; only ${series(stayed)} stayed down.`,
      evidence: "Canon · session titles",
      campaignId: rime.id,
    },
    {
      title: "Iron Bladder",
      who: rime.longest.title.replace(/^\d+\s*-\s*/, ""),
      body: `${rime.short}, ${recordDate(rime.longest.date)}. The longest recorded session: ${rime.longest.hours} hours.`,
      evidence: "Transcript timestamps",
      campaignId: rime.id,
    },
    {
      title: "Most Wanted",
      who: top?.name ?? "—",
      body: `${top?.count ?? 0} mentions. The missing mountain guide the party can't stop talking about, more than ${auril?.name ?? "the next name"} herself (${auril?.count ?? 0}).`,
      evidence: "Mention count",
      campaignId: rime.id,
    },
    {
      title: "Coup de Grâce",
      who: "Rosie",
      body: "A crystal-tipped dart to the neck froze Sephek Kaltro solid and ended the campaign's first boss fight. (Rime S3)",
      evidence: "Transcript",
      campaignId: rime.id,
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
      campaignId: salt.id,
    },
    {
      title: "The Lucky Table",
      who: rime.short,
      body: `${rime.nat20} "nat 20" call-outs to ${rime.nat1} "nat 1"s.${ratio}`,
      evidence: "Transcript phrase count",
      campaignId: rime.id,
    },
    {
      title: "Open Mic Night",
      who: saltLead ? openMicName(saltLead.label) : lead ? openMicName(lead.label) : "—",
      body: "The largest share of player talk in Saltmarsh's speaker-labeled sessions.",
      evidence: `Speaker-labeled transcripts (${salt.labeledSessions})`,
      campaignId: salt.id,
    },
  ];
  return rows.map((award, index) => ({ ...award, n: String(index + 1).padStart(2, "0") }));
}

/** Awards for the recorded tables this player has joined. */
export function tpkAwards(memberIds: string[]): Award[] {
  const mine = new Set(memberIds);
  return buildAwards().filter((award) => mine.has(award.campaignId));
}

/** Cross-campaign totals for the recorded tables this player has joined. */
export function groupTotals(memberIds: string[]): GroupTotals | null {
  const rows = memberIds.map(recordedCampaign).filter((row): row is RecordedCampaign => !!row);
  if (!rows.length) return null;
  const words = rows.reduce((sum, row) => sum + row.words, 0);
  const millions = Math.round((words / 1e6) * 100) / 100;
  return {
    sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
    hours: Math.round(rows.reduce((sum, row) => sum + row.hours, 0)),
    wordsLabel: `${millions.toFixed(2)}M`,
    campaigns: rows.length,
    full: RECORDED_IDS.every((id) => memberIds.includes(id)),
  };
}

export const RECORDED_SPAN = raw.recorded;

export const RECORDING_NOTE = "Mentions, not rolls: counts of the phrases \"nat 20\" and \"nat 1\" (and spelled-out forms) in machine transcripts. Hours come from transcript end times. Talk shares use only the sessions whose transcripts name the speakers. NPC and place counts are exact-name matches.";
