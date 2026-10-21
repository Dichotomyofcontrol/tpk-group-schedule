import { adminBucket, adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** Delete a campaign forever: sessions, polls, members, invites, recap files and covers. Organizer only. */
export async function DELETE(request: Request, context: { params: Promise<{ cid: string }> }) {
  if (!adminConfigured()) return Response.json({ error: "Delete needs Firebase Admin." }, { status: 503 });
  const auth = await verifyBearer(request);
  if (!auth) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { cid } = await context.params;
  const db = adminDb();
  const ref = db.collection("campaigns").doc(cid);
  const [campaign, me] = await Promise.all([ref.get(), ref.collection("members").doc(auth.uid).get()]);
  if (!campaign.exists) return Response.json({ error: "Campaign not found." }, { status: 404 });
  if (me.data()?.role !== "organizer") return Response.json({ error: "Only the organizer can delete this campaign." }, { status: 403 });
  const bucket = adminBucket();
  await bucket.deleteFiles({ prefix: `recaps/${cid}/`, force: true }).catch(() => undefined);
  await bucket.deleteFiles({ prefix: `campaigns/${cid}/`, force: true }).catch(() => undefined);
  const legacy = await db.collection("recapFiles").where("cid", "==", cid).get();
  for (const doc of legacy.docs) {
    await bucket.file(`recaps/${doc.id}`).delete({ ignoreNotFound: true }).catch(() => undefined);
    await doc.ref.delete();
  }
  const invites = await db.collection("invites").where("cid", "==", cid).get();
  for (const doc of invites.docs) await doc.ref.delete();
  await db.recursiveDelete(ref);
  return Response.json({ ok: true });
}
