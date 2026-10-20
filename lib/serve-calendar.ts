import { attendanceState } from "./attendance";
import { calendarHeaders, demoFeed } from "./calendar-feed";
import { adminConfigured, adminDb } from "./firebase-admin";
import { buildIcs, type IcsEvent } from "./ics";
import type { Attendance, Campaign, Session } from "./types";

export async function serveCalendar(token: string, cid: string | undefined, hide: string[]) {
  const clean = decodeURIComponent(token).replace(/\.ics$/, "");
  if (clean.startsWith("demo-")) {
    const body = demoFeed(clean, cid, hide);
    if (!body) return new Response("Unknown sample feed.", { status: 404 });
    return new Response(body, { headers: calendarHeaders() });
  }
  if (!adminConfigured()) {
    return Response.json(
      { error: "Real calendar feeds need Firebase Admin credentials on the server. Sample feeds use /api/cal/demo-giada.ics." },
      { status: 503 },
    );
  }
  const db = adminDb();
  const tokenSnap = await db.collection("calTokens").doc(clean).get();
  if (!tokenSnap.exists) return new Response("Unknown feed.", { status: 404 });
  const uid = String(tokenSnap.data()?.uid || "");
  const userSnap = await db.collection("users").doc(uid).get();
  const hidden = new Set<string>([...((userSnap.data()?.hiddenCids as string[]) || []), ...hide]);
  const memberSnap = await db.collectionGroup("members").where("uid", "==", uid).get();
  const events: IcsEvent[] = [];
  for (const memberDoc of memberSnap.docs) {
    const campaignId = memberDoc.ref.parent.parent?.id;
    if (!campaignId || (cid && campaignId !== cid) || hidden.has(campaignId)) continue;
    const campaignSnap = await db.collection("campaigns").doc(campaignId).get();
    if (!campaignSnap.exists) continue;
    const campaign = { ...(campaignSnap.data() as Omit<Campaign, "id">), id: campaignId };
    const sessions = await db.collection("campaigns").doc(campaignId).collection("sessions").get();
    for (const sessionDoc of sessions.docs) {
      const data = sessionDoc.data();
      const attendance = (Array.isArray(data.attendance)
        ? data.attendance
        : Object.values((data.attendance || {}) as Record<string, Attendance>)) as Attendance[];
      const session: Session = { ...(data as Omit<Session, "id" | "attendance">), id: sessionDoc.id, attendance };
      events.push({ session, campaign, viewerOut: attendanceState(campaign, session, uid) === "out" });
    }
  }
  const name = cid ? events[0]?.campaign.name || "Play dates" : "Six in the TPK";
  return new Response(buildIcs(name, events), { headers: calendarHeaders() });
}
