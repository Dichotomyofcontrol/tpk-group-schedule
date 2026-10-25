"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { displayTitle, memberCampaigns, pastSessions } from "@/lib/model";
import { hasRecap } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { formatMonthLabel } from "@/lib/time";
import type { Session } from "@/lib/types";
import { NextHero, SessionRow, sessionHref } from "./schedule";
import { Icon, Skeleton } from "./ui";
import { HomeScreenHint } from "./home-hint";
import { GettingStarted } from "./getting-started";
import { CampaignPicker } from "./campaign-picker";
import { TpkAssign } from "./tpk-assign";

/** Sessions: the next one as the hero, then every later one grouped by month. Filter by campaign. */
export function SessionsView() {
  const { state } = useStore();
  const mine = memberCampaigns(state);
  const [filter, setFilter] = useState<string>("all");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const flipOrder = () => {
    const o = order === "asc" ? "desc" : "asc";
    setOrder(o);
    window.sessionStorage.setItem("tpk-order", o);
  };
  const [view, setView] = useState<"recent" | "history">("recent");
  useEffect(() => {
    // ?campaign=<id> (from a campaign's "See all sessions") picks that campaign; otherwise the last choice.
    const linked = new URLSearchParams(window.location.search).get("campaign");
    const saved = linked || window.sessionStorage.getItem("tpk-filter");
    if (linked) window.sessionStorage.setItem("tpk-filter", linked);
    if (saved) setFilter(saved);
    if (window.sessionStorage.getItem("tpk-view") === "history") setView("history");
    if (window.sessionStorage.getItem("tpk-order") === "desc") setOrder("desc");
  }, []);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setOpenMap(JSON.parse(window.sessionStorage.getItem("tpk-months") || "{}")); } catch {}
  }, []);
  const chooseView = (v: "recent" | "history") => {
    setView(v);
    window.sessionStorage.setItem("tpk-view", v);
  };
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
  // Nights from the last 14 days stay on the list, above what's coming, until they age out. "All sessions" shows every past night.
  const history = view === "history";
  const recent = state.sessions
    .filter((s) => ids.has(s.cid) && s.status === "scheduled" && new Date(s.endsAt).getTime() < now && (history || new Date(s.startsAt).getTime() >= now - 14 * 86_400_000))
    .filter((s) => active === "all" || s.cid === active)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const months = groupByMonth(rest, state.me.tz || "America/Los_Angeles");
  const all = active === "all";
  const desc = order === "desc";
  const ord = <T,>(xs: T[]) => (desc ? [...xs].reverse() : xs);
  const pastMonths = history ? groupByMonth(recent, state.me.tz || "America/Los_Angeles", true) : []; // past months always carry the year

  // Month groups fold. The nearest month and the last 14 days start open; everything else is a one-line header.
  const isOpen = (key: string, dflt: boolean) => openMap[key] ?? dflt;
  const toggle = (key: string, next: boolean) => {
    setOpenMap((m) => {
      const out = { ...m, [key]: next };
      window.sessionStorage.setItem("tpk-months", JSON.stringify(out));
      return out;
    });
  };
  const jump = (key: string) => {
    toggle(key, true);
    requestAnimationFrame(() => document.getElementById("m-" + key.replace(/\s+/g, "-"))?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };

  return (
    <>
      <div className="ptitle"><div><p className="kicker">The ledger</p><h1 className="lt">Sessions</h1></div></div>
      <HomeScreenHint />
      <GettingStarted />
      <TpkAssign />
      {mine.length > 0 && (
        <div className="ltools">
          <div className="seg" role="group" aria-label="Which sessions">
            <button type="button" className={!history ? "on" : ""} aria-pressed={!history} onClick={() => chooseView("recent")}>Upcoming</button>
            <button type="button" className={history ? "on" : ""} aria-pressed={history} onClick={() => chooseView("history")}>All sessions</button>
          </div>
          <button type="button" className="sortb" onClick={flipOrder} aria-label={desc ? "Sorted newest first. Show oldest first" : "Sorted oldest first. Show newest first"}>
            <Icon name="sort" className="ic sm" />{desc ? "Newest" : "Oldest"}<span className="wide"> first</span>
          </button>
        </div>
      )}
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
      {/* Oldest first: past, Up next, then later months. Newest first flips it; Up next always marks today. */}
      {!desc && <>
      {history && ord(pastMonths).map(([label, list]) => (
        <MonthGroup key={"p" + label} id={"p-" + label} label={label} list={ord(list)} quiet open={isOpen("p-" + label, false)} onToggle={toggle} showCampaign={all && mine.length > 1} />
      ))}
      {history && !state.syncing && mine.length > 0 && recent.length === 0 && (
        <p className="note pempty">No past sessions yet. Recaps live here once you've played.</p>
      )}
      {!history && recent.length > 0 && (
        <MonthGroup id="recent" label="Last 14 days" list={ord(recent)} quiet open={isOpen("recent", true)} onToggle={toggle} showCampaign={all && mine.length > 1} />
      )}
      </>}
      {desc && <>
      {months.length > 1 && (
        <nav className="mjump" aria-label="Jump to month">
          {months.map(([label]) => (
            <button key={label} type="button" onClick={() => jump("f-" + label)}>{shortMonth(label)}</button>
          ))}
        </nav>
      )}
      {ord(months).map(([label, list]) => (
        <MonthGroup key={label} id={"f-" + label} label={label} list={ord(list)} open={isOpen("f-" + label, label === months[0][0])} onToggle={toggle} showCampaign={all && mine.length > 1} />
      ))}
      </>}
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
            <b>{displayTitle(last, state.campaigns.find((c) => c.id === last.cid)?.name || "")}</b>
            <span className="lnk">Read the recap <Icon name="arrow" className="ic sm" /></span>
          </Link>
        );
      })()}
      {!desc && <>
      {months.length > 1 && (
        <nav className="mjump" aria-label="Jump to month">
          {months.map(([label]) => (
            <button key={label} type="button" onClick={() => jump("f-" + label)}>{shortMonth(label)}</button>
          ))}
        </nav>
      )}
      {ord(months).map(([label, list]) => (
        <MonthGroup key={label} id={"f-" + label} label={label} list={ord(list)} open={isOpen("f-" + label, label === months[0][0])} onToggle={toggle} showCampaign={all && mine.length > 1} />
      ))}
      </>}
      {desc && <>
      {history && ord(pastMonths).map(([label, list]) => (
        <MonthGroup key={"p" + label} id={"p-" + label} label={label} list={ord(list)} quiet open={isOpen("p-" + label, false)} onToggle={toggle} showCampaign={all && mine.length > 1} />
      ))}
      {history && !state.syncing && mine.length > 0 && recent.length === 0 && (
        <p className="note pempty">No past sessions yet. Recaps live here once you've played.</p>
      )}
      {!history && recent.length > 0 && (
        <MonthGroup id="recent" label="Last 14 days" list={ord(recent)} quiet open={isOpen("recent", true)} onToggle={toggle} showCampaign={all && mine.length > 1} />
      )}
      </>}
    </>
  );
}

