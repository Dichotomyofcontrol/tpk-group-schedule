/** Works, Best, or unpicked. Unpicked means can't. Older ballots store `true` for Works. */

export type PollChoice = "works" | "best";

/** `true` is Works. `"best"` is Best. Anything else, including `false`, is unpicked. */
export function choiceOf(value: unknown): PollChoice | null {
  if (value === "best") return "best";
  if (value === true) return "works";
  return null;
}

/** Tap once for Works, again for Best, again to clear. */
export function cyclePick(value: unknown): true | "best" | undefined {
  const current = choiceOf(value);
  if (current === null) return true;
  if (current === "works") return "best";
  return undefined;
}

export function tallyText(can: number, best: number): string {
  return `${can} can · ${best} best`;
}

export function bestIds(vote: { picks?: Record<string, unknown> } | undefined): string[] {
  if (!vote?.picks) return [];
  return Object.entries(vote.picks).filter(([, value]) => value === "best").map(([id]) => id);
}
