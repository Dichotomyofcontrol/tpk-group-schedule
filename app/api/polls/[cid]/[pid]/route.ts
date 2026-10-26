import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { demoPollRecord, saveDemoPoll } from "@/lib/poll-demo";
import { applyGuestVote, parseGuestBallot, toPublicPoll, validPollId, voteSeats, type GuestVoteInput, type PollRecord } from "@/lib/poll-public";
import { loadPollRecord, pollFromData } from "@/lib/poll-record";
import { allowPollVote } from "@/lib/poll-vote-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown";
}

export async function GET(request: Request, context: { params: Promise<{ cid: string; pid: string }> }) {
  const { cid, pid } = await context.params;
  if (!validPollId(cid) || !validPollId(pid)) return json({ error: "That poll isn't open." }, 404);
  try {
    const record = await loadPollRecord(cid, pid);
    if (!record || record.campaignStatus === "archived") return json({ error: "That poll isn't open." }, 404);
    const token = request.headers.get("x-guest-token");
    const view = await toPublicPoll(record, token);
    return json(view);
  } catch (error) {
    console.error("public poll read failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "That poll isn't open." }, 404);
  }
}

export async function POST(request: Request, context: { params: Promise<{ cid: string; pid: string }> }) {
  const { cid, pid } = await context.params;
  if (!validPollId(cid) || !validPollId(pid)) return json({ error: "That poll isn't open." }, 404);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 20_000) return json({ error: "That vote is too large." }, 413);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
  const parsed = parseGuestBallot(body);
  if ("error" in parsed) return json({ error: parsed.error }, parsed.status);

  const db = adminConfigured() ? adminDb() : null;
  if (!(await allowPollVote(db, clientIp(request), parsed.token, pid))) {
    return json({ error: "Too many votes from this network. Wait a few minutes and try again." }, 429);
  }

  try {
    if (!db) {
      const record = demoPollRecord(cid, pid);
      if (!record || record.campaignStatus === "archived") return json({ error: "That poll isn't open." }, 404);
      const result = await applyGuestVote(record.poll, parsed, voteSeats(record));
      if ("error" in result) return json({ error: result.error }, result.status);
      saveDemoPoll(result.poll, record);
      const view = await toPublicPoll({ ...record, poll: result.poll }, parsed.token);
      return json({ ...view, edited: result.edited });
    }
    return await commitLiveVote(cid, pid, parsed);
  } catch (error) {
    console.error("guest vote failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Couldn't save that vote." }, 500);
  }
}

async function commitLiveVote(cid: string, pid: string, parsed: GuestVoteInput) {
  const db = adminDb();
  const loaded = await loadPollRecord(cid, pid);
  if (!loaded || loaded.campaignStatus === "archived") return json({ error: "That poll isn't open." }, 404);
  const members = voteSeats(loaded);
  const ref = db.collection("campaigns").doc(cid).collection("polls").doc(pid);
  const saved = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: "That poll isn't open.", status: 404 };
    const poll = pollFromData(pid, cid, snap.data() || {});
    if (!poll) return { error: "That poll isn't open.", status: 404 };
    const result = await applyGuestVote(poll, parsed, members);
    if ("error" in result) return result;
    tx.update(ref, { votes: result.poll.votes });
    return result;
  });
  if ("error" in saved) return json({ error: saved.error }, saved.status);
  const record: PollRecord = { ...loaded, poll: saved.poll };
  const view = await toPublicPoll(record, parsed.token);
  return json({ ...view, edited: saved.edited });
}