function shortMonth(label: string): string {
  const [m, y] = label.split(" ");
  return y ? `${m.slice(0, 3)} \u2019${y.slice(2)}` : m.slice(0, 3);
}

/** A month in the ledger: a full-width header that folds the rows away, with a count when folded. */
function MonthGroup({ id, label, list, open, onToggle, quiet = false, showCampaign }: { id: string; label: string; list: Session[]; open: boolean; onToggle: (key: string, next: boolean) => void; quiet?: boolean; showCampaign: boolean }) {
  const slug = id.replace(/\s+/g, "-");
  const panel = "mp-" + slug;
  return (
    <section id={"m-" + slug} className={open ? "mgroup open" : "mgroup"} aria-label={label}>
      <h2 className={quiet ? "mhd quiet" : "mhd"}>
        <button type="button" className="mtog" aria-expanded={open} aria-controls={panel} onClick={() => onToggle(id, !open)}>
          <span className="ml">{label}</span>
          {!open && <span className="mc">{list.length} {list.length === 1 ? "session" : "sessions"}</span>}
          <Icon name="chev" className="ic sm mchev" />
        </button>
      </h2>
      {open && (
        <div id={panel} className="card list ledger">
          {list.map((s) => <SessionRow key={s.id} session={s} showCampaign={showCampaign} ledger />)}
        </div>
      )}
    </section>
  );
}

function groupByMonth(list: Session[], tz: string, keepYear = false): [string, Session[]][] {
  const out: [string, Session[]][] = [];
  const thisYear = new Date().getFullYear();
  for (const s of list) {
    const full = formatMonthLabel(s.startsAt, tz);
    const label = !keepYear && full.endsWith(String(thisYear)) ? full.replace(` ${thisYear}`, "") : full;
    const last = out[out.length - 1];
    if (last && last[0] === label) last[1].push(s);
    else out.push([label, [s]]);
  }
  return out;
}
