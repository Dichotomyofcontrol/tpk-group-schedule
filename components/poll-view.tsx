"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isStaff, membersOf, rankedOptions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { partsInZone, zonedTimeToUtc } from "@/lib/time";
import type { Poll } from "@/lib/types";
import { EmptyState } from "./empty-state";

export function PollList() {
  const { state } = useStore();
  const mine = new Set(Object.entries(state.members).filter(([, members]) => members.some((m) => m.id === state.me.id)).map(([cid]) => cid));
  const polls = state.polls.filter((p) => mine.has(p.cid));
  return (
    <>
      <div className="mh"><h1>Polls</h1></div>
      {state.me.id && <p className="tz">Polls are for the occasional placeholder, not the usual night. Tap the times you can make. The organizer locks the winner in as a real play date.</p>}
      {polls.length === 0 && (
        <EmptyState
          title={state.me.id ? "No polls open" : "Sign in to see polls"}
          action={state.me.id ? undefined : <Link className="b p" href="/signin">Sign in</Link>}
        >
          {state.me.id
            ? "When an organizer needs a date that isn't the usual night, the poll shows up here."
            : "Date polls stay with your tables. Sign in with the email your organizer knows."}
        </EmptyState>
      )}
      {polls.map((poll) => {
        const campaign = state.campaigns.find((c) => c.id === poll.cid);
        return (
          <Link key={poll.id} href={`/polls/${poll.id}`} className="card" style={{ display: "block", borderTop: `4px solid ${campaign?.color}` }}>
            <div className="kick" style={{ color: campaign?.color }}>{campaign?.name}</div>
            <h2 style={{ margin: "4px 0" }}>{poll.title}</h2>
            <p className="tz">{poll.status === "open" ? "Open" : "Locked in"} · {Object.keys(poll.votes).length} voted</p>
          </Link>
        );
      })}
      <NewPoll />
    </>
  );
}

export function PollView({ pollId }: { pollId: string }) {
  const store = useStore();
  const poll = store.state.polls.find((p) => p.id === pollId);
  if (!poll) {
    return (
      <EmptyState title="That poll isn't here" action={<Link className="b p" href="/polls">All polls</Link>}>
        It may have been locked in, or it belongs to another table.
      </EmptyState>
    );
  }
  const campaign = store.state.campaigns.find((c) => c.id === poll.cid);
  if (!campaign) return null;
  const member = (store.state.members[poll.cid] || []).find((m) => m.id === store.state.me.id);
  if (!member) {
    return (
      <EmptyState
        title={store.state.me.id ? "You're not on this poll" : "Sign in to vote"}
        action={store.state.me.id ? <Link className="b p" href="/polls">All polls</Link> : <Link className="b p" href="/signin">Sign in</Link>}
      >
        {store.state.me.id ? "Ask your organizer for an invite to this table." : "Use the email your organizer knows. The poll opens after you're on the roster."}
      </EmptyState>
    );
  }
  return <PollBoard poll={poll} />;
}

