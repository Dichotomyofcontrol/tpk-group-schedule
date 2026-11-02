import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { pushToUsers } from "@/lib/push";
import { dueReminder, reminderRecipients, reminderSubject, reminderText, type ReminderKind } from "@/lib/reminders";
import type { Campaign, Member, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: "Set CRON_SECRET and call this with Authorization: Bearer." }, { status: 401 });
  }
  if (!adminConfigured()) return Response.json({ sent: 0, reason: "Firebase Admin is not configured." });
  const db = adminDb();
  const campaigns = await db.collection("campaigns").where("status", "==", "active").get();
  const now = new Date();
  let sent = 0;
  let pushed = 0;
  const planned: { session: string; kind: ReminderKind; to: string[] }[] = [];
  for (const campaignDoc of campaigns.docs) {
    const campaign = { ...(campaignDoc.data() as Omit<Campaign, "id">), id: campaignDoc.id };
    const sessions = await campaignDoc.ref.collection("sessions").get();
    const members = (await campaignDoc.ref.collection("members").get()).docs.map((docSnap) => ({ ...(docSnap.data() as Omit<Member, "id">), id: docSnap.id }));
    for (const sessionDoc of sessions.docs) {
      const data = sessionDoc.data();
      const attendance = Array.isArray(data.attendance) ? data.attendance : Object.values(data.attendance || {});
      const session = { ...(data as Omit<Session, "id" | "attendance" | "cid">), id: sessionDoc.id, cid: campaign.id, attendance };
      const kind = dueReminder(session, now);
      if (!kind) continue;
      const recipients = reminderRecipients(campaign, session, members);
      planned.push({ session: session.id, kind, to: recipients.map((member) => member.email) });
      if (process.env.RESEND_API_KEY && process.env.REMINDER_FROM) {
        for (const member of recipients) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: process.env.REMINDER_FROM,
              to: member.email,
              subject: reminderSubject(campaign, session, kind),
              text: reminderText(campaign, session, members),
            }),
          });
          sent += 1;
        }
      }
      // iOS app: same reminder as a push to anyone who registered a device. No-op until APNS_* is set.
      const uids = recipients.map((member) => member.uid).filter((uid): uid is string => Boolean(uid));
      pushed += await pushToUsers(db, uids, {
        title: reminderSubject(campaign, session, kind),
        body: kind === "3h" ? "Starts in about 3 hours." : "Coming up in 3 days. Check you're in.",
        url: `/sessions/${session.id}`,
      }).catch((error) => { console.error(`reminders: push failed: ${error instanceof Error ? error.message : "unknown"}`); return 0; });
      await sessionDoc.ref.set(kind === "3h" ? { reminder3hSent: true } : { reminder3dSent: true }, { merge: true });
    }
  }
  return Response.json({
    sent,
    pushed,
    planned,
    email: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM),
  });
}
