import type { Session } from "./types";

export type Dot = { id: string; played: boolean; cid: string };

export function sessionHours(session: Session): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

export function groupStats(sessions: Session[], now = new Date()) {
  const past = sessions
    .filter((s) => new Date(s.startsAt).getTime() < now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const played = past.filter((s) => s.status !== "cancelled");
  const hours = Math.round(played.reduce((sum, s) => sum + sessionHours(s), 0));
  let streak = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    if (past[i].status === "cancelled") break;
    streak += 1;
  }
  const dots: Dot[] = past.slice(-48).map((s) => ({
    id: s.id,
    cid: s.cid,
    played: s.status !== "cancelled",
  }));
  return { played: played.length, hours, streak, dots };
}
