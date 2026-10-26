import type { Poll } from "./types";

export type PollPhase = { active: Poll[]; closed: Poll[] };

export type PollGroups = {
  sent: PollPhase;
  received: PollPhase;
};

/** Polls I created, then polls from tables I'm on that someone else started. Each splits open from locked. */
export function groupMemberPolls(polls: Poll[], meId: string): PollGroups {
  const sent: PollPhase = { active: [], closed: [] };
  const received: PollPhase = { active: [], closed: [] };
  for (const poll of polls) {
    const box = poll.createdBy === meId ? sent : received;
    (poll.status === "open" ? box.active : box.closed).push(poll);
  }
  return { sent, received };
}

/** One-shots are named by the campaign. Session polls keep the question the organizer wrote. */
export function pollDisplayTitle(poll: Pick<Poll, "title">, campaign?: { kind?: string; name: string } | null): string {
  if (campaign?.kind === "oneshot") return campaign.name;
  return poll.title;
}
