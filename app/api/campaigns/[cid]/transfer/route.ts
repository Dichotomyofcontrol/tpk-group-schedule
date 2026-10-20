import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ cid: string }> }) {
  if (!adminConfigured()) return Response.json({ error: "Transfer needs Firebase Admin." }, { status: 503 });
  const auth = await verifyBearer(request);
  if (!auth) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { cid } = await context.params;
  const body = await request.json() as { uid?: string };
  if (!body.uid) return Response.json({ error: "Pick a person." }, { status: 400 });
  const db = adminDb();
  const me = await db.collection("campaigns").doc(cid).collection("members").doc(auth.uid).get();
  if (me.data()?.role !== "organizer") return Response.json({ error: "Only the Organizer can transfer." }, { status: 403 });
  const next = db.collection("campaigns").doc(cid).collection("members").doc(body.uid);
  const nextSnap = await next.get();
  if (!nextSnap.exists) return Response.json({ error: "That person isn't in the campaign." }, { status: 404 });
  await db.runTransaction(async (tx) => {
    tx.set(me.ref, { role: "coorganizer" }, { merge: true });
    tx.set(next, { role: "organizer" }, { merge: true });
    tx.set(db.collection("campaigns").doc(cid), { ownerUid: body.uid }, { merge: true });
  });
  return Response.json({ ok: true });
}
