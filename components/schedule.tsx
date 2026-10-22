"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { attendanceState, headcount, isGreyed, sessionRequiresRsvp } from "@/lib/attendance";
import { campaignById, isStaff, membersOf , sessionTitle } from "@/lib/model";
import { useStore } from "@/lib/store";
import { daysUntil, formatDayHeading, formatTime, hmInZone, relativeWhen, ymdInZone } from "@/lib/time";
import type { Campaign, Member, Session } from "@/lib/types";
import { Avatar, CampaignCover, DateBlock, Icon, useMapsHref } from "./ui";

export function shortCount(campaign: Campaign, session: Session, members: Member[]): { text: string; warn: boolean } {
  const h = headcount(campaign, session, members);
  if (sessionRequiresRsvp(campaign, session)) {
    return { text: `${h.inn} of ${h.total} going`, warn: h.inn < h.total };
  }
  if (h.out === 0) return { text: `All ${h.total} in`, warn: false };
  return { text: `${h.inn} of ${h.total} in`, warn: true };
}

/** "Game's on" once the campaign's minimum is in; otherwise how many more are needed. Null when not tracked. */
export function quorumLine(campaign: Campaign, session: Session, members: Member[]): { text: string; ok: boolean } | null {
  const need = campaign.quorum || 0;
  if (need < 2 || session.status === "cancelled") return null;
  const h = headcount(campaign, session, members);
  if (h.inn >= need) return { text: "Game\u2019s on", ok: true };
  const more = need - h.inn;
  return { text: `Need ${more} more to play`, ok: false };
}

export function sessionHref(session: Session): string {
  return `/campaigns/${session.cid}/sessions/${session.id}`;
}

