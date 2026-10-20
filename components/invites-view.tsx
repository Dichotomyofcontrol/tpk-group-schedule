"use client";

import { useEffect, useState } from "react";
import { canInvite, isOrganizer, memberCampaigns } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Invite } from "@/lib/types";

export function InvitesView({ initialCampaign }: { initialCampaign?: string }) {
  const store = useStore();
  const { state } = store;
  const mine = memberCampaigns(state);
  const [cid, setCid] = useState(initialCampaign && mine.some((c) => c.id === initialCampaign) ? initialCampaign : mine[0]?.id ?? "");
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<Invite["role"]>("member");
  const [link, setLink] = useState("");
  const campaign = mine.find((c) => c.id === cid);
  const organizer = campaign ? isOrganizer(state, cid) : false;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const feed = `${origin}/api/cal/${state.me.calToken}.ics?hide=${state.hiddenCids.join(",")}`;
  const webcal = feed.replace(/^https?:/, "webcal:");
  return (
    <>
      <div className="mh"><h1>Invites & calendar</h1></div>
      <div className="two">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Subscribe to every campaign you&apos;re in</h3>
          <p className="tz">Hidden campaigns stay off this feed. Cancelled nights are marked cancelled so they drop off your calendar.</p>
          <a className="b" href={webcal}>Apple / Outlook</a>{" "}
          <a className="b" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Google Calendar</a>
          <div className="url">
            <input readOnly value={webcal || feed} aria-label="All campaigns feed" />
            <button className="b" onClick={() => void navigator.clipboard.writeText(webcal || feed)}>Copy</button>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Invite someone</h3>
          {!campaign && <p>Join a campaign first.</p>}
          {campaign && !canInvite(state, cid, "member") && <p>The organizer has member invites turned off.</p>}
          {campaign && canInvite(state, cid, "member") && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const list = emails.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
              if (!list.length) {
                const token = store.createInvite(cid, role);
                if (token) setLink(`${origin}/invite/${token}`);
                return;
              }
              let last = "";
              for (const email of list) {
                const token = store.createInvite(cid, role, email);
                if (token) last = token;
              }
              if (last) setLink(`${origin}/invite/${last}`);
              setEmails("");
            }}>
              <div className="field">
                <label>Campaign</label>
                <select value={cid} onChange={(e) => setCid(e.target.value)}>{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="emails">Email addresses</label>
                <input id="emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="kai@example.com, rin@example.com" />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Invite["role"])} aria-label="Invite role">
                  <option value="member">as Member</option>
                  {organizer && <option value="coorganizer">as Co-organizer</option>}
                </select>
              </div>
              <button className="b p" type="submit">Send invites</button>
              <button className="b" type="button" style={{ marginLeft: 8 }} onClick={() => {
                const token = store.createInvite(cid, "member");
                if (token) setLink(`${origin}/invite/${token}`);
              }}>Copy a link</button>
              {link && (
                <div className="url">
                  <input readOnly value={`${link}  (expires in 7 days)`} aria-label="Invite link" />
                  <button className="b" type="button" onClick={() => void navigator.clipboard.writeText(link)}>Copy link</button>
                </div>
              )}
              <p className="tz">{campaign.allowMemberInvites ? "Members can invite because the organizer switched that on." : "Members cannot invite right now."} Co-organizers can only be added by the Organizer.</p>
            </form>
          )}
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Open invites</h3>
        <InviteList />
      </div>
    </>
  );
}

function InviteList() {
  const { state } = useStore();
  const rows = state.invites.filter((i) => i.status === "pending" && (i.createdBy === state.me.id || !i.email || i.email === state.me.email));
  if (!rows.length) return <p className="tz">No open invites.</p>;
  return (
    <ul>
      {rows.map((invite) => {
        const campaign = state.campaigns.find((c) => c.id === invite.cid);
        return (
          <li key={invite.token}>
            <a href={`/invite/${invite.token}`}>{campaign?.name}</a>
            <span className="tz"> · {invite.role} · {invite.email || "link"} · {invite.status}</span>
          </li>
        );
      })}
    </ul>
  );
}
