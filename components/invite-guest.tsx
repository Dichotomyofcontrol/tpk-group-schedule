"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { formatDayHeading } from "@/lib/time";
import type { Campaign, Invite } from "@/lib/types";
import { Icon, CampaignCover } from "./ui";

export function InviteGuest({ token }: { token: string }) {
  const store = useStore();
  const router = useRouter();
  // Guests can't read invites or campaigns from Firestore, so the live site asks the server.
  const [remote, setRemote] = useState<{ invite: Invite; campaign: Campaign } | null | "loading">(store.mode === "live" ? "loading" : null);
  useEffect(() => {
    if (store.mode !== "live") return;
    let alive = true;
    fetch(`/api/invites/${encodeURIComponent(token)}`).then(async (res) => {
      const body = res.ok ? await res.json() as { campaign?: { id: string; name: string; color?: string; cover?: Campaign["cover"]; location?: string }; invitedBy?: string; role?: Invite["role"]; status?: string } : null;
      if (!alive) return;
      if (!body?.campaign || (body.status && body.status !== "pending")) { setRemote(null); return; }
      setRemote({
        invite: { token, cid: body.campaign.id, role: body.role || "member", createdByName: body.invitedBy || "Your organizer", status: "pending" } as Invite,
        campaign: { id: body.campaign.id, name: body.campaign.name, color: body.campaign.color || "#888", cover: body.campaign.cover || { src: "", path: null }, defaultLocation: body.campaign.location || "" } as Campaign,
      });
    }).catch(() => { if (alive) setRemote(null); });
    return () => { alive = false; };
  }, [store.mode, token]);
  const local = store.state.invites.find((i) => i.token === token);
  const invite = local || (remote && remote !== "loading" ? remote.invite : undefined);
  const campaign = store.state.campaigns.find((c) => c.id === invite?.cid) || (remote && remote !== "loading" ? remote.campaign : undefined);
  const [email, setEmail] = useState(invite?.email || store.state.me.email || "");
  const [name, setName] = useState(store.state.me.displayName || "");
  const [sent, setSent] = useState(false);
  if (!local && remote === "loading") return <div className="center-narrow"><p className="note">Opening your invite…</p></div>;
  if (!invite || !campaign) {
    return (
      <div className="center-narrow">
        <div className="gate"><h1>This invite isn&apos;t open</h1><p>Ask the organizer for a fresh link.</p></div>
      </div>
    );
  }
  const dates = store.state.sessions
    .filter((s) => s.cid === campaign.id && s.status === "scheduled" && new Date(s.endsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  return (
    <article className="card inv">
      <span className="ribbon" />
      <div className="cover">
        <CampaignCover campaign={campaign} />
        <div className="ctop">
          <div className="eyebrow">{invite.createdByName} invited you</div>
          <h3>{campaign.name}</h3>
        </div>
      </div>
      <form className="ib" onSubmit={async (e) => {
        e.preventDefault();
        window.sessionStorage.setItem("tpk-join", JSON.stringify({ email, name, token }));
        await store.sendMagicLink(email, token);
        setSent(true);
      }}>
        <p>Join as a {invite.role === "coorganizer" ? "co-organizer" : "member"}. {campaign.defaultLocation}</p>
        <div className="party">
          {dates.map((session) => {
            const when = formatDayHeading(session.startsAt, session.tz);
            return <span key={session.id} className="pp"><span>{when.dow} {when.day} {when.mon}</span></span>;
          })}
        </div>
        {store.mode === "live" && store.state.me.id ? (
          <div className="two">
            <button className="btn pri" type="button" onClick={async () => {
              const ok = await Promise.resolve(store.acceptInvite(token, { id: store.state.me.id, email: store.state.me.email, displayName: store.state.me.displayName }));
              if (ok) { await new Promise((r) => setTimeout(r, 1500)); router.push(`/campaigns/${campaign.id}?welcome=1`); }
            }}>Join {campaign.name}</button>
          </div>
        ) : sent ? (
          <div className="inbox">
            <span className="fi"><Icon name="mail" /></span>
            <h2>Check your inbox</h2>
            {store.mode === "live" ? (
              <p className="note">We sent a sign-in link to {email}. Open it on this device to join {campaign.name}.</p>
            ) : (
              <>
                <p className="note">On the live site the link arrives for {email}. This preview can open it here.</p>
                <button className="btn pri" type="button" onClick={() => {
                  const ok = store.acceptInvite(token, { id: store.state.me.id || email, email, displayName: name, characterName: name });
                  if (ok) router.push(`/campaigns/${campaign.id}?welcome=1`);
                }}>Open the link</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="field"><label htmlFor="email">Your email</label><input id="email" className="inp" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="name">Name at the table</label><input id="name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <button className="btn pri" type="submit">Email me a sign-in link</button>
          </>
        )}
      </form>
    </article>
  );
}
