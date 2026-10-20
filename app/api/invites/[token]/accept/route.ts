import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!adminConfigured()) return Response.json({ error: "Accepting a live invite needs Firebase Admin." }, { status: 503 });
  const auth = await verifyBearer(request);
  if (!auth?.email) return Response.json({ error: "Sign in with the email link first." }, { status: 401 });
  const { token } = await context.params;
  const db = adminDb();
  const ref = db.collection("invites").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
  const invite = snap.data() || {};
  if (invite.status !== "pending") return Response.json({ error: "Invite is not open." }, { status: 400 });
  if (new Date(invite.expiresAt).getTime() < Date.now()) return Response.json({ error: "Invite expired." }, { status: 400 });
  if ((invite.uses || 0) >= (invite.maxUses || 1)) return Response.json({ error: "Invite used up." }, { status: 400 });
  if (invite.email && String(invite.email).toLowerCase() !== auth.email.toLowerCase()) {
    return Response.json({ error: "This invite was sent to a different email." }, { status: 403 });
  }
  const memberRef = db.collection("campaigns").doc(invite.cid).collection("members").doc(auth.uid);
  await memberRef.set({
    uid: auth.uid,
    email: auth.email,
    displayName: auth.email.split("@")[0],
    role: invite.role === "coorganizer" ? "coorganizer" : "member",
    tags: [],
    joinedAt: new Date().toISOString(),
  }, { merge: true });
  await ref.set({ uses: (invite.uses || 0) + 1, status: "accepted" }, { merge: true });
  return Response.json({ ok: true, cid: invite.cid });
}
