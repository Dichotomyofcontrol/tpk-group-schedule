"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { campaignById, isStaff, membersOf, pastSessions , sessionTitle } from "@/lib/model";
import { excerpt, hasRecap, recapPlain } from "@/lib/recap";
import { markRead } from "@/lib/read-marks";
import { useStore } from "@/lib/store";
import { daysUntil, formatDayHeading, formatRangePretty, relativeWhen } from "@/lib/time";
import { buildIcs, googleEventTemplate } from "@/lib/ics";
import type { Campaign, Session } from "@/lib/types";
import { RecapSection } from "./recap-section";
import { TableNote } from "./table-note";
import { NightTools, PartyChips, quorumLine, RsvpControl, sessionHref, shortCount } from "./schedule";
import { BackBar, Icon } from "./ui";

export function SessionView({ cid, sid }: { cid: string; sid: string }) {
  const store = useStore();
  const { state } = store;
  const campaign = campaignById(state, cid);
  const member = membersOf(state, cid).find((m) => m.id === state.me.id);
  const session = state.sessions.find((s) => s.id === sid && s.cid === cid);
  const [back, setBack] = useState<{ href: string; label: string }>({ href: "/sessions", label: "Sessions" });
  useEffect(() => {
    if (window.sessionStorage.getItem("tpk-from") === "campaigns" && campaign) setBack({ href: `/campaigns/${cid}`, label: campaign.name });
  }, [cid, campaign]);

  const recapped = session && hasRecap(session) ? session : null;
  useEffect(() => { if (recapped && new Date(recapped.endsAt).getTime() < Date.now()) markRead(recapped); }, [recapped]);

  if (!campaign || !member) {
    return (
      <>
        <BackBar href="/sessions" label="Sessions" />
        <div className="card empty-card">
          <h1 className="lt">You&apos;re not at this table</h1>
          <p className="note">Recaps stay with the campaign. Open your invite link if you were asked to join.</p>
          <Link className="btn pri sm" href="/sessions">Go to Sessions</Link>
        </div>
      </>
    );
  }
  if (!session) {
    return (
      <>
        <BackBar href={`/campaigns/${cid}`} label={campaign.name} />
        <div className="card empty-card">
          <h1 className="lt">That session is gone</h1>
          <p className="note">It may have been moved or removed by the organizer.</p>
          <Link className="btn pri sm" href={`/campaigns/${cid}`}>Open {campaign.name}</Link>
        </div>
      </>
    );
  }

  const when = formatDayHeading(session.startsAt, session.tz);
  const past = new Date(session.endsAt).getTime() < Date.now();
  const members = membersOf(state, cid);
  const count = shortCount(campaign, session, members);
  const staff = isStaff(state, cid);
  const previous = !past ? pastSessions(state, cid).find((s) => s.startsAt < session.startsAt && hasRecap(s)) : undefined;
  const status = session.status === "cancelled" ? "Skipped" : "";
  const myTz = state.me.tz || session.tz;
  const soonDays = daysUntil(session.startsAt, myTz);
  const soon = !past && !status && soonDays >= 0 && soonDays <= 6 ? relativeWhen(session.startsAt, myTz) : "";

  return (
    <>
      <BackBar href={back.href} label={back.label} />
      <div className="eyebrow ver">{when.dow} {when.mon} {when.day}{status ? ` · ${status}` : ""}{soon ? ` · ${soon}` : ""}</div>
      <h1 className="lt">{sessionTitle(state, session)}</h1>
      <p className="meta">
        <Link className="cl" href={`/campaigns/${cid}`}><i className="dot" style={{ background: campaign.color }} />{campaign.name}</Link>
        <span className="mg"><Icon name="clock" className="ic sm" />{formatRangePretty(session.startsAt, session.endsAt, session.tz)}</span>
        {session.location && <MapsLink place={session.location} />}
      </p>
      <div className="sgrid">
        <div className="scol">
          <section className="card pad" aria-labelledby="who-h">
            <div className="sh">
              <h2 id="who-h">{past ? "Who played" : "Who\u2019s coming"}</h2>
              {session.status !== "cancelled" && <span className={count.warn ? "status warn" : "status"}>{count.text}</span>}
            </div>
            <PartyChips session={session} />
            {(() => { const q = !past ? quorumLine(campaign, session, members) : null; return q ? <p className={q.ok ? "quorum ok" : "quorum need"} role="status"><i className="qdot" />{q.text}</p> : null; })()}
            <RsvpControl session={session} />
          </section>
          {!past && session.status !== "cancelled" && <TableNote session={session} />}
          {past ? (
            <RecapSection session={session} />
          ) : previous ? (
            <section className="card pad prev">
              <div className="eyebrow">Previously · {sessionTitle(state, previous)}</div>
              <p>{excerpt(recapPlain(previous), 220) || "The recap is a PDF."}</p>
              <Link className="lnk" href={sessionHref(previous)}>Read the recap <Icon name="arrow" className="ic sm" /></Link>
            </section>
          ) : null}
        </div>
        {!past && (session.status !== "cancelled" || staff) ? (
          <aside className="card side-actions">
            {!past && session.status !== "cancelled" && (
              <AddToCalendar session={session} campaign={campaign} />
            )}
            <NightTools session={session} />
          </aside>
        ) : null}
      </div>
    </>
  );
}

/** Apple devices get a real .ics (opens straight into Calendar); everyone else gets Google Calendar. */
function AddToCalendar({ session, campaign }: { session: Session; campaign: Campaign }) {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setApple(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && !/Chrome|Firefox|Edg/.test(ua)));
  }, []);
  if (apple) {
    const ics = buildIcs(campaign.name, [{ session, campaign }]);
    const name = `${campaign.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "session"}.ics`;
    return <a className="btn sec sm full" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={name}><Icon name="dates" className="ic sm" />Add to calendar</a>;
  }
  return <a className="btn sec sm full" href={googleEventTemplate(session, campaign)} target="_blank" rel="noopener noreferrer"><Icon name="dates" className="ic sm" />Add to calendar</a>;
}

/** The place opens in Maps: Apple Maps on Apple devices, Google Maps elsewhere. */
function MapsLink({ place }: { place: string }) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)), []);
  const q = encodeURIComponent(place);
  const href = apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
  return <a className="mg maplink" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${place}, open in Maps`}><Icon name="pin" className="ic sm" />{place}</a>;
}
