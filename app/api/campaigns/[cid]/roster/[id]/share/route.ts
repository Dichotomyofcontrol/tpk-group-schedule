import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { validPollId } from "@/lib/poll-public";
import { rosterFailureMessage } from "@/lib/roster";
import { demoMember, demoStaff, shareRosterLink } from "@/lib/roster-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ cid: string; id: string }> }) {
  const { cid, id } = await context.params;
  if (!validPollId(cid) || !validPollId(id)) return json({ error: "That player isn't on the roster." }, 404);
  if (!adminConfigured()) {
    const persona = request.headers.get("x-demo-persona") || "";
    if (!demoMember(cid, persona)) return json({ error: "You are not in this campaign." }, 403);
    if (!demoStaff(cid, persona)) return json({ error: "Only the organizer can edit the roster." }, 403);
  } else {
    const auth = await verifyBearer(request);
    if (!auth) return json({ error: "Sign in first." }, 401);
    const member = await adminDb().collection("campaigns").doc(cid).collection("members").doc(auth.uid).get();
    const role = member.data()?.role;
    if (role !== "organizer" && role !== "coorganizer") return json({ error: "Only the organizer can edit the roster." }, 403);
  }
  try {
    const result = await shareRosterLink(cid, id);
    if ("error" in result) return json({ error: result.error }, result.status);
    return json({ player: result });
  } catch (error) {
    console.error("roster share failed", error instanceof Error ? error.message : "unknown");
    return json({ error: rosterFailureMessage(error) }, 500);
  }
}