function PollBoard({ poll }: { poll: Poll }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((c) => c.id === poll.cid)!;
  const members = membersOf(store.state, poll.cid);
  const staff = isStaff(store.state, poll.cid);
  const ranked = useMemo(() => rankedOptions(poll, campaign.cadence), [poll, campaign.cadence]);
  const best = ranked[0];
  const columns = uniqueDates(poll);
  const rows = uniqueTimes(poll);
  const voted = members.filter((m) => poll.votes[m.id] && Object.values(poll.votes[m.id].picks).some(Boolean));
  const quiet = members.filter((m) => !voted.some((v) => v.id === m.id));
  return (
    <>
      <div className="mh"><h1>{poll.title}</h1></div>
      <div className="two">
        <div className="card">
          <p style={{ marginTop: 0 }}>Tap the times you can make. Darker means more of the party is free. Your picks have a green outline.</p>
          <div className="heat" style={{ ["--c" as string]: campaign.color }}>
            <span />
            {columns.map((col) => (
              <div key={col.key} className="h">{col.dow}<b>{col.label}</b></div>
            ))}
            {rows.map((hm) => (
              <Row key={hm} hm={hm} columns={columns} poll={poll} />
            ))}
          </div>
          {poll.status === "locked" && <p>This date is locked in.</p>}
        </div>
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Best so far</h3>
            {best && best.yes > 0 ? (
              <>
                <b style={{ fontSize: 20 }}>{labelOption(best.option.startsAt, best.option.tz)}</b>
                <p className="tz">{best.yes} of {members.length} free{quiet.length ? ` · ${quiet.map((m) => m.displayName).join(", ")} not yet voted` : ""}</p>
              </>
            ) : <p>Be the first to mark your nights.</p>}
            {staff && poll.status === "open" && best && (
              <button className="b p" style={{ width: "100%" }} onClick={() => store.lockPoll(poll.id, best.option.id)}>
                Lock in & invite everyone
              </button>
            )}
            {!staff && <p className="tz">Only an Organizer or Co-organizer locks the date.</p>}
            <p className="tz">Adds the night to every subscribed feed.</p>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Voted · {voted.length} of {members.length}</h3>
            <div className="stack">
              {members.map((m) => (
                <span key={m.id} className="av" style={{ opacity: voted.some((v) => v.id === m.id) ? 1 : 0.35 }} title={m.displayName}>{m.displayName.slice(0, 1)}</span>
              ))}
            </div>
            {staff && quiet.map((m) => (
              <button key={m.id} className="b" style={{ marginTop: 10 }} onClick={() => store.nudge(poll.id, m.id)}>Nudge {m.displayName}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ hm, columns, poll }: { hm: string; columns: { key: string }[]; poll: Poll }) {
  const store = useStore();
  const mine = poll.votes[store.state.me.id]?.picks ?? {};
  return (
    <>
      <div className="tm">{pretty(hm)}</div>
      {columns.map((col) => {
        const option = poll.options.find((o) => o.id === `${col.key}-${hm}`);
        if (!option) return <span key={col.key} />;
        let yes = 0;
        for (const vote of Object.values(poll.votes)) if (vote.picks[option.id]) yes += 1;
        const max = Math.max(1, Object.keys(poll.votes).length);
        const bestYes = Math.max(...poll.options.map((o) => Object.values(poll.votes).filter((v) => v.picks[o.id]).length));
        const label = `${labelOption(option.startsAt, option.tz)}, ${yes} of ${max} free, you: ${mine[option.id] ? "yes" : "no"}`;
        return (
          <button
            key={option.id}
            className={`cell${mine[option.id] ? " mine" : ""}${yes && yes === bestYes ? " best" : ""}`}
            style={{ ["--v" as string]: String(yes) }}
            aria-label={label}
            disabled={poll.status !== "open"}
            onClick={() => store.toggleVote(poll.id, option.id)}
          >
            {yes || ""}
          </button>
        );
      })}
    </>
  );
}

function uniqueDates(poll: Poll): { key: string; dow: string; label: string }[] {
  const seen = new Map<string, { key: string; dow: string; label: string }>();
  for (const option of poll.options) {
    const p = partsInZone(new Date(option.startsAt), option.tz);
    const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        dow: p.weekday,
        label: `${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: option.tz }).format(new Date(option.startsAt))} ${p.day}`,
      });
    }
  }
  return [...seen.values()];
}

function uniqueTimes(poll: Poll): string[] {
  const set = new Set<string>();
  for (const option of poll.options) {
    const p = partsInZone(new Date(option.startsAt), option.tz);
    set.add(`${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`);
  }
  return [...set].sort();
}

function pretty(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${ap}`;
}

function labelOption(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

function NewPoll() {
  const store = useStore();
  const staffCampaigns = store.state.campaigns.filter((c) => isStaff(store.state, c.id));
  const [cid, setCid] = useState(staffCampaigns[0]?.id ?? "");
  const [title, setTitle] = useState("Which night works?");
  const [rows, setRows] = useState([{ ymd: "", hm: "18:30" }, { ymd: "", hm: "18:30" }]);
  if (!staffCampaigns.length) return null;
  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault();
      const campaign = store.state.campaigns.find((c) => c.id === cid);
      if (!campaign) return;
      const options = rows.filter((r) => r.ymd).map((r) => {
        const start = zonedTimeToUtc(r.ymd, r.hm, campaign.tz);
        return { id: `${r.ymd}-${r.hm}`, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 4 * 3600_000).toISOString(), tz: campaign.tz };
      });
      store.addPoll(cid, title, options);
    }}>
      <h3 style={{ marginTop: 0 }}>Propose dates</h3>
      <div className="field">
        <label>Campaign</label>
        <select value={cid} onChange={(e) => setCid(e.target.value)}>{staffCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="field"><label>Question</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      {rows.map((row, i) => (
        <div key={i} className="url">
          <input type="date" aria-label={`Date ${i + 1}`} value={row.ymd} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, ymd: e.target.value } : r))} />
          <input type="time" aria-label={`Time ${i + 1}`} value={row.hm} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, hm: e.target.value } : r))} />
        </div>
      ))}
      <button type="button" className="b" onClick={() => setRows([...rows, { ymd: "", hm: "18:30" }])}>Add another date</button>
      <button className="b p" type="submit" style={{ marginLeft: 8 }}>Start the poll</button>
    </form>
  );
}
