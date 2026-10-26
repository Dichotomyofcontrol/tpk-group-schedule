"use client";
import { NotOnTpkMark } from "./tpk-assign";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { attendanceState, headcount, isGreyed, rsvpPillLabel, rsvpPillToggle, sessionRequiresRsvp } from "@/lib/attendance";
import { campaignById, displayTitle, isStaff, latestRecap, membersOf } from "@/lib/model";
import { hasRecap, markdownToHtml, openingParagraph, readAloudMinutes } from "@/lib/recap";
import { sanitizeRecapHtml } from "@/lib/sanitize";
import { useStore } from "@/lib/store";
import { daysUntil, formatDayHeading, formatTime, hmInZone, relativeWhen, ymdInZone } from "@/lib/time";
import type { Campaign, Member, Session } from "@/lib/types";
import { accentVar, worldFor } from "@/lib/world";
import type { CSSProperties } from "react";
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

/** List title: the session's own name with any "Session #N" numbering dropped, else the campaign name. */
export function ledgerTitle(session: Session, campaignName: string): string {
  return displayTitle(session, campaignName);
}

/** One line in a month list: typographic date, title, time and place, headcount. */
export function SessionRow({ session, showCampaign = false, ledger = false }: { session: Session; showCampaign?: boolean; ledger?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  const when = formatDayHeading(session.startsAt, session.tz);
  const world = worldFor(campaign);
  const accent = accentVar(campaign) as CSSProperties;
  const count = shortCount(campaign, session, members);
  const moved = session.exception === "move" || session.exception === "edit";
  const meId = store.state.me.id;
  const mineState = members.some((m) => m.id === meId) ? attendanceState(campaign, session, meId) : "in";
  if (ledger && new Date(session.endsAt).getTime() < Date.now()) {
    // A night that already happened: quieter and smaller, and it says whether the recap is in.
    const recap = hasRecap(session);
    return (
      <Link className="srow past" href={sessionHref(session)} data-world={world.id} style={accent}>
        <DateBlock dow={when.dow} day={when.day} />
        <span className="st"><b>{showCampaign && <i className="dot" style={{ background: world.accent }} />}{ledgerTitle(session, campaign.name)}</b></span>
        <span className={recap ? "pst done" : "pst"}><Icon name={recap ? "doc" : "quill"} className="ic sm" />{recap ? "Recap" : isStaff(store.state, session.cid) ? "Add recap" : "No recap yet"}</span>
      </Link>
    );
  }
  return (
    <Link className="srow" href={sessionHref(session)} data-world={world.id} style={accent}>
      <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
      <span className="st">
        {showCampaign && !ledger && <span className="cn"><i className="dot" style={{ background: world.accent }} /><span className="cnt">{campaign.name}</span></span>}
        <b>{ledger ? <>{showCampaign && <i className="dot" style={{ background: world.accent }} />}{ledgerTitle(session, campaign.name)}</> : displayTitle(session, campaign.name)}</b>
        <span className="note">{formatTime(new Date(session.startsAt), session.tz)}{session.location ? ` · ${session.location}` : ""}{moved ? " · moved" : ""}<NotOnTpkMark cid={session.cid} sid={session.id} /></span>
        {mineState === "out" && <span className="me-rsvp out">You can&apos;t make it</span>}
        {mineState === "unset" && <span className="me-rsvp ask">Waiting on your RSVP</span>}
      </span>
      <span className={count.warn ? "status warn" : "status"}>{count.text}</span>
    </Link>
  );
}

export function PartyChips({ session, compact = false }: { session: Session; compact?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  return (
    <div className={compact ? "party avs" : "party"}>
      {members.map((m) => {
        const out = isGreyed(campaign, session, m.id);
        const name = m.displayName || m.characterName || "Player";
        const who = m.characterName && m.characterName !== m.displayName ? `${name}, ${m.characterName}` : name;
        if (compact) {
          return (
            <span key={m.id} className={out ? "avchip out" : "avchip"} title={who} aria-label={out ? `${who}, can't make it` : who}>
              <Avatar name={name} id={m.id} />
            </span>
          );
        }
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

/** A tiny haptic tick where the platform supports it (Android). Silent elsewhere. */
function tick() {
  try { navigator.vibrate?.(8); } catch { /* not supported */ }
}

/** Going / RSVP on the Up next attendee row. Can't make it lives in the small menu. */
function HeroRsvp({ session }: { session: Session }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const me = store.state.me.id;
  const member = !!campaign && membersOf(store.state, session.cid).some((m) => m.id === me);
  const past = new Date(session.endsAt).getTime() < Date.now();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!campaign || !member || past || session.status === "cancelled") return null;
  const mine = attendanceState(campaign, session, me);
  const label = rsvpPillLabel(mine);
  const choose = (state: "in" | "out" | "unset") => {
    tick();
    store.mark(session.id, me, state);
    setOpen(false);
  };
  return (
    <div className={`rsvp ${mine === "in" ? "in" : mine === "out" ? "out" : "ask"}`} ref={ref}>
      <button
        type="button"
        className="go"
        aria-pressed={mine === "in"}
        aria-label={label === "Going" ? "Going" : label === "Can't" ? "Can't make it" : "RSVP"}
        onClick={() => choose(rsvpPillToggle(mine))}
      >
        {mine === "in" && <Icon name="check" className="ic sm" />}
        {label}
      </button>
      <button type="button" className="more" aria-haspopup="menu" aria-expanded={open} aria-label="RSVP options" onClick={() => setOpen((v) => !v)}>
        <Icon name="chev" className="ic sm" />
      </button>
      {open && (
        <div className="rsvp-menu" role="menu">
          <button type="button" role="menuitemradio" aria-checked={mine === "in"} onClick={() => choose("in")}>Going</button>
          <button type="button" role="menuitemradio" aria-checked={mine === "out"} className="out" onClick={() => choose("out")}>Can&apos;t make it</button>
        </div>
      )}
    </div>
  );
}

/** I'm in / Can't make it, on the session page. */
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

/** Read-aloud opener inside the next-session hero. The session field wins; otherwise the latest recap's opening paragraph. */
function PreviouslyOn({ session }: { session: Session }) {
  const store = useStore();
  const own = session.previouslyOn?.trim() || "";
  const source = own ? null : latestRecap(store.state.sessions, session.cid);
  const fallback = !own && source ? openingParagraph(source) : "";
  const text = own || fallback;
  const today = daysUntil(session.startsAt, store.state.me.tz) === 0;
  const [open, setOpen] = useState(today);
  useEffect(() => { setOpen(daysUntil(session.startsAt, store.state.me.tz) === 0); }, [session.id, session.startsAt, store.state.me.tz]);
  if (!text) return null;
  const minutes = readAloudMinutes(text);
  const html = sanitizeRecapHtml(markdownToHtml(text));
  const panel = `prevon-${session.id}`;
  const readout = `${minutes} min read-aloud`;
  return (
    <section className={open ? "prevon open" : "prevon"}>
      <button type="button" className="ptog" aria-expanded={open} aria-controls={panel} aria-label={`Previously on, ${readout}`} onClick={() => setOpen((v) => !v)}>
        <span className="readout">{readout}</span>
        <Icon name="chev" className="ic sm mchev" />
      </button>
      {open && (
        <div id={panel}>
          <div className="prevon-body" dangerouslySetInnerHTML={{ __html: html }} />
          {source && (
            <Link className="prevon-from" href={sessionHref(source)}>
              From {displayTitle(source, campaignById(store.state, source.cid)?.name || "the last session")} <Icon name="arrow" className="ic sm" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
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
  const title = ledgerTitle(session, campaign.name);
  const world = worldFor(campaign);
  return (
    <article className="card hero rise" data-world={world.id} style={accentVar(campaign) as CSSProperties}>
      <Link href={sessionHref(session)} className="hero-cover" aria-label={`Open ${title}`}>
        <CampaignCover campaign={campaign} />
      </Link>
      <div className="hb">
        <div className="eyebrow ver">{daysUntil(session.startsAt, store.state.me.tz) === 0 && <i className="live" aria-hidden="true" />}{world.word} · Up next · {soon}</div>
        <h2><Link href={sessionHref(session)}>{title}</Link></h2>
        <p className="hmeta">{[showCampaign && title !== campaign.name ? campaign.name : "", `${when.dow} ${when.mon} ${when.day}`, time].filter(Boolean).join(" · ")}{session.location && <> · <HeroPlace place={session.location} /></>}</p>
        {q && <p className={q.ok ? "quorum ok" : "quorum need"} role="status"><i className="qdot" aria-hidden="true" />{q.text}</p>}
        <PreviouslyOn session={session} />
        <div className="hero-who">
          <PartyChips session={session} compact />
          <HeroRsvp session={session} />
        </div>
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
