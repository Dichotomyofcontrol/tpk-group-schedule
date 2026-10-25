"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { memberCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";
import { NextHero, SessionRow } from "./schedule";
import { Icon, Skeleton } from "./ui";
import { HomeScreenHint } from "./home-hint";
import { GettingStarted } from "./getting-started";
import { CampaignPicker } from "./campaign-picker";
import { TpkAssign } from "./tpk-assign";

/** Sessions: the next night on top, then one list split into Upcoming and Past. */
export function SessionsView() {
  const { state } = useStore();
  const mine = memberCampaigns(state);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get("campaign");
    const saved = linked || window.sessionStorage.getItem("tpk-filter");
    if (linked) window.sessionStorage.setItem("tpk-filter", linked);
    if (saved) setFilter(saved);
  }, []);
  const choose = (id: string) => {
    setFilter(id);
    window.sessionStorage.setItem("tpk-filter", id);
  };
  const ids = new Set(mine.map((c) => c.id));
  const active = filter !== "all" && ids.has(filter) ? filter : "all";
  const now = Date.now();
  const inView = (session: Session) => ids.has(session.cid) && session.status === "scheduled" && (active === "all" || session.cid === active);
  const upcoming = state.sessions
    .filter((session) => inView(session) && new Date(session.endsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = state.sessions
    .filter((session) => inView(session) && new Date(session.endsAt).getTime() < now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const [next, ...later] = upcoming;
  const showCampaign = active === "all" && mine.length > 1;

  return (
    <>
      <div className="ptitle"><h1 className="lt">Sessions</h1></div>
      <HomeScreenHint />
      <GettingStarted />
      <TpkAssign />
      {mine.length > 1 && (
        <CampaignPicker campaigns={mine} value={active} onChange={choose} />
      )}
      {state.syncing && <Skeleton />}
      {!state.syncing && mine.length === 0 && (
        <div className="card empty-card">
          <h2>{state.me.canCreateCampaigns ? "No sessions yet" : "You're not at a table yet"}</h2>
          <p className="note">{state.me.canCreateCampaigns ? "Start a campaign and its sessions show up here." : "Ask your organizer for an invite link. You'll only see the campaigns you're in."}</p>
          <div className="eacts">
            {state.me.canCreateCampaigns && <Link className="btn pri sm" href="/campaigns/new">Start a campaign</Link>}
            <Link className="lnk" href="/help">How it works <Icon name="arrow" className="ic sm" /></Link>
          </div>
        </div>
      )}
      {!state.syncing && mine.length > 0 && !next && (
        <div className="card empty-card">
          <h2>No sessions coming up</h2>
          <p className="note">When the organizer sets the usual night or locks a poll, sessions show up here.</p>
        </div>
      )}
      {next && <NextHero session={next} showCampaign={active === "all"} />}
      {later.length > 0 && (
        <section className="slist" aria-label="Upcoming sessions">
          <div className="sh secth"><h2>Upcoming</h2></div>
          <div className="card list">
            {later.map((session) => <SessionRow key={session.id} session={session} showCampaign={showCampaign} />)}
          </div>
        </section>
      )}
      {mine.length > 0 && (
        <section className="slist" aria-label="Past sessions, newest first">
          <div className="sh secth">
            <h2>Past</h2>
            <span className="note">Newest first</span>
          </div>
          {past.length > 0 ? (
            <div className="card list ledger past-list">
              {past.map((session) => <SessionRow key={session.id} session={session} showCampaign={showCampaign} ledger />)}
            </div>
          ) : (
            !state.syncing && <p className="note pempty">No past sessions yet. Recaps live here once you&apos;ve played.</p>
          )}
        </section>
      )}
    </>
  );
}
