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
  // Same numbers as Your seats: app sessions, or recordings where the app has none.
  const nights = me.seats.reduce((sum, seat) => sum + seat.nights, 0);
  const hours = Math.round(me.seats.reduce((sum, seat) => sum + seat.hours, 0));
  return (
    <section className="rec-ledger for-you" aria-label="For you">
      <div className="rec-big">
        {nights > 0 && <div><b>{nights.toLocaleString()}</b><span>{nights === 1 ? "night" : "nights"}</span></div>}
        {hours > 0 && <div><b>{hours.toLocaleString()}</b><span>{hours === 1 ? "hour" : "hours"}</span></div>}
        {me.totals && <div><b>{me.totals.wordsLabel}</b><span>words recorded</span></div>}
      </div>
      <div className="rec-grid">
        {me.seats.length > 0 && (
          <article>
            <h3>Your seats <small>by play time</small></h3>
            <ul className="rec-bars">
              {me.seats.map((seat) => (
                <li key={seat.cid}>
                  <span className="lbl" title={seat.campaign}>
                    {seat.character ? <CharacterName cid={seat.cid} name={seat.character} /> : seat.gm ? "GM" : "Player"} · {seat.campaign}
                  </span>
                  <span className="bar" style={{ ["--w" as string]: `${Math.max(seat.width, 2)}%` }}><i /></span>
                  <span className="num">{seat.playShare}%</span>
                  <em className="seat-note">
                    {[`${seat.hours} h · ${seat.nights} ${seat.nights === 1 ? "night" : "nights"}${seat.fromRecordings ? " (recorded)" : ""}`, seat.rank && seat.of ? `#${seat.rank} of ${seat.of} talkers` : "", seat.gm && seat.share != null ? `${seat.share}% of all talk` : "", seat.nat20 ? `nat 20 ×${seat.nat20}` : "", seat.nat1 ? `nat 1 ×${seat.nat1}` : ""].filter(Boolean).join(" · ")}
                  </em>
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
