import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { validPollId } from "@/lib/poll-public";
import { demoMember, demoStaff, deleteRosterPlayer, updateRosterPlayer } from "@/lib/roster-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function staff(cid: string, request: Request): Promise<true | Response> {
  if (!validPollId(cid)) return json({ error: "That campaign isn't open." }, 404);
  if (!adminConfigured()) {
    const persona = request.headers.get("x-demo-persona") || "";
    if (!demoMember(cid, persona)) return json({ error: "You are not in this campaign." }, 403);
    if (!demoStaff(cid, persona)) return json({ error: "Only the organizer can edit the roster." }, 403);
    return true;
  }
  const auth = await verifyBearer(request);
  if (!auth) return json({ error: "Sign in first." }, 401);
  const member = await adminDb().collection("campaigns").doc(cid).collection("members").doc(auth.uid).get();
  const role = member.data()?.role;
  if (role !== "organizer" && role !== "coorganizer") return json({ error: "Only the organizer can edit the roster." }, 403);
  return true;
}

export async function PATCH(request: Request, context: { params: Promise<{ cid: string; id: string }> }) {
  const { cid, id } = await context.params;
  const gate = await staff(cid, request);
  if (gate instanceof Response) return gate;
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
  const result = await updateRosterPlayer(cid, id, body);
  if ("error" in result) return json({ error: result.error }, result.status);
  return json({ player: result });
}

export async function DELETE(request: Request, context: { params: Promise<{ cid: string; id: string }> }) {
  const { cid, id } = await context.params;
  const gate = await staff(cid, request);
  if (gate instanceof Response) return gate;
  const result = await deleteRosterPlayer(cid, id);
  if ("error" in result) return json({ error: result.error }, result.status);
  return json({ ok: true });
}
