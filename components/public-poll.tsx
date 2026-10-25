"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyGuestVote, GUEST_TOKEN_RE, toPublicPoll, voteSeats, type PollPlayer, type PublicPollView } from "@/lib/poll-public";
import { seatsFromRoster } from "@/lib/roster";
import { useStore } from "@/lib/store";
import { Icon } from "./ui";

const TOKEN_KEY = "tpk-guest-token";
const NAME_KEY = "tpk-guest-name";

function readGuestToken(): string {
  try {
    const existing = window.localStorage.getItem(TOKEN_KEY);
    if (existing && GUEST_TOKEN_RE.test(existing)) return existing;
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    const token = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    window.localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    const token = `guest${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
    return token.length >= 16 ? token : `${token}polltoken`;
  }
}

function whoLabel(names: string[]): string {
  if (!names.length) return "";
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
}

export function PublicPoll({ cid, pid }: { cid: string; pid: string }) {
  const store = useStore();
  const stateRef = useRef(store.state);
  stateRef.current = store.state;
  const [view, setView] = useState<PublicPollView | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [seat, setSeat] = useState("");
  const [unlisted, setUnlisted] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<"saved" | "updated" | null>(null);
  const tokenRef = useRef("");
  const hadVote = useRef(false);

  function show(next: PublicPollView, savedName = "") {
    setView(next);
    setMissing(false);
    if (next.mine) {
      hadVote.current = true;
      const match = next.players.find((player) => player.name.toLowerCase() === next.mine!.name.toLowerCase());
      if (match && !match.taken) {
        setSeat(match.id);
        setUnlisted(false);
        setName(match.name);
      } else {
        setSeat("");
        setUnlisted(true);
        setName(next.mine.name);
      }
      setPicks(next.mine.picks);
    } else if (!name && savedName) {
      const match = next.players.find((player) => player.name.toLowerCase() === savedName.toLowerCase() && !player.taken);
      if (match) { setSeat(match.id); setName(match.name); setUnlisted(false); }
      else setName(savedName);
    }
  }

  async function viewFromStore(token: string): Promise<PublicPollView | null> {
    const state = stateRef.current;
    const poll = state.polls.find((item) => item.id === pid && item.cid === cid);
    const campaign = state.campaigns.find((item) => item.id === cid);
    if (!poll || !campaign || campaign.status === "archived") return null;
    const members: PollPlayer[] = (state.members[cid] || []).map((member) => ({
      id: member.id,
      displayName: member.displayName,
      characterName: member.characterName,
      pending: member.pending,
    }));
    const roster = seatsFromRoster(await store.rosterList(cid));
    return toPublicPoll({ poll, campaignName: campaign.name, kind: campaign.kind, campaignStatus: campaign.status, members, roster: roster.length ? roster : undefined }, token);
  }

  useEffect(() => {
    const token = readGuestToken();
    tokenRef.current = token;
    const savedName = window.localStorage.getItem(NAME_KEY) || "";
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/polls/${encodeURIComponent(cid)}/${encodeURIComponent(pid)}`, {
          headers: { "x-guest-token": token },
          cache: "no-store",
        });
        if (!alive) return;
        if (res.ok) {
          show(await res.json() as PublicPollView, savedName);
          return;
        }
        if (store.mode === "demo") {
          const local = await viewFromStore(token);
          if (local && alive) { show(local, savedName); return; }
        }
        setMissing(true);
      } catch {
        if (alive) setMissing(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // Load once per poll. Later votes update `view` from the response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, pid, store.mode]);

  async function voteLocally(token: string, ballotName: string, ballotPicks: string[], rosterId?: string) {
    const state = stateRef.current;
    const poll = state.polls.find((item) => item.id === pid && item.cid === cid);
    const campaign = state.campaigns.find((item) => item.id === cid);
    if (!poll || !campaign) return false;
    const members: PollPlayer[] = (state.members[cid] || []).map((member) => ({
      id: member.id,
      displayName: member.displayName,
      characterName: member.characterName,
      pending: member.pending,
    }));
    const roster = seatsFromRoster(await store.rosterList(cid));
    const seats = voteSeats({ members, roster: roster.length ? roster : undefined });
    const result = await applyGuestVote(poll, { token, name: ballotName, picks: ballotPicks, rosterId }, seats);
    if ("error" in result) {
      setError(result.error);
      return true;
    }
    store.replacePoll(result.poll);
    const next = await toPublicPoll({ poll: result.poll, campaignName: campaign.name, kind: campaign.kind, campaignStatus: campaign.status, members, roster: roster.length ? roster : undefined }, token);
    const edited = hadVote.current;
    hadVote.current = true;
    setBanner(edited ? "updated" : "saved");
    setView(next);
    setName(next.mine?.name || ballotName);
    setPicks(next.mine?.picks || ballotPicks);
    window.localStorage.setItem(NAME_KEY, next.mine?.name || ballotName);
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !view || view.status !== "open") return;
    setError("");
    const chosen = unlisted ? undefined : view.players.find((player) => player.id === seat);
    const ballotName = chosen ? chosen.name : name.trim();
    if (chosen?.taken) { setError(`${chosen.name.split(" ")[0]} already voted.`); return; }
    if (!ballotName) { setError(view.players.length ? "Pick your name." : "Enter your name."); return; }
    if (!picks.length) { setError("Pick at least one date that works."); return; }
    setBusy(true);
    const token = tokenRef.current || readGuestToken();
    try {
      const res = await fetch(`/api/polls/${encodeURIComponent(cid)}/${encodeURIComponent(pid)}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-guest-token": token },
        body: JSON.stringify({ token, name: ballotName, picks, rosterId: chosen ? chosen.id : undefined }),
      });
      const body = await res.json().catch(() => ({})) as PublicPollView & { error?: string };
      if (res.ok && Array.isArray(body.options)) {
        const edited = hadVote.current;
        hadVote.current = true;
        setBanner(edited ? "updated" : "saved");
        setView(body);
        setName(body.mine?.name || ballotName);
        setPicks(body.mine?.picks || picks);
        window.localStorage.setItem(NAME_KEY, body.mine?.name || ballotName);
        if (store.mode === "demo" && body.guestBallots?.length) store.mergeGuestBallots(pid, body.guestBallots);
        return;
      }
      if (res.status === 404 && store.mode === "demo") {
        const handled = await voteLocally(token, ballotName, picks, chosen?.id);
        if (handled) return;
      }
      setError(body.error || "Couldn't save that vote.");
    } catch {
      if (store.mode === "demo") {
        const handled = await voteLocally(token, ballotName, picks, chosen?.id);
        if (handled) return;
      }
      setError("Couldn't save that vote.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="guest-poll-wrap"><p className="note">Opening the poll…</p></div>;
  if (missing || !view) {
    return (
      <div className="guest-poll-wrap">
        <div className="card empty-card">
          <h1 className="lt">That poll isn&apos;t open</h1>
          <p className="note">Ask the organizer for a fresh link.</p>
          <Link className="btn pri" href="/signin">Sign in</Link>
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...view.options.map((option) => option.yes));
  const locked = view.status !== "open";
  const chosen = unlisted ? undefined : view.players.find((player) => player.id === seat);
  const taken = !!chosen?.taken;

  return (
    <div className="guest-poll-wrap">
      <article className="card poll guest-poll">
        <span className="ribbon" />
        <div className="eyebrow">{view.kind === "oneshot" ? "One-shot" : view.campaignName}</div>
        <h1>{view.kind === "oneshot" ? view.campaignName : view.title}</h1>
        <p className="note" style={{ margin: 0 }}>
          {locked ? "The organizer locked the winner." : "Pick every date that works. No account needed."}
        </p>
        {view.lockedLabel && <p className="status ok lockd" style={{ marginTop: 12 }}><Icon name="check" className="ic sm" />Locked · {view.lockedLabel}</p>}
        {banner === "saved" && <p className="gvoted" role="status">Your vote is in. The table can see {view.mine?.name || name}.</p>}
        {banner === "updated" && <p className="gvoted" role="status">Updated. The table has your new dates.</p>}
        {!banner && view.mine && !taken && (
          <p className="galready" role="status">You already voted as {view.mine.name}. Change any dates, then update your vote.</p>
        )}
        {taken && chosen && <p className="galready" role="status">{chosen.name.split(" ")[0]} already voted.</p>}
        <form onSubmit={onSubmit}>
          {!locked && (
            <div className="field">
              <label htmlFor="guest-name">Your name</label>
              {view.players.length > 0 && (
                <div className="gnames" role="group" aria-label="Players on the roster">
                  {view.players.map((player) => {
                    const on = !unlisted && seat === player.id;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        className={on ? "on" : ""}
                        aria-pressed={on}
                        onClick={() => { setSeat(player.id); setUnlisted(false); setName(player.name); setError(""); }}
                      >
                        {player.character ? `${player.name} · ${player.character}` : player.name}
                        {player.taken && <small>Voted</small>}
                      </button>
                    );
                  })}
                  <button type="button" className={unlisted ? "on" : ""} aria-pressed={unlisted} onClick={() => { setUnlisted(true); setSeat(""); setName(""); setError(""); }}>
                    I&apos;m not listed
                  </button>
                </div>
              )}
              {(view.players.length === 0 || unlisted) && (
                <input
                  id="guest-name"
                  className="inp"
                  maxLength={40}
                  autoComplete="nickname"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
              {chosen && !taken && <p className="note">Voting as {chosen.name}.</p>}
            </div>
          )}
          <div className="opts" role="group" aria-label="Dates that work">
            {view.options.map((option, index) => {
              const picked = picks.includes(option.id);
              const lead = index === 0 && option.yes > 0;
              const label = `${option.dow} ${option.mon} ${option.day} ${option.time}: ${option.yes} ${option.yes === 1 ? "vote" : "votes"}${option.names.length ? ` (${option.names.join(", ")})` : ""}`;
              const body = (
                <>
                  <span className="fill" style={{ width: `${Math.round((option.yes / max) * 100)}%` }} />
                  {!locked && <span className="chk">{picked && <Icon name="check" />}</span>}
                  <span className="dt">
                    <span className="dw">{option.dow}</span>
                    <span className="dn">{option.day}</span>
                    <span className="dm">{option.mon}</span>
                    <span className="tm">{option.time}</span>
                  </span>
                  <span className="t">{lead && <b className="lead-t">Leading</b>}{option.names.length > 0 && <span className="who">{whoLabel(option.names)}</span>}</span>
                  <span className="n">{option.yes}</span>
                </>
              );
              if (locked) return <div key={option.id} className="opt" aria-label={label}>{body}</div>;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={picked}
                  aria-label={label}
                  className={`opt${picked ? " mine" : ""}${lead ? " lead" : ""}`}
                  onClick={() => {
                    setPicks((current) => current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]);
                    setError("");
                  }}
                >
                  {body}
                </button>
              );
            })}
          </div>
          <p className="note">{view.line}</p>
          {error && <p className="guest-err" role="alert">{error}</p>}
          {!locked && !taken && (
            <button className="btn pri" type="submit" disabled={busy}>
              {busy ? "Saving…" : (view.mine || banner) ? "Update my vote" : "Submit my dates"}
            </button>
          )}
        </form>
        <p className="note guest-sign">No account needed. <Link href="/signin">Sign in</Link> if you already have one.</p>
      </article>
    </div>
  );
}
