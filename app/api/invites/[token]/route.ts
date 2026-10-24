import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { buildDemo } from "@/lib/demo-data";
import { displayTitle } from "@/lib/model";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const demo = buildDemo("giada").invites.find((invite) => invite.token === token);
  if (demo) {
    const campaign = buildDemo("giada").campaigns.find((item) => item.id === demo.cid);
    const sessions = buildDemo("giada").sessions
      .filter((session) => session.cid === demo.cid && session.status === "scheduled")
      .slice(0, 3)
      .map((session) => ({ startsAt: session.startsAt, title: displayTitle(session, campaign?.name || ""), tz: session.tz }));
    return Response.json({
      token,
      campaign: campaign && { id: campaign.id, name: campaign.name, color: campaign.color, icon: campaign.icon, cover: campaign.cover, location: campaign.defaultLocation },
      invitedBy: demo.createdByName,
      role: demo.role,
      sessions,
    });
  }
  if (!adminConfigured()) return Response.json({ error: "Invite lookup needs Firebase Admin." }, { status: 503 });
  const snap = await adminDb().collection("invites").doc(token).get();
  if (!snap.exists) return Response.json({ token, status: "missing" });
  const data = snap.data() || {};
  const campaignSnap = await adminDb().collection("campaigns").doc(String(data.cid)).get();
  const campaign = campaignSnap.data() || {};
  return Response.json({
    token,
    campaign: { id: data.cid, name: campaign.name, color: campaign.color, icon: campaign.icon, cover: campaign.cover, location: campaign.defaultLocation },
    invitedBy: data.createdByName,
    role: data.role,
    status: data.status,
  });
}
