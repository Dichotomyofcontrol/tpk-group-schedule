"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isStaff, membersOf, rankedOptions } from "@/lib/model";
import { memberYesCount, optionClocks, optionTimeLabel, POLL_DISPLAY_TZ, pollPublicPath, summarizePoll, voteHasYes, type GuestBallot } from "@/lib/poll-public";
import { useStore } from "@/lib/store";
import { formatDayHeading, zonedTimeToUtc } from "@/lib/time";
import type { Poll } from "@/lib/types";
import { Avatar, Icon, BackBar } from "./ui";

async function sharePollLink(url: string, title: string, text: string, copyValue = url): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "aborted";
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyValue);
      return "copied";
    }
  } catch { /* The clipboard API can refuse a permission. Fall back to a selection copy. */ }
  try {
    const area = document.createElement("textarea");
    area.value = copyValue;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok ? "copied" : "failed";
  } catch {
    return "failed";
  }
}

export function PollList() {
  const store = useStore();
  const { state } = store;
  const mine = new Set(Object.entries(state.members).filter(([, members]) => members.some((m) => m.id === state.me.id)).map(([cid]) => cid));
  const polls = state.polls.filter((p) => mine.has(p.cid));
  const open = polls.filter((p) => p.status === "open");
  const pollKey = open.map((poll) => `${poll.cid}/${poll.id}`).join("|");
  const mergeRef = useRef(store.mergeGuestBallots);
  mergeRef.current = store.mergeGuestBallots;
  useEffect(() => {
    if (store.mode !== "demo" || !pollKey) return;
    let alive = true;
    void (async () => {
      await Promise.all(pollKey.split("|").map(async (pair) => {
        const [cid, pid] = pair.split("/");
        if (!cid || !pid) return;
        try {
          const res = await fetch(`/api/polls/${encodeURIComponent(cid)}/${encodeURIComponent(pid)}`, { cache: "no-store" });
          if (!res.ok || !alive) return;
          const body = await res.json() as { guestBallots?: GuestBallot[] };
          if (body.guestBallots?.length) mergeRef.current(pid, body.guestBallots);
        } catch { /* signed-in votes still show */ }
      }));
    })();
    return () => { alive = false; };
  }, [store.mode, pollKey]);
  const closed = polls.filter((p) => p.status !== "open");
  const staff = state.campaigns.some((c) => isStaff(state, c.id));
  return (
    <>
      <div className="ptitle">
        <div>
          {open.length > 0 && <div className="eyebrow">{open.length} need{open.length === 1 ? "s" : ""} your vote</div>}
          <h1 className="lt">Polls</h1>
        </div>
        {(staff || state.me.canCreateCampaigns) && <a className="btn sec sm" href="#new-poll"><Icon name="plus" className="ic sm" />New poll</a>}
      </div>
      <div className="grid">
        <div>
          {open.map((poll) => <PollCard key={poll.id} poll={poll} />)}
          {open.length === 0 && <div className="card" style={{ padding: 24, marginBottom: 24 }}><p className="note">No polls open. The usual night stays on the calendar.</p></div>}
          <div className="card ph-poll" id="new-poll">
            <span className="fi" style={{ width: 48, height: 48, borderRadius: 14, display: "inline-grid", margin: "0 auto" }}><Icon name="polls" /></span>
            <h3>Find a date</h3>
            <p className="note" style={{ margin: "0 auto 20px", maxWidth: 300 }}>Float a few dates and let the table decide. The organizer locks the winner onto the calendar.</p>
            {staff || state.me.canCreateCampaigns ? <NewPoll /> : <p className="note">An organizer starts the poll.</p>}
          </div>
        </div>
        <aside className="side">
          <div className="card" style={{ padding: 24 }}>
            <div className="eyebrow">Recently closed</div>
            {closed.length === 0 && <p className="note">Nothing locked yet.</p>}
            {closed.map((poll) => (
              <div key={poll.id} style={{ marginTop: 16 }}>
                <p style={{ font: "500 17px/24px var(--serif)", margin: "0 0 4px" }}>{poll.title}</p>
                {(() => {
                  const opt = poll.options.find((o) => o.id === poll.chosenOptionId);
                  if (!opt) return <span className="status">Locked</span>;
                  const d = formatDayHeading(opt.startsAt, POLL_DISPLAY_TZ);
                  const label = <><Icon name="check" className="ic sm" />Locked · {d.dow} {d.mon} {d.day} · {optionClocks(opt).start}</>;
                  return poll.sessionId ? <Link className="status ok lockd" href={`/campaigns/${poll.cid}/sessions/${poll.sessionId}`}>{label}</Link> : <span className="status ok lockd">{label}</span>;
                })()}
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
  const summary = summarizePoll(poll, members, store.state.me.id);
  const quiet = members.filter((m) => !voteHasYes(poll.votes[m.id]));
  const staff = isStaff(store.state, poll.cid);
  const path = pollPublicPath(poll.cid, poll.id);
  return (
    <article className="card poll">
      <span className="ribbon" />
      <div className="eyebrow">{campaign.kind === "oneshot" ? "One-shot" : campaign.name}{poll.closesAt ? ` · closes ${new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: campaign.tz }).format(new Date(poll.closesAt))}` : ""}</div>
      <h2>{campaign.kind === "oneshot" ? campaign.name : poll.title}</h2>
      <p className="note" style={{ margin: 0 }}>Pick every date that works. {staff ? "You can lock the winner." : "The organizer locks the winner."}</p>
      <div className="opts">
        {ranked.map((row, i) => {
          const when = formatDayHeading(row.option.startsAt, POLL_DISPLAY_TZ);
          const time = optionTimeLabel(row.option);
          const picked = !!mine[row.option.id];
          const lead = i === 0 && row.yes > 0;
          const everyone = members.length > 1 && memberYesCount(poll, members, row.option.id) >= members.length;
          const names = summary.namesFor(row.option.id);
          const who = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
          return (
            <button
              key={row.option.id}
              aria-pressed={picked}
              aria-label={`${when.dow} ${when.mon} ${when.day} ${time}: ${row.yes} ${row.yes === 1 ? "vote" : "votes"}${everyone ? ", works for everyone" : lead ? ", leading" : ""}${names.length ? ` (${names.join(", ")})` : ""}`}
              className={`opt${picked ? " mine" : ""}${i === 0 && row.yes > 0 ? " lead" : ""}`}
              disabled={poll.status !== "open"}
              onClick={() => store.toggleVote(poll.id, row.option.id)}
            >
              <span className="fill" style={{ width: `${Math.round((row.yes / max) * 100)}%` }} />
              <span className="chk">{picked && <Icon name="check" />}</span>
              <span className="dt"><span className="dw">{when.dow}</span><span className="dn">{when.day}</span><span className="dm">{when.mon}</span><span className="tm">{time}</span></span>
              <span className="t">{everyone ? <b className="lead-t all">Works for everyone</b> : lead && <b className="lead-t">Leading</b>}{who && <span className="who">{who}</span>}</span>
              <span className="n">{row.yes}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="stack">{members.map((m) => <Avatar key={m.id} name={m.displayName} id={m.id} out={quiet.some((v) => v.id === m.id)} />)}</span>
        <span className="note">{summary.line}</span>
      </div>
      {staff && poll.status === "open" && (
        <div className="shareline">
          <Link href={path}>{path}</Link>
          <button type="button" className="btn sec sm" onClick={async () => {
            const url = `${window.location.origin}${path}`;
            const text = `Pick every date that works for ${campaign.name}: ${url}`;
            const result = await sharePollLink(url, poll.title, text);
            if (result === "copied") store.flash("Poll link copied. Send it to the table.");
            else if (result === "failed") store.flash("Couldn't copy the link.", "err");
          }}><Icon name="link" className="ic sm" />Copy/share link</button>
        </div>
      )}
      {staff && poll.status === "open" && ranked[0] && ranked[0].yes > 0 && (
        <button className="btn pri sm" style={{ marginTop: 16 }} onClick={() => store.lockPoll(poll.id, ranked[0].option.id)}>Lock in the leader</button>
      )}
      {staff && poll.status === "open" && quiet.length > 0 && (
        <button className="btn sec sm nudge" onClick={async () => {
          const names = quiet.map((m) => (m.displayName || m.characterName || "").split(" ")[0]).filter(Boolean);
          const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "friends";
          const url = `${window.location.origin}${path}`;
          const text = `${who}: we're picking the next ${campaign.name} night. Tap the dates that work for you: ${url}`;
          for (const m of quiet) store.nudge(poll.id, m.id);
          const result = await sharePollLink(url, poll.title, text, text);
          if (result === "copied") store.flash("Nudge copied. Paste it in your group chat.");
          else if (result === "failed") store.flash("Couldn't copy the nudge.", "err");
        }}>Nudge {quiet.length === 1 ? (quiet[0].displayName || "them").split(" ")[0] : `the ${quiet.length} who haven't voted`}</button>
      )}
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

type DateRow = { ymd: string; hm: string };

function toOptions(rows: DateRow[], tz: string) {
  return rows.filter((r) => r.ymd).map((r) => {
    const hm = /^\d{2}:\d{2}$/.test(r.hm) ? r.hm : "18:30";
    const start = zonedTimeToUtc(r.ymd, hm, tz);
    return { id: `${r.ymd}-${hm}`, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 4 * 3600_000).toISOString(), tz };
  });
}

function DateRows({ rows, setRows }: { rows: DateRow[]; setRows: (r: DateRow[]) => void }) {
  return (
    <>
      <p className="note" style={{ margin: "12px 0 0" }}>Date and start time, Pacific. Each night runs four hours, and both show on the poll.</p>
      {rows.map((row, i) => (
        <div key={i} className="addr">
          <input className="inp" type="date" aria-label={`Date ${i + 1}`} value={row.ymd} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, ymd: e.target.value } : r))} />
          <input className="inp" type="time" aria-label={`Start time ${i + 1}`} value={row.hm} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, hm: e.target.value } : r))} />
        </div>
      ))}
      <button type="button" className="btn sec sm" onClick={() => setRows([...rows, { ymd: "", hm: "18:30" }])}>Add another date</button>
    </>
  );
}

/** Two clear starts: a session for one of your campaigns, or a standalone one-shot with its own title and players. */
function NewPoll() {
  const store = useStore();
  const { state } = store;
  const staffCampaigns = state.campaigns.filter((c) => isStaff(state, c.id) && c.kind !== "oneshot" && c.status === "active");
  const canOneShot = !!state.me.canCreateCampaigns;
  const [kind, setKind] = useState<"session" | "oneshot">(staffCampaigns.length ? "session" : "oneshot");
  if (!staffCampaigns.length && !canOneShot) return null;
  return (
    <div className="newpoll">
      {staffCampaigns.length > 0 && canOneShot && (
        <div className="pkind" role="radiogroup" aria-label="What are you scheduling?">
          <button type="button" role="radio" aria-checked={kind === "session"} className={kind === "session" ? "on" : ""} onClick={() => setKind("session")}>
            <Icon name="dates" /><span><b>Schedule a session</b><small>For one of your campaigns</small></span>
          </button>
          <button type="button" role="radio" aria-checked={kind === "oneshot"} className={kind === "oneshot" ? "on" : ""} onClick={() => setKind("oneshot")}>
            <Icon name="sparkle" /><span><b>Schedule a one-shot</b><small>Standalone, with its own title and players</small></span>
          </button>
        </div>
      )}
      {kind === "session" && staffCampaigns.length > 0 ? <SessionPollForm campaigns={staffCampaigns} /> : <OneShotForm />}
    </div>
  );
}

function SessionPollForm({ campaigns }: { campaigns: ReturnType<typeof useStore>["state"]["campaigns"] }) {
  const store = useStore();
  const [cid, setCid] = useState(campaigns[0]?.id ?? "");
  const [title, setTitle] = useState("Which night works?");
  const [rows, setRows] = useState<DateRow[]>([{ ymd: "", hm: "18:30" }, { ymd: "", hm: "18:30" }]);
  const [made, setMade] = useState<{ id: string; cid: string; title: string; name: string } | null>(null);
  if (made) {
    const path = pollPublicPath(made.cid, made.id);
    return (
      <div className="osdone" role="status">
        <p><b>{made.title}</b> is open for {made.name}.</p>
        <p className="note">Send the link. Anyone can vote without an account, and you can still lock the winner.</p>
        <div className="shareline">
          <Link href={path}>{path}</Link>
          <button type="button" className="btn pri sm" onClick={async () => {
            const url = `${window.location.origin}${path}`;
            const result = await sharePollLink(url, made.title, `Pick every date that works for ${made.name}: ${url}`);
            if (result === "copied") store.flash("Poll link copied. Send it to the table.");
            else if (result === "failed") store.flash("Couldn't copy the link.", "err");
          }}><Icon name="link" className="ic sm" />Copy/share link</button>
        </div>
        <button type="button" className="btn sec sm" style={{ marginTop: 12 }} onClick={() => setMade(null)}>Start another poll</button>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const campaign = store.state.campaigns.find((c) => c.id === cid);
      if (!campaign) return;
      const id = store.addPoll(cid, title.trim() || "Which night works?", toOptions(rows, campaign.tz));
      if (id) setMade({ id, cid, title: title.trim() || "Which night works?", name: campaign.name });
    }}>
      <div className="field">
        <label htmlFor="poll-cid">Campaign</label>
        <select id="poll-cid" className="inp" value={cid} onChange={(e) => setCid(e.target.value)}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="field"><label htmlFor="poll-q">Question</label><input id="poll-q" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <DateRows rows={rows} setRows={setRows} />
      <button className="btn pri sm" type="submit" style={{ marginLeft: 8 }}><Icon name="plus" className="ic sm" />Start a date poll</button>
    </form>
  );
}

