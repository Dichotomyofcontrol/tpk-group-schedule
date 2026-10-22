import { ownTitle } from "./model";
import type { Campaign, Member, Session } from "./types";
import { attendanceState } from "./attendance";
import { formatRangePretty, zoneLong } from "./time";

export type ReminderKind = "3d" | "3h";

const THREE_DAYS = 72 * 60 * 60_000;
const THREE_HOURS = 3 * 60 * 60_000;
const WINDOW = 90 * 60_000;

export function dueReminder(session: Session, now = new Date()): ReminderKind | null {
  if (session.status !== "scheduled") return null;
  const start = new Date(session.startsAt).getTime();
  const t = now.getTime();
  if (t >= start) return null;
  if (!session.reminder3hSent && t >= start - THREE_HOURS && t < start - THREE_HOURS + WINDOW) return "3h";
  if (!session.reminder3dSent && t >= start - THREE_DAYS && t < start - THREE_DAYS + WINDOW) return "3d";
  return null;
}

export function reminderRecipients(campaign: Campaign, session: Session, members: Member[]): Member[] {
  return members.filter((m) => m.email && !m.remindersOff && attendanceState(campaign, session, m.id) !== "out");
}

export function reminderSubject(campaign: Campaign, session: Session, kind: ReminderKind): string {
  const when = kind === "3h" ? "tonight" : "in 3 days";
  return `${campaign.name} plays ${when}`;
}

export function reminderText(campaign: Campaign, session: Session, members: Member[]): string {
  const when = formatRangePretty(session.startsAt, session.endsAt, session.tz);
  const out = members.filter((m) => attendanceState(campaign, session, m.id) === "out").map((m) => m.displayName);
  const lines = [
    `${campaign.name}`,
    ownTitle(session, campaign.name),
    when,
    zoneLong(session.tz),
    session.location,
    session.notes?.trim() ? `Note for the table: ${session.notes.trim()}` : "",
    out.length ? `Out: ${out.join(", ")}` : "Nobody has marked themselves out.",
    campaign.previouslyOn ? `Previously on: ${campaign.previouslyOn}` : "",
    "Open Six in the TPK if you can't make it.",
  ];
  return lines.filter(Boolean).join("\n");
}
