"use client";

import { tallyText, type PollChoice } from "@/lib/poll-choice";
import { Icon } from "./ui";

function whoLabel(names: string[]): string {
  if (!names.length) return "";
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
}

/** One date. A tap cycles Yes, Maybe, then cleared (No). Rows stay in calendar order. */
export function PollDateRow({
  dow, day, mon, time, yes, maybe, max, names, choice, lead, everyone, disabled, onCycle,
}: {
  dow: string;
  day: string;
  mon: string;
  time: string;
  yes: number;
  maybe: number;
  max: number;
  names: string[];
  choice: PollChoice | null;
  lead: boolean;
  everyone: boolean;
  disabled?: boolean;
  onCycle?: () => void;
}) {
  const who = whoLabel(names);
  const state = choice === "yes" ? "You said yes" : choice === "maybe" ? "You said maybe" : "No answer";
  const tally = tallyText(yes, maybe);
  const label = `${dow} ${mon} ${day} ${time}: ${state}. ${tally}${everyone ? ", works for everyone" : lead ? ", leading" : ""}${names.length ? ` (${names.join(", ")})` : ""}`;
  const className = `opt${choice ? " mine" : ""}${choice === "maybe" ? " maybe" : ""}${lead ? " lead" : ""}${everyone ? " all" : ""}`;
  const body = (
    <>
      <span className="fill" style={{ width: `${Math.round((yes / Math.max(1, max)) * 100)}%` }} />
      <span className="chk">{choice === "yes" ? <Icon name="check" /> : choice === "maybe" ? <b aria-hidden="true">?</b> : null}</span>
      <span className="dt">
        <span className="dline">
          <span className="dw">{dow}</span>
          <span className="dn">{day}</span>
          <span className="dm">{mon}</span>
        </span>
        {everyone ? <b className="lead-t all">Works for everyone</b> : lead && <b className="lead-t">Leading</b>}
        <span className="tm">
          {time}
          {choice && <b className={`mine-best${choice === "maybe" ? " is-maybe" : ""}`}>{choice === "yes" ? "Yes" : "Maybe"}</b>}
        </span>
      </span>
      <span className="t">{who && <span className="who">{who}</span>}</span>
      <span className="n tally">{tally}</span>
    </>
  );
  if (disabled || !onCycle) return <div className={className} aria-label={label}>{body}</div>;
  return (
    <button type="button" aria-pressed={choice !== null} aria-label={label} className={className} onClick={onCycle}>
      {body}
    </button>
  );
}
