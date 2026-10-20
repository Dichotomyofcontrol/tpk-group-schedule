"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upcomingSessions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading } from "@/lib/time";

export function InviteGuest({ token }: { token: string }) {
  const store = useStore();
  const router = useRouter();
  const invite = store.state.invites.find((i) => i.token === token);
  const campaign = store.state.campaigns.find((c) => c.id === invite?.cid);
  const [email, setEmail] = useState(invite?.email || store.state.me.email || "");
  const [name, setName] = useState(store.state.me.displayName || "");
  const [sent, setSent] = useState(false);
  if (!invite || !campaign) {
    return (
      <div className="center-narrow">
        <div className="gate"><h1>This invite isn&apos;t open</h1><p>Ask the organizer for a fresh link.</p></div>
      </div>
    );
  }
  const next = upcomingSessions({ ...store.state, hiddenCids: [], me: { ...store.state.me, id: "preview" } }, campaign.id)
    .filter((s) => s.cid === campaign.id)
    .slice(0, 3);
  // upcomingSessions filters by membership of me. Force the campaign's sessions instead.
  const dates = store.state.sessions
    .filter((s) => s.cid === campaign.id && s.status === "scheduled" && new Date(s.endsAt) > new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  void next;
  return (
    <div>
      <div className="inv" style={{ ["--c" as string]: campaign.color, ["--img" as string]: `url(${campaign.cover.src})` }}>
        <div className="art">
          <small style={{ fontWeight: 700, letterSpacing: "0.08em" }}>{invite.createdByName.toUpperCase()} INVITED YOU TO</small>
          <h2>{campaign.name}</h2>
          <p style={{ margin: 0 }}>{campaign.defaultLocation}</p>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dates.map((session) => {
              const when = formatDayHeading(session.startsAt, session.tz);
              return <span key={session.id} className="chip" style={{ background: campaign.color, color: "#1c1f24" }}>{when.dow} {when.mon} {when.day}</span>;
            })}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>Next play dates</p>
        </div>
        <form className="f" onSubmit={async (e) => {
          e.preventDefault();
          window.sessionStorage.setItem("tpk-join", JSON.stringify({ email, name, token }));
          await store.sendMagicLink(email, token);
          setSent(true);
        }}>
          <div className="stepper">
            <div className="done">1 · Invite</div>
            <div className={sent ? "done" : "on"}>2 · Check your email</div>
            <div className={sent ? "on" : ""}>3 · Add to calendar</div>
          </div>
          <h2 style={{ margin: "0 0 4px", fontFamily: "var(--display)", fontWeight: 560 }}>Join as a <span className="role">{invite.role === "coorganizer" ? "Co-organizer" : "Member"}</span></h2>
          <p className="tz">You&apos;ll see this campaign&apos;s play dates. No password: we email a one-tap sign-in link. You only ever see campaigns you&apos;re invited to.</p>
          <div className="field"><label htmlFor="email">Your email</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="name">Name at the table</label><input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button className="b p" style={{ width: "100%" }} type="submit">Email me a sign-in link</button>
          {sent && (
            <div className="card" style={{ marginTop: 16 }}>
              <b>Link ready for {email}</b>
              <p className="tz">On the live site this arrives in your inbox and expires in about an hour. This preview opens it here.</p>
              <button className="b" type="button" onClick={() => {
                const ok = store.acceptInvite(token, { id: store.state.me.id, email, displayName: name, characterName: name });
                if (ok) router.push(`/campaigns/${campaign.id}?welcome=1`);
              }}>Open the link</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