function OneShotForm() {
  const store = useStore();
  const tz = store.state.me.tz || "America/Los_Angeles";
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [rows, setRows] = useState<DateRow[]>([{ ymd: "", hm: "18:30" }, { ymd: "", hm: "18:30" }]);
  const [made, setMade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (made) {
    const name = store.state.campaigns.find((c) => c.id === made)?.name || title;
    return (
      <div className="osdone" role="status">
        <p><b>{name}</b> is set up with a date poll.</p>
        <p className="note">Invite the players, or send the poll link. Anyone with the poll link can vote without an account.</p>
        <div className="osacts">
          <button type="button" className="btn pri sm" disabled={busy} onClick={async () => {
            setBusy(true);
            const token = await store.createInvite(made, "member");
            setBusy(false);
            if (!token) return;
            const url = `${window.location.origin}/invite/${token}`;
            const text = `Join ${name}: ${url}`;
            if (window.matchMedia("(pointer: coarse)").matches && typeof navigator.share === "function") {
              try { await navigator.share({ text }); return; } catch (err) { if ((err as Error)?.name === "AbortError") return; }
            }
            try { await navigator.clipboard.writeText(url); store.flash("Invite link copied. Send it to your players."); } catch { store.flash("Couldn't copy the link.", "err"); }
          }}><Icon name="link" className="ic sm" />{busy ? "Creating…" : "Invite players"}</button>
          {(() => {
            const poll = store.state.polls.find((item) => item.cid === made && item.status === "open");
            if (!poll) return null;
            const path = pollPublicPath(poll.cid, poll.id);
            return (
              <button type="button" className="btn sec sm" onClick={async () => {
                const url = `${window.location.origin}${path}`;
                const result = await sharePollLink(url, name, `Pick every date that works for ${name}: ${url}`);
                if (result === "copied") store.flash("Poll link copied. Send it to the table.");
                else if (result === "failed") store.flash("Couldn't copy the link.", "err");
              }}><Icon name="link" className="ic sm" />Copy/share link</button>
            );
          })()}
          <Link className="btn sec sm" href={`/campaigns/${made}`}>Open the one-shot</Link>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim()) { store.flash("Give the one-shot a title.", "err"); return; }
      const id = store.createOneShot({ title: title.trim(), tz, location: place.trim(), options: toOptions(rows, tz) });
      if (id) setMade(id);
    }}>
      <div className="field"><label htmlFor="os-t">Title</label><input id="os-t" className="inp" placeholder="Halloween horror night" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="field"><label htmlFor="os-p">Place <span className="note">optional</span></label><input id="os-p" className="inp" value={place} onChange={(e) => setPlace(e.target.value)} /></div>
      <DateRows rows={rows} setRows={setRows} />
      <button className="btn pri sm" type="submit" style={{ marginLeft: 8 }}><Icon name="plus" className="ic sm" />Start the one-shot poll</button>
    </form>
  );
}
