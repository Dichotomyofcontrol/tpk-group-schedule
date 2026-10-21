"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isStaff, memberCampaigns, upcomingSessions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { coverSrc } from "@/lib/covers";
import { Landing } from "./landing";
import { Hero, PlayRow } from "./schedule";
import { ScheduleBoard } from "./schedule-board";
import { Icon } from "./ui";

export function HomeView() {
  const store = useStore();
  const { state } = store;
  const params = useSearchParams();
  const router = useRouter();
  const schedule = params.get("view") === "schedule";
  const sessions = upcomingSessions(state);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "j") setCursor((n) => Math.min(sessions.length - 1, n + 1));
      if (event.key === "k") setCursor((n) => Math.max(0, n - 1));
      if (event.key === "c" && sessions[cursor]) {
        const session = sessions[cursor];
        const campaign = state.campaigns.find((c) => c.id === session.cid);
        if (!campaign) return;
        const row = session.attendance.find((a) => a.uid === state.me.id);
        store.mark(session.id, state.me.id, row?.state === "out" ? "in" : "out");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessions, cursor, state.campaigns, state.me.id, store]);

  if (!state.me.id) return <Landing />;

  const mine = memberCampaigns(state);
  const next = sessions[0];
  const rest = sessions.slice(1);
  const poll = state.polls.find((p) => p.status === "open" && mine.some((c) => c.id === p.cid));
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: state.me.tz || "America/Los_Angeles" }).format(new Date());
  const staff = mine.some((c) => isStaff(state, c.id));
  const setView = (next: "next" | "schedule") => {
    const query = new URLSearchParams(params.toString());
    if (next === "schedule") query.set("view", "schedule");
    else query.delete("view");
    const text = query.toString();
    router.replace(text ? `/?${text}` : "/", { scroll: false });
  };

  return (
    <>
      <div className="ptitle">
        <div>
          <div className="eyebrow">{schedule ? `Next 3 months · ${mine.length} table${mine.length === 1 ? "" : "s"}` : today}</div>
          <h1 className="lt">Play dates</h1>
        </div>
        {(staff || state.me.canCreateCampaigns) && (
          <Link className="btn sec sm" href="/campaigns/new"><Icon name="plus" className="ic sm" />New</Link>
        )}
      </div>
      <nav className="vseg" aria-label="View">
        <button type="button" className={schedule ? "" : "on"} aria-current={schedule ? undefined : "page"} onClick={() => setView("next")}>Up next</button>
        <button type="button" className={schedule ? "on" : ""} aria-current={schedule ? "page" : undefined} onClick={() => setView("schedule")}>Schedule</button>
      </nav>
      {schedule ? <ScheduleBoard /> : (
      <>
      {mine.length === 0 && (
        <div className="card ph-poll">
          <h2>You&apos;re signed in</h2>
          <p className="note">Ask your organizer for an invite link. You&apos;ll only see the tables you&apos;re on.</p>
          {state.me.canCreateCampaigns && <Link className="btn pri sm" href="/campaigns/new"><Icon name="plus" className="ic sm" />Create your first campaign</Link>}
        </div>
      )}
      <div className="grid">
        <div>
          {next && <Hero session={next} />}
          {sessions.length === 0 && mine.length > 0 && (
            <div className="card ph-poll"><h3>No play dates yet</h3><p className="note">When an organizer sets the cadence, the nights show up here.</p></div>
          )}
          {rest.length > 0 && (
            <>
              <div className="sec-h"><h2>Coming up</h2><span className="note">Everyone&apos;s in unless marked out</span></div>
              <div className="card list">
                {rest.map((session, i) => <PlayRow key={session.id} session={session} current={i + 1 === cursor} />)}
              </div>
            </>
          )}
        </div>
        <aside className="side">
          {poll && (
            <div className="card" style={{ padding: 24 }}>
              <div className="eyebrow">Open poll</div>
              <h3 style={{ fontSize: 20, lineHeight: "26px", margin: "8px 0" }}>{poll.title}</h3>
              <p className="note" style={{ margin: "0 0 16px" }}>{Object.keys(poll.votes).length} voted{poll.closesAt ? ` · closes ${new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: state.me.tz }).format(new Date(poll.closesAt))}` : ""}</p>
              <Link className="btn sec sm" href={`/polls/${poll.id}`}>Vote <Icon name="arrow" className="ic sm" /></Link>
            </div>
          )}
          <div className="card" style={{ padding: 24, marginTop: poll ? 16 : 0 }}>
            <div className="eyebrow">Your campaigns</div>
            {mine.map((c) => {
              const member = (state.members[c.id] || []).find((m) => m.id === state.me.id);
              const nights = state.sessions.filter((s) => s.cid === c.id && s.status !== "cancelled").length;
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="rail-link">
                  <span className="thumb"><img className="art" src={coverSrc(c.cover.src, c.id)} alt="" /></span>
                  <span><b style={{ font: "500 16px var(--serif)" }}>{c.name}</b><br /><span className="note">{member?.role === "organizer" ? "GM" : "Player"} · {nights} sessions</span></span>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
      </>
      )}
    </>
  );
}
