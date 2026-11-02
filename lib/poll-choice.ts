/**
 * Yes, Maybe, or unanswered (no). Stored values: `true` is Yes, `"maybe"` is Maybe.
 * Older ballots stored `"best"` (could attend and liked it most); that reads as Yes,
 * so no earlier vote is lost or downgraded.
 */

export type PollChoice = "yes" | "maybe";

export function choiceOf(value: unknown): PollChoice | null {
  if (value === true || value === "best") return "yes";
  if (value === "maybe") return "maybe";
  return null;
}

/** Tap once for Yes, again for Maybe, again to clear. */
export function cyclePick(value: unknown): true | "maybe" | undefined {
  const current = choiceOf(value);
  if (current === null) return true;
  if (current === "yes") return "maybe";
  return undefined;
}

export function tallyText(yes: number, maybe: number): string {
  return maybe > 0 ? `${yes} yes · ${maybe} maybe` : `${yes} yes`;
}

export function maybeIds(vote: { picks?: Record<string, unknown> } | undefined): string[] {
  if (!vote?.picks) return [];
  return Object.entries(vote.picks).filter(([, value]) => choiceOf(value) === "maybe").map(([id]) => id);
}

/** The leading option: most Yes, then most Maybe, then earliest. Null when nobody said Yes. */
export function leaderId(rows: { option: { id: string; startsAt: string }; yes: number; maybe: number }[]): string | null {
  let best: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (row.yes < 1) continue;
    if (!best || row.yes > best.yes || (row.yes === best.yes && (row.maybe > best.maybe || (row.maybe === best.maybe && row.option.startsAt < best.option.startsAt)))) best = row;
  }
  return best ? best.option.id : null;
}

/** Calendar order, so dates never jump around while people vote. */
export function calendarOrder<T extends { option: { startsAt: string } }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.option.startsAt.localeCompare(b.option.startsAt));
}
