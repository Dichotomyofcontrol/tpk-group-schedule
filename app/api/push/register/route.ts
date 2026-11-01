import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Stores the signed-in user's APNs device token so reminders can be pushed to the iOS app. */
export async function POST(request: Request) {
  if (!adminConfigured()) return Response.json({ error: "Not available." }, { status: 404 });
  const user = await verifyBearer(request);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  let body: { token?: unknown; platform?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[A-Za-z0-9:_-]{32,512}$/.test(token)) return Response.json({ error: "Bad token." }, { status: 400 });
  const ref = adminDb().collection("users").doc(user.uid).collection("devices").doc(token.slice(0, 160));
  if (body.enabled === false) {
    await ref.delete();
    return Response.json({ ok: true });
  }
  await ref.set({ token, platform: body.platform === "ios" ? "ios" : "unknown", updatedAt: new Date().toISOString() }, { merge: true });
  return Response.json({ ok: true });
}
