"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Icon } from "./ui";

const KEY = "tpk-started-dismissed";

/**
 * First run only: two steps for a new organizer (start a campaign, invite players) or a new
 * player (join a table, RSVP). Ticks itself off from real actions, never blocks, one tap to hide.
 * Hidden for anyone who's been around more than two weeks, and gone for good once done or dismissed.
 */
export function GettingStarted() {
  const { state } = useStore();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(!!window.localStorage.getItem(KEY)); }, []);
  if (hidden || state.syncing) return null;
  const me = state.me.id;
  const mine = Object.entries(state.members).filter(([, ms]) => ms.some((m) => m.id === me));
  const now = Date.now();
  const isNew = mine.every(([, ms]) => {
    const joined = ms.find((m) => m.id === me)?.joinedAt;
    return !joined || now - new Date(joined).getTime() < 14 * 86_400_000;
  });
  if (!isNew) return null;
  const organizer = !!state.me.canCreateCampaigns;
  const steps = organizer
    ? [
        { done: mine.some(([cid]) => state.campaigns.find((c) => c.id === cid)?.ownerUid === me), label: "Start a campaign", detail: "Name it and set the usual night. Sessions fill in.", href: "/campaigns/new" },
        { done: mine.some(([cid, ms]) => state.campaigns.find((c) => c.id === cid)?.ownerUid === me && ms.length > 1), label: "Invite your players", detail: "Send them a link. They join in one tap.", href: "/invites" },
      ]
    : [
        { done: mine.length > 0, label: "Join a campaign", detail: "Open the invite link your organizer sent.", href: null },
        { done: state.sessions.some((s) => (s.attendance || []).some((a) => a.uid === me && a.byUid === me)), label: "Answer for the next session", detail: "Tap Going on Up next, or say you can't make it.", href: null },
      ];
  if (steps.every((s) => s.done)) return null;
  const close = () => { window.localStorage.setItem(KEY, "1"); setHidden(true); };
  return (
    <section className="card gstart" aria-label="Getting started">
      <div className="gsh">
        <h2>Getting started</h2>
        <button type="button" className="iconbtn" aria-label="Hide getting started" onClick={close}><Icon name="x" /></button>
      </div>
      <ol>
        {steps.map((s) => {
          const body = (
            <>
              <span className={s.done ? "gsc done" : "gsc"} aria-hidden="true">{s.done && <Icon name="check" className="ic sm" />}</span>
              <span className="gst"><b>{s.label}</b>{!s.done && <span className="note">{s.detail}</span>}</span>
              {!s.done && s.href && <Icon name="arrow" className="ic sm gsa" />}
            </>
          );
          return (
            <li key={s.label} className={s.done ? "done" : ""}>
              {!s.done && s.href ? <Link href={s.href}>{body}</Link> : <div>{body}</div>}
              <span className="sr">{s.done ? " (done)" : ""}</span>
            </li>
          );
        })}
      </ol>
      {mine.length > 0 && <Link className="lnk gshow" href="/help">How it works <Icon name="arrow" className="ic sm" /></Link>}
    </section>
  );
}
