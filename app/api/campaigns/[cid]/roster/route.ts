import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { hit } from "@/lib/rate-limit";
import { rosterFailureMessage } from "@/lib/roster";
import { demoMember, demoStaff, loadRoster, createRosterPlayer, rosterForClient } from "@/lib/roster-server";
import { validPollId } from "@/lib/poll-public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function access(cid: string, request: Request): Promise<{ staff: boolean } | Response> {
  if (!validPollId(cid)) return json({ error: "That campaign isn't open." }, 404);
  if (!adminConfigured()) {
    const persona = request.headers.get("x-demo-persona") || "";
    if (!demoMember(cid, persona)) return json({ error: "You are not in this campaign." }, 403);
    return { staff: demoStaff(cid, persona) };
  }
  const auth = await verifyBearer(request);
  if (!auth) return json({ error: "Sign in first." }, 401);
  const member = await adminDb().collection("campaigns").doc(cid).collection("members").doc(auth.uid).get();
  if (!member.exists) return json({ error: "You are not in this campaign." }, 403);
  const role = member.data()?.role;
  return { staff: role === "organizer" || role === "coorganizer" };
}

export async function GET(request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params;
  const gate = await access(cid, request);
  if (gate instanceof Response) return gate;
  const players = rosterForClient(await loadRoster(cid), gate.staff);
  return json({ players });
}

export async function POST(request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params;
  const gate = await access(cid, request);
  if (gate instanceof Response) return gate;
  if (!gate.staff) return json({ error: "Only the organizer can edit the roster." }, 403);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 8_000) return json({ error: "That player is too large." }, 413);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
  const db = adminConfigured() ? adminDb() : null;
  const who = request.headers.get("x-demo-persona") || "staff";
  if (!(await hit(db, `roster-add:${cid}:${who}`, 30, 10 * 60 * 1000))) {
    return json({ error: "Too many players added. Wait a few minutes." }, 429);
  }
  try {
    const result = await createRosterPlayer(cid, body);
    if ("error" in result) return json({ error: result.error }, result.status);
    return json({ player: result }, 201);
  } catch (error) {
    console.error("roster add failed", error instanceof Error ? error.message : "unknown");
    return json({ error: rosterFailureMessage(error) }, 500);
  }
}
