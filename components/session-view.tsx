"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { campaignById, isStaff, membersOf, pastSessions } from "@/lib/model";
import { excerpt, hasRecap, recapPlain } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatRangePretty } from "@/lib/time";
import { googleEventTemplate } from "@/lib/ics";
import { RecapSection } from "./recap-section";
import { NightTools, PartyChips, RsvpControl, sessionHref, shortCount } from "./schedule";
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

  return (
    <>
      <BackBar href={back.href} label={back.label} />
      <div className="eyebrow ver">{when.dow} {when.mon} {when.day}{status ? ` · ${status}` : ""}</div>
      <h1 className="lt">{session.title}</h1>
      <p className="meta">
        <Link className="cl" href={`/campaigns/${cid}`}><i className="dot" style={{ background: campaign.color }} />{campaign.name}</Link>
        <span className="mg"><Icon name="clock" className="ic sm" />{formatRangePretty(session.startsAt, session.endsAt, session.tz)}</span>
        {session.location && <span className="mg"><Icon name="pin" className="ic sm" />{session.location}</span>}
      </p>
      <div className="sgrid">
        <div className="scol">
          <section className="card pad" aria-labelledby="who-h">
            <div className="sh">
              <h2 id="who-h">{past ? "Who played" : "Who\u2019s coming"}</h2>
              <span className={count.warn ? "status warn" : "status"}>{count.text}</span>
            </div>
            <PartyChips session={session} />
            <RsvpControl session={session} />
          </section>
          {past ? (
            <RecapSection session={session} />
          ) : previous ? (
            <section className="card pad prev">
              <div className="eyebrow">Previously · {previous.title}</div>
              <p>{excerpt(recapPlain(previous), 220) || "The recap is a PDF."}</p>
              <Link className="lnk" href={sessionHref(previous)}>Read the recap <Icon name="arrow" className="ic sm" /></Link>
            </section>
          ) : null}
        </div>
        {!past && (session.status !== "cancelled" || staff) ? (
          <aside className="card side-actions">
            {!past && session.status !== "cancelled" && (
              <a className="btn sec sm full" href={googleEventTemplate(session, campaign)} target="_blank" rel="noopener noreferrer"><Icon name="dates" className="ic sm" />Add to calendar</a>
            )}
            <NightTools session={session} />
          </aside>
        ) : null}
      </div>
    </>
  );
}
