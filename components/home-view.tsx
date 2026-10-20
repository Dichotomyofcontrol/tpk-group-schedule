"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { memberCampaigns, upcomingSessions, visibleCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import { groupStats } from "@/lib/stats";
import { formatMonthLabel } from "@/lib/time";
import { accentInk } from "@/lib/color";
import { EmptyState } from "./empty-state";
import { Hero, NeedsYou, PlayRow } from "./schedule";

export function HomeView() {
  const store = useStore();
  const { state } = store;
  const sessions = upcomingSessions(state);
  const [cursor, setCursor] = useState(0);
  const stats = groupStats(state.sessions.filter((s) => memberCampaigns(state).some((c) => c.id === s.cid)));

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

  const mine = memberCampaigns(state);
  const next = sessions[0];
  const hidden = mine.filter((c) => state.hiddenCids.includes(c.id));

  const groups: { label: string; items: typeof sessions }[] = [];
  for (const session of sessions) {
    const label = formatMonthLabel(session.startsAt, session.tz);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, items: [session] });
    else last.items.push(session);
  }

  return (
    <>
      <div className="cfilter mobile-only">
        {mine.map((c) => {
          const on = !state.hiddenCids.includes(c.id);
          return (
            <button key={c.id} style={{ ["--c" as string]: c.color, ["--accent" as string]: accentInk(c.color) }} aria-pressed={on} onClick={() => store.toggleHidden(c.id)}>
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="mh">
        <h1>Your play dates</h1>
        {stats.streak > 1 && <span className="chip">{stats.streak}-session streak</span>}
      </div>
      {!state.me.id && (
        <EmptyState title="Your table awaits" action={<Link className="b p" href="/signin">Sign in</Link>}>
          Sign in with the email your organizer knows. We&apos;ll send a one-tap link. No password.
        </EmptyState>
      )}
      {state.me.id && mine.length === 0 && (
        <EmptyState
          title="You're signed in"
          action={state.me.canCreateCampaigns ? <Link className="b p" href="/campaigns/new">Create your first campaign</Link> : undefined}
        >
          Ask your organizer for an invite link. You&apos;ll only see the tables you&apos;re on.
        </EmptyState>
      )}
      {next && <Hero session={next} />}
      <NeedsYou />
      {sessions.length > 0 && (
        <div className="pstrip" aria-label="Upcoming play dates">
          {sessions.slice(0, 10).map((session, i) => {
            const campaign = state.campaigns.find((c) => c.id === session.cid);
            const when = new Date(session.startsAt);
            const mon = when.toLocaleString("en-US", { month: "short", timeZone: session.tz });
            const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: session.tz }).format(when);
            const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: session.tz }).format(when);
            return (
              <a key={session.id} href={`#${session.id}`} className={i === cursor ? "on" : ""} style={{ ["--c" as string]: campaign?.color }}>
                {dow}<b>{day}</b>{mon}
              </a>
            );
          })}
        </div>
      )}
      {sessions.length === 0 && mine.length > 0 && (
        <div className="card">
          <h2>No play dates yet</h2>
          <p>When an organizer sets the cadence, the nights show up here. Days you don&apos;t play are never shown.</p>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mhd"><span>{group.label}</span><em>{group.items.length} play date{group.items.length === 1 ? "" : "s"}</em></h2>
          {group.items.map((session) => <PlayRow key={session.id} session={session} />)}
        </section>
      ))}
      {state.me.id && (
        <>
          <p className="tz" style={{ textAlign: "center", marginTop: 18 }}>
            Only days you play are shown.
            {hidden.length > 0 && ` ${hidden.map((c) => c.name).join(", ")} hidden (switched off).`}
          </p>
          <p className="tz" style={{ textAlign: "center" }}>
            Showing {visibleCampaigns(state).length} of {mine.length} campaigns.
          </p>
        </>
      )}
    </>
  );
}
