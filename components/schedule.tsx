"use client";

import Link from "next/link";
import { useState } from "react";
import { attendanceState, headcountLabel, isGreyed, seatsLeft, sessionRequiresRsvp } from "@/lib/attendance";
import { accentInk, textOn } from "@/lib/color";
import { campaignById, membersOf, snackName } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatRangePretty, relativeWhen, zoneLong } from "@/lib/time";
import { googleEventTemplate } from "@/lib/ics";
import type { Session } from "@/lib/types";
import { coverArt } from "@/lib/covers";
import { Stack } from "./faces";

export function PlayRow({ session, manage = false }: { session: Session; manage?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  const mine = attendanceState(campaign, session, store.state.me.id);
  const grey = new Set(members.filter((m) => isGreyed(campaign, session, m.id)).map((m) => m.id));
  const maybe = new Set(members.filter((m) => attendanceState(campaign, session, m.id) === "maybe").map((m) => m.id));
  const when = formatDayHeading(session.startsAt, session.tz);
  const seats = seatsLeft(campaign, session, members);
  const [open, setOpen] = useState(false);
  const [move, setMove] = useState(false);
  return (
    <article id={session.id} className="pd" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${coverArt(campaign.cover.src)})`, ["--ink-on" as string]: textOn(campaign.color), ["--accent" as string]: accentInk(campaign.color) }}>
      <span className="ribbon" aria-hidden="true" />
      <div className="tile"><small>{when.dow}</small><b>{when.day}</b><small>{when.mon}</small></div>
      <div className="cov" role="img" aria-label="" />
      <div className="inf">
        <div className="kick">{campaign.name}</div>
        <h3><Link href={`/campaigns/${session.cid}/sessions/${session.id}`}>{session.title}</Link></h3>
        <p>{formatRangePretty(session.startsAt, session.endsAt, session.tz)} · {session.location}</p>
        {seats !== null && <p>{seats} seat{seats === 1 ? "" : "s"} left</p>}
        {manage && <StaffTools session={session} move={move} setMove={setMove} />}
      </div>
      <div className="act">
        <AttendanceControl session={session} mine={mine} open={open} setOpen={setOpen} />
        <Stack members={members} grey={grey} maybe={maybe} color={campaign.color} />
        <span className="hc">{headcountLabel(campaign, session, members)}</span>
      </div>
    </article>
  );
}

function AttendanceControl({
  session,
  mine,
  open,
  setOpen,
}: {
  session: Session;
  mine: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid)!;
  const rsvp = sessionRequiresRsvp(campaign, session);
  if (rsvp && mine === "unset") {
    return (
      <span className="row-actions">
        <button className="b" onClick={() => store.mark(session.id, store.state.me.id, "in")}>Going</button>
        <button className="b" onClick={() => store.mark(session.id, store.state.me.id, "out")}>Can&apos;t</button>
      </span>
    );
  }
  if (mine === "out") {
    return <button className="b" onClick={() => store.mark(session.id, store.state.me.id, "in")}>I&apos;m back in</button>;
  }
  return (
    <>
      {!rsvp && mine === "in" && <span className="chip y">You&apos;re in</span>}
      {mine === "maybe" && <span className="chip w">Maybe</span>}
      {rsvp && mine === "in" && <span className="chip y">Going</span>}
      <button className="b p" onClick={() => setOpen(!open)}>{open ? "Close" : "Can't make it"}</button>
      {open && <CantSheet session={session} onClose={() => setOpen(false)} />}
    </>
  );
}

function CantSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const store = useStore();
  const [note, setNote] = useState("");
  const members = membersOf(store.state, session.cid);
  const staff = members.find((m) => m.id === store.state.me.id);
  const canMarkOthers = staff?.role === "organizer" || staff?.role === "coorganizer";
  return (
    <div className="sheet" style={{ gridColumn: "1 / -1" }}>
      <b>Can&apos;t make this one?</b>
      <p className="tz" style={{ marginTop: 4 }}>The game still happens. Your portrait goes grey so the table can see it. Talk it through in Discord if you want.</p>
      <button className="opt" onClick={() => { store.mark(session.id, store.state.me.id, "out", note || undefined); onClose(); }}>
        <span>🎲</span>
        <span><b>Play without me</b><span className="tz">Marks you out. Everyone else stays assumed in.</span></span>
      </button>
      <div className="field">
        <label htmlFor={`note-${session.id}`}>Note for the organizer (optional)</label>
        <input id={`note-${session.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What your character does off-screen" />
      </div>
      {canMarkOthers && (
        <div className="field">
          <label>Mark someone else out</label>
          <div className="row-actions">
            {members.filter((m) => m.id !== store.state.me.id).map((m) => {
              const campaign = campaignById(store.state, session.cid)!;
              const state = attendanceState(campaign, session, m.id);
              return (
                <button key={m.id} className="b" onClick={() => store.mark(session.id, m.id, state === "out" ? "in" : "out")}>
                  {state === "out" ? `Bring ${m.displayName} back` : `${m.displayName} is out`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffTools({ session, move, setMove }: { session: Session; move: boolean; setMove: (v: boolean) => void }) {
  const store = useStore();
  const members = membersOf(store.state, session.cid);
  const me = members.find((m) => m.id === store.state.me.id);
  if (!me || (me.role !== "organizer" && me.role !== "coorganizer")) return null;
  return (
    <div className="manage">
      {session.status === "cancelled" ? (
        <button className="b" onClick={() => store.restore(session.id)}>Put this night back</button>
      ) : (
        <>
          <button className="b" onClick={() => store.skip(session.id)}>Skip this one</button>
          <button className="b" onClick={() => setMove(!move)}>Move this one</button>
          <button className="b" onClick={() => store.cancel(session.id)}>Cancel</button>
        </>
      )}
      {move && <MoveForm session={session} onDone={() => setMove(false)} />}
    </div>
  );
}

function MoveForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const store = useStore();
  const [ymd, setYmd] = useState(session.occurrenceKey || "");
  const [hm, setHm] = useState("18:30");
  const [place, setPlace] = useState(session.location);
  return (
    <form className="sheet" onSubmit={(e) => { e.preventDefault(); store.move(session.id, ymd, hm, place); onDone(); }}>
      <div className="field"><label>New date</label><input type="date" required value={ymd} onChange={(e) => setYmd(e.target.value)} /></div>
      <div className="field"><label>New time</label><input type="time" required value={hm} onChange={(e) => setHm(e.target.value)} /></div>
      <div className="field"><label>Place</label><input value={place} onChange={(e) => setPlace(e.target.value)} /></div>
      <button className="b p" type="submit">Move just this night</button>
    </form>
  );
}

export function Hero({ session }: { session: Session }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  const mine = attendanceState(campaign, session, store.state.me.id);
  const grey = new Set(members.filter((m) => isGreyed(campaign, session, m.id)).map((m) => m.id));
  const snack = snackName(store.state, session);
  const when = formatRangePretty(session.startsAt, session.endsAt, session.tz);
  const [open, setOpen] = useState(false);
  const add = googleEventTemplate(session, campaign);
  return (
    <section className="hero" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${coverArt(campaign.cover.src)})`, ["--accent" as string]: accentInk(campaign.color) }}>
      <div className="art" role="img" aria-label={campaign.cover.credit || campaign.name} />
      <div className="tx">
        <div className="kick">Next session · {relativeWhen(session.startsAt, store.state.me.tz).toLowerCase()}</div>
        <h2>{campaign.name}</h2>
        <div>{session.title}</div>
        <p className="big" style={{ margin: "10px 0 0" }}>{when}</p>
        <div className="tz">{zoneLong(session.tz)} · shown in your time zone</div>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          {session.location}
          {snack ? ` · Snacks: ${snack}` : ""}
        </p>
        <div style={{ margin: "10px 0" }}>
          <Stack members={members} grey={grey} color={campaign.color} />
          <div className="hc" style={{ marginTop: 6 }}>{headcountLabel(campaign, session, members)}</div>
        </div>
        {campaign.previouslyOn && (
          <Link className="prev" href={campaign.previouslyOnSessionId ? `/campaigns/${campaign.id}/sessions/${campaign.previouslyOnSessionId}` : `/campaigns/${campaign.id}`}>
            <q>{campaign.previouslyOn}</q>
            <cite>Previously on {campaign.name}</cite>
          </Link>
        )}
        <div className="actions" style={{ marginTop: 10 }}>
          {mine === "out" ? (
            <button className="b" onClick={() => store.mark(session.id, store.state.me.id, "in")}>I&apos;m back in</button>
          ) : (
            <>
              <span className="chip y">{sessionRequiresRsvp(campaign, session) ? "Going" : "You're in"}</span>
              <button className="b p" onClick={() => setOpen((v) => !v)}>Can&apos;t make it</button>
            </>
          )}
          <a className="b" href={add}>Add to calendar</a>
        </div>
        {open && <CantSheet session={session} onClose={() => setOpen(false)} />}
      </div>
    </section>
  );
}

export function NeedsYou() {
  const { state } = useStore();
  const campaigns = new Set(state.campaigns.filter((c) => (state.members[c.id] || []).some((m) => m.id === state.me.id)).map((c) => c.id));
  const polls = state.polls.filter((p) => p.status === "open" && campaigns.has(p.cid));
  const invites = state.invites.filter((i) => i.status === "pending" && (!i.email || i.email === state.me.email) && !campaigns.has(i.cid));
  const rsvp = state.sessions.filter((s) => {
    if (!campaigns.has(s.cid) || s.status !== "scheduled") return false;
    const campaign = campaignById(state, s.cid);
    if (!campaign || !sessionRequiresRsvp(campaign, s)) return false;
    return attendanceState(campaign, s, state.me.id) === "unset";
  });
  if (!polls.length && !invites.length && !rsvp.length) return null;
  return (
    <div className="todo">
      <b>Needs you: </b>
      {polls.map((p) => <span key={p.id}> <Link href={`/polls/${p.id}`}><u>Vote on {p.title}</u></Link></span>)}
      {invites.map((i) => {
        const name = state.campaigns.find((c) => c.id === i.cid)?.name ?? "a campaign";
        return <span key={i.token}> · <Link href={`/invite/${i.token}`}><u>{name} invite</u></Link></span>;
      })}
      {rsvp.length > 0 && <span> · RSVP for {rsvp.length} session{rsvp.length === 1 ? "" : "s"}</span>}
    </div>
  );
}
