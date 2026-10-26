import type { Attendance, AttendanceState, Campaign, Member, Session } from "./types";

export function sessionRequiresRsvp(campaign: Campaign, session: Session): boolean {
  return session.requireRsvps ?? campaign.requireRsvps;
}

/** Compact Up next pill. Going and RSVP trade places; Can't is a menu choice. */
export function rsvpPillLabel(state: AttendanceState): "Going" | "RSVP" | "Can't" {
  if (state === "in") return "Going";
  if (state === "out") return "Can't";
  return "RSVP";
}

/** One tap on the pill. Can't make it goes back to Going; Going clears to RSVP. */
export function rsvpPillToggle(state: AttendanceState): AttendanceState {
  return state === "in" ? "unset" : "in";
}

export function attendanceState(campaign: Campaign, session: Session, uid: string): AttendanceState {
  const row = session.attendance.find((a) => a.uid === uid);
  if (row) return row.state;
  return sessionRequiresRsvp(campaign, session) ? "unset" : "in";
}

export function isGreyed(campaign: Campaign, session: Session, uid: string): boolean {
  const state = attendanceState(campaign, session, uid);
  if (state === "out") return true;
  if (state === "unset" && sessionRequiresRsvp(campaign, session)) return true;
  return false;
}

export type Headcount = { inn: number; out: number; maybe: number; unset: number; total: number };

export function headcount(campaign: Campaign, session: Session, members: Member[]): Headcount {
  const counts: Headcount = { inn: 0, out: 0, maybe: 0, unset: 0, total: members.length };
  for (const m of members) {
    const state = attendanceState(campaign, session, m.id);
    if (state === "in") counts.inn += 1;
    else if (state === "out") counts.out += 1;
    else if (state === "maybe") counts.maybe += 1;
    else counts.unset += 1;
  }
  return counts;
}

export function headcountLabel(campaign: Campaign, session: Session, members: Member[]): string {
  const h = headcount(campaign, session, members);
  if (sessionRequiresRsvp(campaign, session)) {
    const waiting = h.unset + h.maybe;
    if (waiting > 0) return `${h.inn} of ${h.total} going · ${h.unset} haven't replied`;
    return `${h.inn} of ${h.total} going`;
  }
  if (h.out === 0) return `All ${h.total} in`;
  return `${h.inn} of ${h.total} in`;
}

export function seatsLeft(campaign: Campaign, session: Session, members: Member[]): number | null {
  if (!campaign.seatLimit) return null;
  const h = headcount(campaign, session, members);
  return Math.max(0, campaign.seatLimit - h.inn);
}

export function withAttendance(session: Session, uid: string, state: AttendanceState, byUid: string, note?: string, now = new Date()): Session {
  const next: Attendance = {
    uid,
    state,
    byUid,
    updatedAt: now.toISOString(),
    ...(note ? { note } : {}),
  };
  const attendance = session.attendance.filter((a) => a.uid !== uid).concat(next);
  return { ...session, attendance };
}
