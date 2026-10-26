"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { recapAppearances, summaryDocId, summaryFor } from "@/lib/character-summary";
import { membersOf } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading } from "@/lib/time";
import type { CharacterFacts } from "@/lib/types";
import { Avatar, Icon } from "./ui";

const FACTS: { key: keyof CharacterFacts; label: string }[] = [
  { key: "class", label: "Class" },
  { key: "ancestry", label: "Ancestry" },
  { key: "role", label: "Role in the party" },
  { key: "moment", label: "Notable moment" },
];

export type CharacterPanelHandle = { show: () => void };

/** The character name as it already appears. Opens the sheet. No badge, no extra control. */
export function CharacterName({ cid, name, className }: { cid: string; name: string; className?: string }) {
  const panel = useRef<CharacterPanelHandle>(null);
  return (
    <>
      <button type="button" className={className ? `char-name ${className}` : "char-name"} onClick={() => panel.current?.show()}>
        {name}
      </button>
      <CharacterPanel ref={panel} cid={cid} name={name} />
    </>
  );
}

const CharacterPanel = forwardRef<CharacterPanelHandle, { cid: string; name: string }>(function CharacterPanel({ cid, name }, ref) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const summary = summaryFor(state.characterSummaries?.[cid], name);
  const members = membersOf(state, cid);
  const player = members.find((member) => member.characterName && summaryDocId(member.characterName) === summaryDocId(name));
  const appearances = recapAppearances(state.sessions, cid, name);
  const facts = summary.status === "ready" ? FACTS.filter((fact) => summary.facts?.[fact.key]) : [];

  useImperativeHandle(ref, () => ({ show: () => setOpen(true) }), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="char-layer">
      <button type="button" className="char-scrim" aria-label="Close character" onClick={() => setOpen(false)} />
      <aside className="char-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button ref={closeRef} type="button" className="iconbtn char-close" aria-label="Close" onClick={() => setOpen(false)}>
          <Icon name="x" />
        </button>
        <Avatar name={name} id={player?.id || summaryDocId(name)} className="char-portrait" />
        
        <h2 id={titleId}>{name}</h2>
        {player && <p className="char-player">Played by {player.displayName}</p>}
        {summary.status === "ready" && summary.text ? (
          <>
            {facts.length > 0 && (
              <dl className="char-facts">
                {facts.map((fact) => (
                  <div key={fact.key}>
                    <dt>{fact.label}</dt>
                    <dd>{summary.facts?.[fact.key]}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="char-prose">{summary.text}</p>
          </>
        ) : (
          <p className="char-prose pending">Summary pending.</p>
        )}
        <h3>Appears in</h3>
        {appearances.length > 0 ? (
          <ul className="char-appears">
            {appearances.map((night) => {
              const when = formatDayHeading(night.startsAt, night.tz);
              return (
                <li key={night.id}>
                  <Link href={`/campaigns/${cid}/sessions/${night.id}`} onClick={() => setOpen(false)}>
                    <b>{night.title}</b>
                    <span>{when.mon} {when.day}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="note">Not mentioned in a recap yet.</p>
        )}
      </aside>
    </div>,
    document.body,
  );
});
