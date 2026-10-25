import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { hit } from "@/lib/rate-limit";
import { USERS } from "@/lib/demo-data";
import { claimRosterSeat, previewSeat } from "@/lib/roster-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function validToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(token);
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!validToken(token)) return json({ error: "This seat isn't open." }, 404);
  let viewer = "";
  if (!adminConfigured()) viewer = request.headers.get("x-demo-persona") || "";
  else {
    const auth = await verifyBearer(request);
    viewer = auth?.uid || "";
  }
  const seat = await previewSeat(token, viewer);
  if (!seat) return json({ error: "This seat isn't open." }, 404);
  return json(seat);
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!validToken(token)) return json({ error: "This seat isn't open." }, 404);
  const db = adminConfigured() ? adminDb() : null;
  let person: { id: string; email: string; displayName: string } | null = null;
  if (!db) {
    let body: { personaId?: unknown } = {};
    try { body = await request.json(); } catch { body = {}; }
    const id = typeof body.personaId === "string" ? body.personaId : "";
    const user = USERS.find((item) => item.id === id);
    if (!user) return json({ error: "Sign in first." }, 401);
    person = { id: user.id, email: user.email, displayName: user.displayName };
  } else {
    const auth = await verifyBearer(request);
    if (!auth?.email) return json({ error: "Sign in first." }, 401);
    const user = (await db.collection("users").doc(auth.uid).get()).data() || {};
    const displayName = typeof user.displayName === "string" && user.displayName.trim() ? user.displayName.trim().slice(0, 40) : "";
    person = { id: auth.uid, email: auth.email, displayName };
  }
  if (!(await hit(db, `roster-claim:${token}:${person.id}`, 12, 10 * 60 * 1000))) {
    return json({ error: "Too many tries. Wait a few minutes." }, 429);
  }
  const result = await claimRosterSeat(token, person);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({
    ok: true,
    campaignName: result.campaignName,
    cid: result.player.cid,
    player: {
      id: result.player.id,
      name: result.player.name,
      characterName: result.player.characterName,
      status: result.player.status,
      memberId: result.player.memberId,
    },
    member: result.member,
    created: result.created,
    linked: result.linked,
    already: result.already,
  });
}
