"use client";

import { useEffect, useState } from "react";
import { canInvite, isOrganizer, isStaff, memberCampaigns, membersOf } from "@/lib/model";
import { coverSrc } from "@/lib/covers";
import { useStore } from "@/lib/store";
import type { Invite } from "@/lib/types";
import { Avatar, Icon } from "./ui";

export function InvitesView({ initialCampaign }: { initialCampaign?: string }) {
  const store = useStore();
  const { state } = store;
  const mine = memberCampaigns(state);
  const incoming = state.invites.filter((i) => i.status === "pending" && (!i.email || i.email === state.me.email) && !mine.some((c) => c.id === i.cid));
  const gm = mine.filter((c) => isStaff(state, c.id));
  const [cid, setCid] = useState(initialCampaign && gm.some((c) => c.id === initialCampaign) ? initialCampaign : gm[0]?.id ?? mine[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Invite["role"]>("member");
  const [link, setLink] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const campaign = mine.find((c) => c.id === cid);
  const organizer = campaign ? isOrganizer(state, cid) : false;
  const sent = state.invites.filter((i) => i.cid === cid && (i.createdBy === state.me.id || isStaff(state, cid)));

  return (
    <>
      <div className="ptitle">
        <div>
          <div className="eyebrow">{incoming.length} waiting for you</div>
          <h1 className="lt">Invites</h1>
        </div>
      </div>
      {!state.me.id && (
        <div className="card ph-poll"><h2>Invites stay with your table</h2><p className="note">Sign in from the home page. Your organizer&apos;s link is the only way in.</p></div>
      )}
      {state.me.id && (
        <div className="ivg">
          <section>
            <div className="sec-h"><h2>For you</h2></div>
            {incoming.map((invite) => {
              const table = state.campaigns.find((c) => c.id === invite.cid);
              if (!table) return null;
              const aboard = membersOf(state, table.id);
              return (
                <article key={invite.token} className="card inv">
                  <span className="ribbon" />
                  <div className="cover">
                    <img className="art" src={coverSrc(table.cover.src, table.id)} alt="" />
                    <div className="ctop">
                      <div className="eyebrow">{invite.createdByName} invited you</div>
                      <h3>{table.name}</h3>
                    </div>
                  </div>
                  <div className="ib">
                    <p>{table.defaultLocation ? `${table.defaultLocation}. ` : ""}{aboard.length} already at the table. You&apos;ll be a {invite.role === "coorganizer" ? "co-organizer" : "member"}.</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span className="stack">{aboard.slice(0, 6).map((m) => <Avatar key={m.id} name={m.displayName} id={m.id} />)}</span>
                      <span className="note">Pending</span>
                    </div>
                    <div className="acts">
                      <button className="btn pri" onClick={() => {
                        const ok = store.acceptInvite(invite.token);
                        if (ok) window.location.href = `/campaigns/${table.id}?welcome=1`;
                      }}><Icon name="check" className="ic sm" />Join campaign</button>
                      <button className="btn sec" onClick={() => store.flash("Ask the organizer if you need this invite withdrawn.")}>Decline</button>
                    </div>
                  </div>
                </article>
              );
            })}
            <p className="note" style={{ textAlign: "center", margin: "24px 0 0" }}>{incoming.length ? "That's everything. New invites arrive by email too." : "Nothing waiting. New invites arrive by email too."}</p>
          </section>
          {campaign && canInvite(state, cid, "member") && (
            <section>
              <div className="sec-h"><h2>Invite players</h2><span className="note">You&apos;re {organizer ? "GM" : "hosting"}</span></div>
              <div className="card gm">
                <div className="eyebrow">{campaign.name}</div>
                <h2>Bring someone to the table</h2>
                <p className="note" style={{ margin: 0 }}>They&apos;ll get a one-tap email link. No account needed until they open it.</p>
                {gm.length > 1 && (
                  <div className="field">
                    <label>Campaign</label>
                    <select className="inp" value={cid} onChange={(e) => setCid(e.target.value)}>{gm.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </div>
                )}
                {organizer && (
                  <div className="field">
                    <label>Role</label>
                    <select className="inp" value={role} aria-label="Invite role" onChange={(e) => setRole(e.target.value as Invite["role"])}>
                      <option value="member">Member</option>
                      <option value="coorganizer">Co-organizer</option>
                    </select>
                  </div>
                )}
                <form className="addr" onSubmit={(e) => {
                  e.preventDefault();
                  const token = store.createInvite(cid, role, email || undefined);
                  if (token && origin) setLink(`${origin}/invite/${token}`);
                  setEmail("");
                }}>
                  <label className="sr" htmlFor="iv">Email</label>
                  <input id="iv" className="inp" type="email" inputMode="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button className="btn pri" type="submit">Invite</button>
                </form>
                <div className="sent">
                  {sent.map((invite) => {
                    const who = invite.email || "Link";
                    const joined = invite.status === "accepted";
                    return (
                      <div key={invite.token} className="row">
                        <Avatar name={who} id={invite.token} />
                        <div className="t"><b style={{ font: "500 16px/22px var(--ui)" }}>{who}</b><span>{invite.status}</span></div>
                        <span className={joined ? "pill ok" : "pill"}>{joined ? "Joined" : "Pending"}</span>
                        {!joined && <button className="btn ghost" aria-label={`Copy invite for ${who}`} style={{ width: 44, padding: 0 }} onClick={() => { const url = `${origin}/invite/${invite.token}`; void navigator.clipboard.writeText(url); store.flash("Invite link copied."); }}><Icon name="arrow" className="ic sm" /></button>}
                      </div>
                    );
                  })}
                </div>
                <div className="lnk">
                  <Icon name="link" className="ic sm" />
                  <code>{link || (origin ? `${origin.replace(/^https?:\/\//, "")}/invite/…` : "invite link")}</code>
                  <button className="btn sec sm" type="button" onClick={() => {
                    if (link) { void navigator.clipboard.writeText(link); return; }
                    const token = store.createInvite(cid, "member");
                    if (token && origin) {
                      const url = `${origin}/invite/${token}`;
                      setLink(url);
                      void navigator.clipboard.writeText(url);
                    }
                  }}>Copy</button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
