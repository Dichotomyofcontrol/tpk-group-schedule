"use client";

import Link from "next/link";
import { forYou } from "@/lib/almanac-me";
import { recordDate } from "@/lib/almanac-stats";
import type { AppState } from "@/lib/types";
import { CharacterName } from "./character-sheet";

function when(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Facts about the signed-in player across their tables. Only rows with real data render. */
export function ForYouLedger({ state }: { state: AppState }) {
  const me = forYou(state);
  const hasAny = me.totals || me.seats.length || me.next || me.longest;
  if (!hasAny) return null;
  return (
    <section className="rec-ledger for-you" aria-label="For you">
      <div className="rec-big">
        {me.totals && (
          <>
            <div><b>{me.totals.sessions.toLocaleString()}</b><span>sessions recorded</span></div>
            <div><b>{me.totals.hours.toLocaleString()}</b><span>hours recorded</span></div>
            <div><b>{me.totals.wordsLabel}</b><span>words recorded</span></div>
          </>
        )}
        {me.played.nights > 0 && <div><b>{me.played.nights.toLocaleString()}</b><span>nights played</span></div>}
        {me.played.hours > 0 && <div><b>{me.played.hours.toLocaleString()}</b><span>hours played</span></div>}
      </div>
      <div className="rec-grid">
        {me.seats.length > 0 && (
          <article>
            <h3>Your seats</h3>
            <ul className="rec-bars">
              {me.seats.map((seat) => (
                <li key={seat.cid}>
                  <span className="lbl" title={seat.campaign}>
                    {seat.character ? <CharacterName cid={seat.cid} name={seat.character} /> : "GM"} · {seat.campaign}
                  </span>
                  {seat.share != null ? <span className="bar" style={{ ["--w" as string]: `${seat.share}%` }}><i /></span> : <span />}
                  <span className="num">
                    {seat.share != null ? `${seat.share}%` : ""}
                  </span>
                  {(seat.rank || seat.nat20 || seat.nat1) && (
                    <em className="seat-note">
                      {[seat.rank && seat.of ? `#${seat.rank} of ${seat.of} talkers` : "", seat.gm && seat.share != null ? "of all talk" : "", seat.nat20 ? `nat 20 ×${seat.nat20}` : "", seat.nat1 ? `nat 1 ×${seat.nat1}` : ""].filter(Boolean).join(" · ")}
                    </em>
                  )}
                </li>
              ))}
            </ul>
          </article>
        )}
        <article>
          <ul className="for-you-list">
            {me.next && (
              <li><span>Next</span><Link href={`/campaigns/${me.next.cid}/sessions/${me.next.sid}`}>{me.next.title}</Link><em>{me.next.campaign} · {when(me.next.startsAt, me.next.tz)}</em></li>
            )}
            {me.mostActive && (
              <li><span>Most active</span><b>{me.mostActive.campaign}</b><em>{me.mostActive.sessions} sessions · {me.mostActive.hours} h</em></li>
            )}
            {me.streak && (
              <li><span>Streak</span><b>{me.streak.count} in a row</b><em>{me.streak.campaign}</em></li>
            )}
            {me.longest && (
              <li><span>Longest night</span><b>{me.longest.title}</b><em>{me.longest.campaign} · {recordDate(me.longest.date)} · {me.longest.hours} h</em></li>
            )}
            {me.deaths.map((death) => (
              <li key={`${death.cid}-${death.name}`}><span>Death</span><b>{death.name}</b><em>{death.campaign} · {death.line}</em></li>
            ))}
            {me.awards.map((award) => (
              <li key={award.title}><span>Award</span><b>{award.title}</b><em>{award.who} · {award.campaign}</em></li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
