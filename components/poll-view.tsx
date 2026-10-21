"use client";

import Link from "next/link";
import { useState } from "react";
import { isStaff, membersOf, rankedOptions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading, zonedTimeToUtc } from "@/lib/time";
import type { Poll } from "@/lib/types";
import { Avatar, Icon, BackBar } from "./ui";

export function PollList() {
  const store = useStore();
  const { state } = store;
  const mine = new Set(Object.entries(state.members).filter(([, members]) => members.some((m) => m.id === state.me.id)).map(([cid]) => cid));
  const polls = state.polls.filter((p) => mine.has(p.cid));
  const open = polls.filter((p) => p.status === "open");
  const closed = polls.filter((p) => p.status !== "open");
  const staff = state.campaigns.some((c) => isStaff(state, c.id));
  return (
    <>
      <div className="ptitle">
        <div>
          <div className="eyebrow">{open.length} need{open.length === 1 ? "s" : ""} your vote</div>
          <h1 className="lt">Polls</h1>
        </div>
        {staff && <a className="btn sec sm" href="#new-poll"><Icon name="plus" className="ic sm" />New poll</a>}
      </div>
      <div className="grid">
        <div>
          {open.map((poll) => <PollCard key={poll.id} poll={poll} />)}
          {open.length === 0 && <div className="card" style={{ padding: 24, marginBottom: 24 }}><p className="note">No polls open. The usual night stays on the calendar.</p></div>}
          <div className="card ph-poll" id="new-poll">
            <span className="fi" style={{ width: 48, height: 48, borderRadius: 14, display: "inline-grid", margin: "0 auto" }}><Icon name="polls" /></span>
            <h3>Planning a one-shot?</h3>
            <p className="note" style={{ margin: "0 auto 20px", maxWidth: 300 }}>Float a few dates and let the table decide. The organizer locks the winner onto the calendar.</p>
            {staff ? <NewPoll /> : <p className="note">An organizer starts the poll.</p>}
          </div>
        </div>
        <aside className="side">
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow">Recently closed</div>
            {closed.length === 0 && <p className="note">Nothing locked yet.</p>}
            {closed.map((poll) => (
              <div key={poll.id} style={{ marginTop: 16 }}>
                <p style={{ font: "500 17px/24px var(--serif)", margin: "0 0 4px" }}>{poll.title}</p>
                <span className="status">Locked</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const store = useStore();
  const campaign = store.state.campaigns.find((c) => c.id === poll.cid);
  if (!campaign) return null;
  const members = membersOf(store.state, poll.cid);
  const ranked = rankedOptions(poll, campaign.cadence);
  const max = Math.max(1, ...ranked.map((r) => r.yes));
  const mine = poll.votes[store.state.me.id]?.picks ?? {};
  const voted = members.filter((m) => poll.votes[m.id] && Object.values(poll.votes[m.id].picks).some(Boolean));
  const quiet = members.filter((m) => !voted.some((v) => v.id === m.id));
  return (
    <article className="card poll">
      <span className="ribbon" />
      <div className="eyebrow">{campaign.name}{poll.closesAt ? ` · closes ${new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: campaign.tz }).format(new Date(poll.closesAt))}` : ""}</div>
      <h2>{poll.title}</h2>
      <p className="note" style={{ margin: 0 }}>Pick every date that works. {isStaff(store.state, poll.cid) ? "You can lock the winner." : "The organizer locks the winner."}</p>
      <div className="opts">
        {ranked.map((row, i) => {
          const when = formatDayHeading(row.option.startsAt, row.option.tz);
          const picked = !!mine[row.option.id];
          return (
            <button
              key={row.option.id}
              className={`opt${picked ? " mine" : ""}${i === 0 && row.yes > 0 ? " lead" : ""}`}
              disabled={poll.status !== "open"}
              onClick={() => store.toggleVote(poll.id, row.option.id)}
            >
              <span className="fill" style={{ width: `${Math.round((row.yes / max) * 100)}%` }} />
              <span className="chk">{picked && <Icon name="check" />}</span>
              <span className="dt"><span className="dw">{when.dow}</span><span className="dn">{when.day}</span><span className="dm">{when.mon}</span></span>
              <span className="t">{i === 0 && row.yes > 0 ? "Leading" : ""}</span>
              <span className="n">{row.yes}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="stack">{members.map((m) => <Avatar key={m.id} name={m.displayName} id={m.id} out={!voted.some((v) => v.id === m.id)} />)}</span>
        <span className="note">{voted.length} of {members.length} voted{quiet.length ? ` · ${quiet.map((m) => m.displayName.split(" ")[0]).join(", ")} hasn't` : ""}</span>
      </div>
      {isStaff(store.state, poll.cid) && poll.status === "open" && ranked[0] && ranked[0].yes > 0 && (
        <button className="btn pri sm" style={{ marginTop: 16 }} onClick={() => store.lockPoll(poll.id, ranked[0].option.id)}>Lock in the leader</button>
      )}
      {isStaff(store.state, poll.cid) && quiet.map((m) => (
        <button key={m.id} className="btn ghost sm" onClick={() => store.nudge(poll.id, m.id)}>Nudge {m.displayName}</button>
      ))}
    </article>
  );
}

export function PollView({ pollId }: { pollId: string }) {
  const store = useStore();
  const poll = store.state.polls.find((p) => p.id === pollId);
  if (!poll) return <><BackBar href="/polls" label="Polls" /><div className="card empty-card"><h1 className="lt">That poll is gone</h1><p className="note">It isn&apos;t on any of your tables.</p></div></>;
  const member = (store.state.members[poll.cid] || []).find((m) => m.id === store.state.me.id);
  if (!member) return <><BackBar href="/polls" label="Polls" /><div className="card empty-card"><h1 className="lt">Not your table yet</h1><p className="note">You can vote after you&apos;re invited.</p></div></>;
  return (
    <>
      <BackBar href="/polls" label="Polls" />
      <PollCard poll={poll} />
    </>
  );
}

function NewPoll() {
  const store = useStore();
  const staffCampaigns = store.state.campaigns.filter((c) => isStaff(store.state, c.id));
  const [cid, setCid] = useState(staffCampaigns[0]?.id ?? "");
  const [title, setTitle] = useState("Which night works?");
  const [rows, setRows] = useState([{ ymd: "", hm: "18:30" }, { ymd: "", hm: "18:30" }]);
  if (!staffCampaigns.length) return null;
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const campaign = store.state.campaigns.find((c) => c.id === cid);
      if (!campaign) return;
      const options = rows.filter((r) => r.ymd).map((r) => {
        const start = zonedTimeToUtc(r.ymd, r.hm, campaign.tz);
        return { id: `${r.ymd}-${r.hm}`, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 4 * 3600_000).toISOString(), tz: campaign.tz };
      });
      store.addPoll(cid, title, options);
    }}>
      <div className="field">
        <label>Campaign</label>
        <select className="inp" value={cid} onChange={(e) => setCid(e.target.value)}>{staffCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="field"><label>Question</label><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      {rows.map((row, i) => (
        <div key={i} className="addr">
          <input className="inp" type="date" aria-label={`Date ${i + 1}`} value={row.ymd} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, ymd: e.target.value } : r))} />
          <input className="inp" type="time" aria-label={`Time ${i + 1}`} value={row.hm} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, hm: e.target.value } : r))} />
        </div>
      ))}
      <button type="button" className="btn sec sm" onClick={() => setRows([...rows, { ymd: "", hm: "18:30" }])}>Add another date</button>
      <button className="btn pri sm" type="submit" style={{ marginLeft: 8 }}><Icon name="plus" className="ic sm" />Start a date poll</button>
    </form>
  );
}
