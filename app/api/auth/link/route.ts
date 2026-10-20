import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

/** On first magic-link sign-in, attach pending migrated memberships that share this email and mint a calendar token. */
export async function POST(request: Request) {
  if (!adminConfigured()) return Response.json({ linked: 0, mode: "unconfigured" });
  const auth = await verifyBearer(request);
  if (!auth?.email) return Response.json({ error: "Sign in first." }, { status: 401 });
  const db = adminDb();
  const email = auth.email.toLowerCase();
  const pendingId = `email:${email}`;
  const snaps = await db.collectionGroup("members").where("email", "==", email).get();
  let linked = 0;
  for (const docSnap of snaps.docs) {
    const cid = docSnap.ref.parent.parent?.id;
    if (!cid) continue;
    if (docSnap.id === auth.uid) continue;
    const data = docSnap.data();
    await db.collection("campaigns").doc(cid).collection("members").doc(auth.uid).set({
      ...data,
      id: auth.uid,
      uid: auth.uid,
      email,
      pending: false,
    }, { merge: true });
    if (docSnap.id === pendingId || data.pending) await docSnap.ref.delete();
    linked += 1;
  }
  const userRef = db.collection("users").doc(auth.uid);
  const user = await userRef.get();
  let calToken = user.data()?.calToken as string | undefined;
  if (!calToken) {
    calToken = randomBytes(18).toString("base64url");
    await userRef.set({ email, displayName: user.data()?.displayName || email.split("@")[0], calToken }, { merge: true });
    await db.collection("calTokens").doc(calToken).set({ uid: auth.uid });
  }
  const allow = await db.collection("config").doc("allowlist").get();
  const emails: string[] = allow.data()?.emails || [];
  return Response.json({ linked, calToken, canCreateCampaigns: emails.map((item) => item.toLowerCase()).includes(email) });
}