/** One line in a month list: typographic date, title, time and place, headcount. */
export function SessionRow({ session, showCampaign = false }: { session: Session; showCampaign?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  const when = formatDayHeading(session.startsAt, session.tz);
  const count = shortCount(campaign, session, members);
  const moved = session.exception === "move" || session.exception === "edit";
  const meId = store.state.me.id;
  const mineState = members.some((m) => m.id === meId) ? attendanceState(campaign, session, meId) : "in";
  return (
    <Link className="srow" href={sessionHref(session)}>
      <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
      <span className="st">
        {showCampaign && <span className="cn"><i className="dot" style={{ background: campaign.color }} /><span className="cnt">{campaign.name}</span></span>}
        <b>{sessionTitle(store.state, session)}</b>
        <span className="note">{formatTime(new Date(session.startsAt), session.tz)}{session.location ? ` · ${session.location}` : ""}{moved ? " · moved" : ""}</span>
        {mineState === "out" && <span className="me-rsvp out">You can&apos;t make it</span>}
        {mineState === "unset" && <span className="me-rsvp ask">Waiting on your RSVP</span>}
      </span>
      <span className={count.warn ? "status warn" : "status"}>{count.text}</span>
    </Link>
  );
}

export function PartyChips({ session }: { session: Session }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  return (
    <div className="party">
      {members.map((m) => {
        const out = isGreyed(campaign, session, m.id);
        const name = m.displayName || m.characterName || "Player";
        return (
          <span key={m.id} className={out ? "pp out" : "pp"} title={m.characterName && m.characterName !== m.displayName ? m.characterName : undefined}>
            <Avatar name={name} id={m.id} />
            <span>{name.split(" ")[0]}{m.characterName && m.characterName !== m.displayName && <small className="pc">{m.characterName.split(" ")[0]}</small>}</span>
          </span>
        );
      })}
    </div>
  );
}

/** I'm in / Can't make it. One control for both RSVP modes. */
/** A tiny haptic tick where the platform supports it (Android). Silent elsewhere. */
function tick() {
  try { navigator.vibrate?.(8); } catch { /* not supported */ }
}

export function RsvpControl({ session }: { session: Session }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const me = store.state.me.id;
  if (!membersOf(store.state, session.cid).some((m) => m.id === me)) return null;
  const mine = attendanceState(campaign, session, me);
  const past = new Date(session.endsAt).getTime() < Date.now();
  if (past || session.status === "cancelled") return null;
  return (
    <div className="seg2" role="group" aria-label="Your RSVP" data-on={mine === "in" || mine === "out" ? mine : undefined}>
      <button type="button" className={mine === "in" ? "on" : ""} aria-pressed={mine === "in"} onClick={() => { tick(); store.mark(session.id, me, "in"); }}>
        <Icon name="check" className="ic sm" />I&apos;m in
      </button>
      <button type="button" className={mine === "out" ? "on out" : ""} aria-pressed={mine === "out"} onClick={() => { tick(); store.mark(session.id, me, "out"); }}>
        Can&apos;t make it
      </button>
    </div>
  );
}

/** The place on Up next opens in Maps; the tap area grows to 44px without moving the line. */
function HeroPlace({ place }: { place: string }) {
  const href = useMapsHref(place);
  return <a className="hplace" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${place}, open in Maps`}>{place}</a>;
}

/** The next session, big. */
export function NextHero({ session, showCampaign = true }: { session: Session; showCampaign?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const when = formatDayHeading(session.startsAt, session.tz);
  const soon = relativeWhen(session.startsAt, store.state.me.tz).toLowerCase();
  const time = formatTime(new Date(session.startsAt), session.tz);
  const q = quorumLine(campaign, session, membersOf(store.state, session.cid));
  return (
    <article className="card hero">
      <Link href={sessionHref(session)} className="hero-cover" aria-label={`Open ${sessionTitle(store.state, session)}`}>
        <CampaignCover campaign={campaign} />
      </Link>
      <div className="hb">
        <div className="eyebrow ver">{daysUntil(session.startsAt, store.state.me.tz) === 0 && <i className="live" aria-hidden="true" />}Up next · {soon}</div>
        <h2><Link href={sessionHref(session)}>{sessionTitle(store.state, session)}</Link></h2>
        <p className="hmeta">{[showCampaign ? campaign.name : "", `${when.dow} ${when.mon} ${when.day}`, time].filter(Boolean).join(" · ")}{session.location && <> · <HeroPlace place={session.location} /></>}</p>
        {q && <p className={q.ok ? "quorum ok" : "quorum need"} role="status"><i className="qdot" aria-hidden="true" />{q.text}</p>}
        <PartyChips session={session} />
        <RsvpControl session={session} />
      </div>
    </article>
  );
}

/** Skip, move or cancel one night. Organizers and co-organizers only. */
export function NightTools({ session }: { session: Session }) {
  const store = useStore();
  const [moving, setMoving] = useState(false);
  if (!isStaff(store.state, session.cid)) return null;
  return (
    <>
      {session.status === "cancelled" ? (
        <button className="btn sec sm full" onClick={() => store.restore(session.id)}>Put this night back</button>
      ) : (
        <>
          <button className="btn sec sm full" onClick={() => setMoving((v) => !v)} aria-expanded={moving}><Icon name="clock" className="ic sm" />Move this night</button>
          <button className="btn sec sm full" onClick={() => { const id = session.id; store.skip(id); store.flash("Night skipped. Everyone sees it's off.", "ok", { label: "Undo", run: () => store.restore(id) }); }}><Icon name="x" className="ic sm" />Skip this night</button>
        </>
      )}
      {moving && <MoveForm session={session} onDone={() => setMoving(false)} />}
    </>
  );
}

function MoveForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const store = useStore();
  const [ymd, setYmd] = useState(ymdInZone(new Date(session.startsAt), session.tz));
  const [hm, setHm] = useState(hmInZone(new Date(session.startsAt), session.tz));
  const [place, setPlace] = useState(session.location);
  const ref = useRef<HTMLFormElement>(null);
  // The form opens below the fold on a phone; bring it into view so the tap visibly does something.
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []);
  return (
    <form ref={ref} className="mform" onSubmit={(e) => { e.preventDefault(); store.move(session.id, ymd, hm, place); onDone(); }}>
      <div className="fld"><label htmlFor="mv-d">Date</label><input id="mv-d" type="date" required value={ymd} onChange={(e) => setYmd(e.target.value)} /></div>
      <div className="fld"><label htmlFor="mv-t">Time</label><input id="mv-t" type="time" required value={hm} onChange={(e) => setHm(e.target.value)} /></div>
      <div className="fld"><label htmlFor="mv-p">Place</label><input id="mv-p" value={place} onChange={(e) => setPlace(e.target.value)} /></div>
      <button className="btn pri sm" type="submit">Move just this night</button>
    </form>
  );
}
