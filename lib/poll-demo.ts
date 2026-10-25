/** In-memory polls for local demo mode, when Firebase Admin is not configured. */
import { buildDemo } from "./demo-data";
import { POLL_ID_RE, type PollPlayer, type PollRecord } from "./poll-public";
import { seatsFromRoster } from "./roster";
import { listDemoRoster } from "./roster-demo";
import type { Poll } from "./types";

/** Survives the dev server rebuilding a route, so a guest can reload the poll they just voted on. */
const demoGlobals = globalThis as typeof globalThis & { __tpkDemoPolls?: Map<string, PollRecord> };
if (!demoGlobals.__tpkDemoPolls) demoGlobals.__tpkDemoPolls = new Map();
const memory = demoGlobals.__tpkDemoPolls;

function key(cid: string, pid: string): string {
  return `${cid}/${pid}`;
}

function playersOf(list: PollPlayer[]): PollPlayer[] {
  return list.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    characterName: m.characterName,
    pending: m.pending,
  }));
}

function rosterSeats(cid: string): PollPlayer[] {
  const seats = seatsFromRoster(listDemoRoster(cid));
  return seats.length ? seats : [];
}

export function demoPollRecord(cid: string, pid: string): PollRecord | null {
  const saved = memory.get(key(cid, pid));
  const roster = POLL_ID_RE.test(cid) ? rosterSeats(cid) : [];
  if (saved) return { ...structuredClone(saved), roster: roster.length ? roster : undefined };
  if (!POLL_ID_RE.test(cid) || !POLL_ID_RE.test(pid)) return null;
  const state = buildDemo("seth");
  const poll = state.polls.find((item) => item.id === pid && item.cid === cid);
  const campaign = state.campaigns.find((item) => item.id === cid);
  if (!poll || !campaign || campaign.status === "archived") return null;
  return {
    poll: structuredClone(poll),
    campaignName: campaign.name,
    kind: campaign.kind,
    campaignStatus: campaign.status,
    members: playersOf(state.members[cid] || []),
    roster: roster.length ? roster : undefined,
  };
}

export function rememberDemoPoll(record: PollRecord): void {
  memory.set(key(record.poll.cid, record.poll.id), structuredClone(record));
}

export function saveDemoPoll(poll: Poll, record: PollRecord): void {
  memory.set(key(poll.cid, poll.id), structuredClone({ ...record, poll }));
}

export function resetDemoPolls(): void {
  memory.clear();
}

export function parseDemoRegistration(body: unknown): PollRecord | { error: string } {
  if (!body || typeof body !== "object") return { error: "Send JSON." };
  const raw = body as {
    campaignName?: unknown;
    kind?: unknown;
    campaignStatus?: unknown;
    members?: unknown;
    poll?: Poll;
  };
  const poll = raw.poll;
  if (!poll || typeof poll !== "object") return { error: "Missing poll." };
  if (!POLL_ID_RE.test(String(poll.cid || "")) || !POLL_ID_RE.test(String(poll.id || ""))) return { error: "That poll isn't open." };
  if (typeof poll.title !== "string" || !poll.title.trim() || poll.title.length > 120) return { error: "Give the poll a title." };
  if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 12) return { error: "Add at least two dates." };
  const options = [];
  for (const option of poll.options) {
    if (!option || typeof option.id !== "string" || typeof option.startsAt !== "string") return { error: "Each date needs a start time." };
    if (option.id.length > 80 || Number.isNaN(new Date(option.startsAt).getTime())) return { error: "Each date needs a start time." };
    options.push({
      id: option.id,
      startsAt: option.startsAt,
      endsAt: typeof option.endsAt === "string" ? option.endsAt : "",
      tz: typeof option.tz === "string" && option.tz.length < 64 ? option.tz : "America/Los_Angeles",
    });
  }
  const members: PollPlayer[] = [];
  if (Array.isArray(raw.members)) {
    if (raw.members.length > 40) return { error: "Too many players." };
    for (const member of raw.members) {
      if (!member || typeof member !== "object") continue;
      const row = member as PollPlayer;
      if (typeof row.id !== "string" || !POLL_ID_RE.test(row.id)) continue;
      if (typeof row.displayName !== "string" || !row.displayName.trim() || row.displayName.length > 40) continue;
      members.push({
        id: row.id,
        displayName: row.displayName.trim(),
        characterName: typeof row.characterName === "string" ? row.characterName.slice(0, 40) : undefined,
        pending: row.pending === true,
      });
    }
  }
  const name = typeof raw.campaignName === "string" && raw.campaignName.trim() ? raw.campaignName.trim().slice(0, 80) : "Your table";
  return {
    poll: {
      id: poll.id,
      cid: poll.cid,
      title: poll.title.trim(),
      options,
      status: poll.status === "locked" ? "locked" : "open",
      chosenOptionId: typeof poll.chosenOptionId === "string" ? poll.chosenOptionId : null,
      createdBy: typeof poll.createdBy === "string" ? poll.createdBy.slice(0, 80) : "",
      votes: {},
      nudges: {},
    },
    campaignName: name,
    kind: raw.kind === "oneshot" ? "oneshot" : undefined,
    campaignStatus: raw.campaignStatus === "archived" ? "archived" : "active",
    members,
  };
}

