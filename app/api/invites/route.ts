import { randomBytes } from "node:crypto";
import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "Invites are stored in the sample table until Firebase Admin is configured." }, { status: 503 });
  }
  const auth = await verifyBearer(request);
  if (!auth) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json() as { cid?: string; email?: string; role?: "member" | "coorganizer" };
  if (!body.cid) return Response.json({ error: "Missing campaign." }, { status: 400 });
  const db = adminDb();
  const member = await db.collection("campaigns").doc(body.cid).collection("members").doc(auth.uid).get();
  if (!member.exists) return Response.json({ error: "You are not in this campaign." }, { status: 403 });
  const role = member.data()?.role as string;
  const campaign = await db.collection("campaigns").doc(body.cid).get();
  const allow = !!campaign.data()?.allowMemberInvites;
  const wanted = body.role === "coorganizer" ? "coorganizer" : "member";
  if (wanted === "coorganizer" && role !== "organizer") {
    return Response.json({ error: "Only the Organizer can invite a Co-organizer." }, { status: 403 });
  }
  if (role === "member" && !allow) return Response.json({ error: "Members can't invite on this campaign." }, { status: 403 });
  if (role !== "organizer" && role !== "coorganizer" && role !== "member") {
    return Response.json({ error: "You can't invite." }, { status: 403 });
  }
  const token = randomBytes(9).toString("base64url");
  const invite = {
    cid: body.cid,
    email: body.email?.trim().toLowerCase() || null,
    role: wanted,
    createdBy: auth.uid,
    createdByName: member.data()?.displayName || auth.email || "Organizer",
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxUses: body.email ? 1 : 5,
    uses: 0,
    status: "pending",
  };
  await db.collection("invites").doc(token).set(invite);
  return Response.json({ token, invite });
}
