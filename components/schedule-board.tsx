"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { attendanceState } from "@/lib/attendance";
import { campaignColors } from "@/lib/campaign-color";
import { coverSrc } from "@/lib/covers";
import { memberCampaigns, myRole } from "@/lib/model";
import { weekdayOfYmd } from "@/lib/recurrence";
import { useStore } from "@/lib/store";
import { addMonthsYmd, formatDayHeading, formatTime, weekdayName, ymdInZone } from "@/lib/time";
import type { AppState, Campaign, Poll, Session } from "@/lib/types";
import { DateBlock } from "./ui";

type Mark = { day: string; night: string; poll: boolean; out: boolean; name: string };

type Item = {
  key: string;
  ymd: string;
  month: string;
  startsAt: string;
  campaign: Campaign;
  poll?: Poll;
  session?: Session;
  times: string[];
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function hueStyle(id: string): CSSProperties {
  const { day, night } = campaignColors(id);
  return { "--cc-day": day, "--cc-night": night } as CSSProperties;
}

function roleLabel(state: AppState, campaignId: string): string {
  const role = myRole(state, campaignId);
  if (role === "organizer") return "GM";
  if (role === "coorganizer") return "Co-organizer";
  return "Player";
}

export function ScheduleBoard() {
  const store = useStore();
  const { state } = store;
  const tz = state.me.tz || "America/Los_Angeles";
  const today = ymdInZone(new Date(), tz);
  const origin = monthStart(today);
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  const [filter, setFilter] = useState("all");
  const [flash, setFlash] = useState("");
  const prepend = useRef(false);
  const prevHeight = useRef(0);
  const laterRef = useRef<HTMLButtonElement>(null);
  const earlierLock = useRef(false);
  const laterLock = useRef(false);
  const grown = useRef({ after: 0, count: 0 });

  const mine = memberCampaigns(state);
  const start = addMonthsYmd(origin, -before);
  const end = addMonthsYmd(origin, 4 + after);
  const overviewStart = origin;

  const campaigns = filter === "all" ? mine : mine.filter((c) => c.id === filter);

  const items = useMemo(() => {
    const floor = start < origin ? start : today;
    const allowed = new Set(campaigns.map((c) => c.id));
    const rows: Item[] = [];
    for (const session of state.sessions) {
      if (session.status === "cancelled" || !allowed.has(session.cid)) continue;
      const ymd = ymdInZone(new Date(session.startsAt), session.tz || tz);
      if (ymd < floor || ymd >= end) continue;
      const campaign = campaigns.find((c) => c.id === session.cid);
      if (!campaign) continue;
      rows.push({
        key: session.id,
        ymd,
        month: monthKey(ymd),
        startsAt: session.startsAt,
        campaign,
        session,
        times: [formatTime(new Date(session.startsAt), session.tz || tz)],
      });
    }
    for (const poll of state.polls) {
      if (poll.status !== "open" || !allowed.has(poll.cid)) continue;
      const campaign = campaigns.find((c) => c.id === poll.cid);
      if (!campaign) continue;
      const byDay = new Map<string, { startsAt: string; times: string[] }>();
      for (const option of poll.options) {
        const ymd = ymdInZone(new Date(option.startsAt), option.tz || tz);
        if (ymd < floor || ymd >= end) continue;
        const time = formatTime(new Date(option.startsAt), option.tz || tz);
        const existing = byDay.get(ymd);
        if (!existing) byDay.set(ymd, { startsAt: option.startsAt, times: [time] });
        else {
          existing.times.push(time);
          if (option.startsAt < existing.startsAt) existing.startsAt = option.startsAt;
        }
      }
      for (const [ymd, group] of byDay) {
        rows.push({
          key: `${poll.id}-${ymd}`,
          ymd,
          month: monthKey(ymd),
          startsAt: group.startsAt,
          campaign,
          poll,
          times: group.times,
        });
      }
    }
    rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.campaign.name.localeCompare(b.campaign.name));
    return rows;
  }, [campaigns, state.sessions, state.polls, today, start, end, origin, tz]);

  const months = useMemo(() => {
    const groups: { key: string; label: string; year: string; sessions: number; items: Item[] }[] = [];
    for (const item of items) {
      let group = groups.find((g) => g.key === item.month);
      if (!group) {
        const [y, m] = item.month.split("-").map(Number);
        group = { key: item.month, label: MONTHS[m - 1], year: String(y), sessions: 0, items: [] };
        groups.push(group);
      }
      group.items.push(item);
      if (item.session) group.sessions += 1;
    }
    return groups;
  }, [items]);

  const marks = useMemo(() => {
    const map = new Map<string, Mark[]>();
    const push = (ymd: string, mark: Mark) => {
      const list = map.get(ymd) ?? [];
      list.push(mark);
      map.set(ymd, list);
    };
    for (const item of items) {
      const colors = campaignColors(item.campaign.id);
      const out = item.session ? attendanceState(item.campaign, item.session, state.me.id) === "out" : false;
      push(item.ymd, {
        day: colors.day,
        night: colors.night,
        poll: Boolean(item.poll),
        out,
        name: item.poll ? item.poll.title : item.campaign.name,
      });
    }
    return map;
  }, [items, state.me.id]);

  useLayoutEffect(() => {
    if (!prepend.current) return;
    prepend.current = false;
    const delta = document.documentElement.scrollHeight - prevHeight.current;
    if (delta > 0) window.scrollTo(0, window.scrollY + delta);
    earlierLock.current = false;
  }, [before]);

  useEffect(() => {
    if (items.length > grown.current.count) {
      grown.current = { after, count: items.length };
      laterLock.current = false;
    } else if (after > grown.current.after) {
      laterLock.current = true;
    }
  }, [after, items.length]);

  useEffect(() => {
    const el = laterRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (!visible) {
        laterLock.current = false;
        return;
      }
      if (document.documentElement.scrollHeight <= window.innerHeight + 48) return;
      if (laterLock.current) return;
      laterLock.current = true;
      setAfter((n) => n + 1);
    }, { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, [after, filter, items.length]);

  function loadEarlier() {
    if (earlierLock.current) return;
    earlierLock.current = true;
    prevHeight.current = document.documentElement.scrollHeight;
    prepend.current = true;
    setBefore((n) => n + 1);
  }

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(id);
    window.setTimeout(() => setFlash((current) => (current === id ? "" : current)), 180);
  }

  const firstOfDay = new Set<string>();
  const seenDay = new Set<string>();
  for (const item of items) {
    if (!seenDay.has(item.ymd)) {
      seenDay.add(item.ymd);
      firstOfDay.add(item.key);
    }
  }

  const cadence = campaigns
    .map((c) => {
      if (!c.cadence) return null;
      const every = c.cadence.interval <= 1 ? "every" : c.cadence.interval === 2 ? "every other" : `every ${c.cadence.interval}`;
      return `${c.name} meets ${every} ${weekdayName(c.cadence.weekday)}`;
    })
    .filter(Boolean);

  const overviewMonths = [0, 1, 2, 3].map((i) => addMonthsYmd(overviewStart, i).slice(0, 7));

  return (
    <div className="sgrid">
      <div>
        <div className="chips" role="tablist" aria-label="Filter by campaign">
          <button className={`chip all${filter === "all" ? " on" : ""}`} role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {mine.map((c) => (
            <button key={c.id} className={`chip${filter === c.id ? " on" : ""}`} role="tab" aria-selected={filter === c.id} style={hueStyle(c.id)} onClick={() => setFilter(c.id)}>
              <span className="tn"><img src={coverSrc(c.cover.src, c.id)} alt="" /></span>
              {c.name}
            </button>
          ))}
        </div>
        {months.length === 0 && (
          <div className="card ph-poll">
            <h3>Nothing on the books</h3>
            <p className="note">Play dates and open poll dates for the next few months show up here.</p>
          </div>
        )}
        {months.map((month) => (
          <section key={month.key} className="month" aria-labelledby={`h-${month.key}`}>
            <div className="mh" id={`m-${month.key}`}>
              <h2 id={`h-${month.key}`}>{month.label} <em>{month.year}</em></h2>
              <span className="note">{month.sessions} session{month.sessions === 1 ? "" : "s"}</span>
            </div>
            <div className="evs">
              {month.items.map((item) => {
                const when = formatDayHeading(item.startsAt, item.session?.tz || item.poll?.options[0]?.tz || tz);
                const out = item.session ? attendanceState(item.campaign, item.session, state.me.id) === "out" : false;
                const href = item.poll ? `/polls/${item.poll.id}` : `/campaigns/${item.campaign.id}/sessions/${item.session!.id}`;
                const title = item.poll ? item.poll.title : item.session!.title;
                const place = item.poll
                  ? (item.times.length > 1 ? `Poll open · ${item.times.length} times` : `Poll open · ${item.times[0]}`)
                  : `${item.times[0]} · ${item.session!.location}`;
                const dayId = `d-${item.ymd}`;
                return (
                  <Link
                    key={item.key}
                    href={href}
                    id={firstOfDay.has(item.key) ? dayId : undefined}
                    data-day={item.ymd}
                    className={`card ev${item.poll ? " poll" : ""}${out ? " isout" : ""}${flash === dayId && firstOfDay.has(item.key) ? " flash" : ""}`}
                    style={hueStyle(item.campaign.id)}
                  >
                    <DateBlock dow={when.dow} day={when.day} />
                    <div className="t">
                      <span className="cn">{item.campaign.name}</span>
                      <b>{title}</b>
                      <span className="meta">{place}</span>
                    </div>
                    <div className="rt">
                      {!item.poll && (
                        <span className="thumb"><img className="art" src={coverSrc(item.campaign.cover.src, item.campaign.id)} alt="" /></span>
                      )}
                      <span className={`you${out ? " out" : ""}${item.poll ? " tent" : ""}`}>{item.poll ? "Tentative" : out ? "You're out" : "You're in"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        <div className="month-nav">
          <button className="btn sec sm" type="button" onClick={loadEarlier}>Earlier months</button>
          <button ref={laterRef} className="btn sec sm" type="button" onClick={() => setAfter((n) => n + 1)}>Later months</button>
        </div>
        <p className="note sched-note">
          {cadence.length ? `${cadence.join(". ")}. ` : ""}
          Open polls stay tentative until they&apos;re locked. Subscribe in the account menu to get them in your calendar.
        </p>
      </div>
      <aside className="ov card mo" aria-label="Month overview">
        <div className="mos">
          {overviewMonths.map((key) => {
            const [year, month] = key.split("-").map(Number);
            const count = items.filter((item) => item.month === key && item.session).length;
            const firstWeekday = weekdayOfYmd(`${key}-01`);
            const lead = (firstWeekday + 6) % 7;
            const days = daysInMonth(year, month);
            const cells: ({ day: number; ymd: string } | null)[] = [
              ...Array.from({ length: lead }, () => null),
              ...Array.from({ length: days }, (_, i) => ({ day: i + 1, ymd: `${key}-${String(i + 1).padStart(2, "0")}` })),
            ];
            return (
              <div key={key} className="mg">
                <h4>
                  <a href={`#m-${key}`} onClick={(event) => { event.preventDefault(); jump(`m-${key}`); }}>{MONTHS_SHORT[month - 1]}</a>
                  <span>{count}</span>
                </h4>
                <div className="g">
                  {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => <span key={`${key}-${label}-${i}`} className="wd">{label}</span>)}
                  {cells.map((cell, i) => {
                    if (!cell) return <span key={`${key}-e-${i}`} className="c" />;
                    const dayMarks = marks.get(cell.ymd) ?? [];
                    const past = cell.ymd < today;
                    const isToday = cell.ymd === today;
                    const names = [...new Set(dayMarks.map((mark) => mark.name))];
                    const label = `${MONTHS_SHORT[month - 1]} ${cell.day}${names.length ? `: ${names.join(", ")}` : ""}`;
                    const className = `c${isToday ? " today" : ""}${past ? " past" : ""}`;
                    if (!dayMarks.length) return <span key={cell.ymd} className={className}>{cell.day}</span>;
                    return (
                      <a
                        key={cell.ymd}
                        className={className}
                        href={`#d-${cell.ymd}`}
                        aria-label={label}
                        onClick={(event) => { event.preventDefault(); jump(`d-${cell.ymd}`); }}
                      >
                        {cell.day}
                        <span className="k">
                          {dayMarks.slice(0, 3).map((mark, n) => (
                            <i
                              key={n}
                              className={`${mark.poll ? "p" : ""}${mark.out ? " o" : ""}`}
                              style={{ "--cc-day": mark.day, "--cc-night": mark.night } as CSSProperties}
                            />
                          ))}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="leg">
          {mine.map((c) => (
            <span key={c.id} style={hueStyle(c.id)}><i />{c.name}<em>{roleLabel(state, c.id)}</em></span>
          ))}
          {state.polls.some((p) => p.status === "open" && mine.some((c) => c.id === p.cid)) && (
            <span className="poll-key"><i />Poll date (tentative)</span>
          )}
        </div>
      </aside>
    </div>
  );
}
