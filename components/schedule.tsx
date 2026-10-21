"use client";

import Link from "next/link";
import { useState } from "react";
import { attendanceState, headcountLabel, isGreyed, seatsLeft, sessionRequiresRsvp } from "@/lib/attendance";
import { isStaff, campaignById, membersOf } from "@/lib/model";
import { coverSrc } from "@/lib/covers";
import { useStore } from "@/lib/store";
import { daysUntil, formatDayHeading, formatRangePretty, relativeWhen } from "@/lib/time";
import { googleEventTemplate } from "@/lib/ics";
import type { Session } from "@/lib/types";
import { Avatar, DateBlock, Icon } from "./ui";

export function PlayRow({ session, manage = false, current = false }: { session: Session; manage?: boolean; current?: boolean }) {
  const store = useStore();
  const campaign = campaignById(store.state, session.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, session.cid);
  const grey = new Set(members.filter((m) => isGreyed(campaign, session, m.id)).map((m) => m.id));
  const when = formatDayHeading(session.startsAt, session.tz);
  const seats = seatsLeft(campaign, session, members);
  const label = headcountLabel(campaign, session, members);
  const [move, setMove] = useState(false);
  const outs = grey.size > 0;
  return (
    <div id={session.id}>
      <Link className="row" href={`/campaigns/${session.cid}/sessions/${session.id}`} aria-current={current ? "true" : undefined}>
        <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
        <div className="t">
          <b>{session.title}</b>
          <span>{formatRangePretty(session.startsAt, session.endsAt, session.tz)} · {session.location}{seats !== null ? ` · ${seats} seats left` : ""}</span>
          <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
            <span className="stack">
              {members.slice(0, 6).map((m) => <Avatar key={m.id} name={m.characterName || m.displayName} id={m.id} out={grey.has(m.id)} />)}
            </span>
            <span className={outs ? "status warn" : "status"}>{label}</span>
          </div>
        </div>
        <div className="thumb"><img className="art" src={coverSrc(campaign.cover.src, campaign.id)} alt="" /></div>
      </Link>
      {manage && <div style={{ padding: "0 20px 12px" }}><StaffTools session={session} move={move} setMove={setMove} /></div>}
    </div>
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
      <button className="btn pri sm" onClick={() => { store.mark(session.id, store.state.me.id, "out", note || undefined); onClose(); }}>
        Play without me
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
  const when = formatDayHeading(session.startsAt, session.tz);
  const range = formatRangePretty(session.startsAt, session.endsAt, session.tz);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const staff = isStaff(store.state, campaign.id);
  const counts = headcountLabel(campaign, session, members);
  const outNames = members.filter((m) => grey.has(m.id)).map((m) => m.displayName);
  const days = daysUntil(session.startsAt, session.tz);
  const soon = days < 0 ? "earlier" : relativeWhen(session.startsAt, store.state.me.tz).toLowerCase();
  const add = googleEventTemplate(session, campaign);
  return (
    <article className="card next">
      <span className="ribbon" />
      <div className="cover">
        <img className="art" src={coverSrc(campaign.cover.src, campaign.id)} alt="" />
        <div className="ctop">
          <div className="eyebrow">Up next · {soon}</div>
          <h2>{campaign.name}</h2>
        </div>
      </div>
      <div className="nb">
        <div className="when">
          <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
          <span className="vr" />
          <div className="meta">
            <div><Icon name="clock" />{range}</div>
            <div><Icon name="pin" />{session.location}</div>
            <div><Icon name="quill" />{session.title}</div>
          </div>
        </div>
        <hr className="hair" />
        <div>
          <div className="ph">
            <span className={grey.size ? "status warn" : "status"}>{counts.replace(/ in$/, " attending")}</span>
            {outNames.length > 0 && <span className="note">{outNames.join(", ")} {outNames.length === 1 ? "is" : "are"} out</span>}
          </div>
          <div className="party">
            {members.map((m) => (
              <span key={m.id} className={grey.has(m.id) ? "pp out" : "pp"}>
                <Avatar name={m.displayName} id={m.id} />
                <span>{m.displayName.split(" ")[0]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="acts">
          {mine === "out" ? (
            <button className="btn pri sm" onClick={() => store.mark(session.id, store.state.me.id, "in")}>I&apos;m back in</button>
          ) : (
            <button className="btn pri sm" onClick={() => { setOpen((v) => !v); setMarking(false); }}><Icon name="x" className="ic sm" />I can&apos;t make it</button>
          )}
          {staff && <button className="btn ghost sm" onClick={() => { setMarking((v) => !v); setOpen(true); }}>Mark someone out</button>}
          <a className="btn ghost sm" href={add}>Add to calendar</a>
        </div>
        {(open || marking) && <CantSheet session={session} onClose={() => { setOpen(false); setMarking(false); }} />}
      </div>
    </article>
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
