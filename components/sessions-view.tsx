"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { memberCampaigns, pastSessions, sessionTitle } from "@/lib/model";
import { hasRecap } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { formatMonthLabel } from "@/lib/time";
import type { Session } from "@/lib/types";
import { NextHero, SessionRow, sessionHref } from "./schedule";
import { Icon, Skeleton } from "./ui";
import { HomeScreenHint } from "./home-hint";

/** Sessions: the next one as the hero, then every later one grouped by month. Filter by campaign. */
export function SessionsView() {
  const { state } = useStore();
  const mine = memberCampaigns(state);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    const saved = window.sessionStorage.getItem("tpk-filter");
    if (saved) setFilter(saved);
  }, []);
  const choose = (id: string) => {
    setFilter(id);
    window.sessionStorage.setItem("tpk-filter", id);
  };
  const ids = new Set(mine.map((c) => c.id));
  const active = filter !== "all" && ids.has(filter) ? filter : "all";
  const now = Date.now();
  const sessions = state.sessions
    .filter((s) => ids.has(s.cid) && s.status === "scheduled" && new Date(s.endsAt).getTime() >= now)
    .filter((s) => active === "all" || s.cid === active)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const [next, ...rest] = sessions;
  const months = groupByMonth(rest, state.me.tz || "America/Los_Angeles");
  const all = active === "all";

  return (
    <>
      <div className="ptitle"><h1 className="lt">Sessions</h1></div>
      <HomeScreenHint />
      {mine.length > 1 && (
        <div className="fchips" role="group" aria-label="Filter by campaign">
          <button type="button" className={all ? "fchip on" : "fchip"} aria-pressed={all} onClick={() => choose("all")}>All</button>
          {mine.map((c) => (
            <button key={c.id} type="button" className={active === c.id ? "fchip on" : "fchip"} aria-pressed={active === c.id} onClick={() => choose(c.id)}>
              <i className="dot" style={{ background: c.color }} />{c.name}
            </button>
          ))}
        </div>
      )}
      {state.syncing && <Skeleton />}
      {!state.syncing && mine.length === 0 && (
        <div className="card empty-card">
          <h2>{state.me.canCreateCampaigns ? "No sessions yet" : "You're not at a table yet"}</h2>
          <p className="note">{state.me.canCreateCampaigns ? "Start a campaign and its sessions show up here." : "Ask your organizer for an invite link. You'll only see the campaigns you're in."}</p>
          {state.me.canCreateCampaigns && <Link className="btn pri sm" href="/campaigns/new">Start a campaign</Link>}
        </div>
      )}
      {!state.syncing && mine.length > 0 && !next && (
        <div className="card empty-card">
          <h2>No sessions coming up</h2>
          <p className="note">When the organizer sets the usual night or locks a poll, sessions show up here.</p>
        </div>
      )}
      {next && <NextHero session={next} showCampaign={all} />}
      {next && (() => {
        // Continuity: the most recent recap for the next night's campaign, if it's from the last 6 weeks.
        const last = pastSessions(state, next.cid).find((s) => hasRecap(s));
        if (!last || now - new Date(last.endsAt).getTime() > 42 * 86_400_000) return null;
        return (
          <Link className="lasttime" href={sessionHref(last)}>
            <span className="note">Last time</span>
            <b>{sessionTitle(state, last)}</b>
            <span className="lnk">Read the recap <Icon name="arrow" className="ic sm" /></span>
          </Link>
        );
      })()}
      {months.map(([label, list]) => (
        <section key={label} aria-label={label}>
          <h2 className="mhd">{label}</h2>
          <div className="card list ledger">
            {list.map((s) => <SessionRow key={s.id} session={s} showCampaign={all && mine.length > 1} ledger />)}
          </div>
        </section>
      ))}
    </>
  );
}

function groupByMonth(list: Session[], tz: string): [string, Session[]][] {
  const out: [string, Session[]][] = [];
  const thisYear = new Date().getFullYear();
  for (const s of list) {
    const full = formatMonthLabel(s.startsAt, tz);
    const label = full.endsWith(String(thisYear)) ? full.replace(` ${thisYear}`, "") : full;
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(s);
    else out.push([label, [s]]);
  }
  return out;
}
