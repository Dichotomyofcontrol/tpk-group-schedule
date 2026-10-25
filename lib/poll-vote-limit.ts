/** Fixed-window limits for public poll votes. Shared across instances when Firestore is configured. */
import type { Firestore } from "firebase-admin/firestore";
import { hit } from "./rate-limit";

export const POLL_VOTE_WINDOW_MS = 10 * 60 * 1000;

export async function allowPollVote(db: Firestore | null, ip: string, token: string, pollId: string): Promise<boolean> {
  const [tokenOk, ipOk, pollOk] = await Promise.all([
    hit(db, `poll-vote:token:${token}`, 12, POLL_VOTE_WINDOW_MS),
    hit(db, `poll-vote:ip:${ip}`, 30, POLL_VOTE_WINDOW_MS),
    hit(db, `poll-vote:poll:${pollId}`, 60, POLL_VOTE_WINDOW_MS),
  ]);
  return tokenOk && ipOk && pollOk;
}
