import { DEMO_RECORDED, LIVE_RECORDED, liveMemberCampaigns, recordedPayload } from "@/lib/almanac-records.server";
import { adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { demoMember } from "@/lib/roster-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "private, no-store", vary: "authorization" } });
}

/** Recorded Almanac stats, only for the recorded campaigns the caller is a member of. */
export async function GET(request: Request) {
  if (!adminConfigured()) {
    // Local demo only: no Firebase Admin. Never on production.
    if (process.env.VERCEL_ENV === "production") return json({ error: "Unavailable." }, 503);
    const persona = request.headers.get("x-demo-persona") || "";
    const cids = Object.keys(DEMO_RECORDED).filter((cid) => persona && demoMember(cid, persona));
    return json(recordedPayload(cids, DEMO_RECORDED));
  }
  const auth = await verifyBearer(request);
  if (!auth) return json({ error: "Sign in first." }, 401);
  const cids = await liveMemberCampaigns(adminDb(), auth.uid);
  return json(recordedPayload(cids, LIVE_RECORDED));
}
