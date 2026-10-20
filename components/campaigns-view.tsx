"use client";

import Link from "next/link";
import { memberCampaigns, upcomingSessions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { relativeWhen } from "@/lib/time";

export function CampaignsView() {
  const { state } = useStore();
  const mine = memberCampaigns(state);
  return (
    <>
      <div className="mh">
        <h1>Campaigns</h1>
        {state.me.canCreateCampaigns && <Link className="b p" href="/campaigns/new" style={{ marginLeft: "auto" }}>+ New campaign</Link>}
      </div>
      {mine.length === 0 && (
        <div className="card">
          <h2>Your table awaits</h2>
          <p>Ask your Organizer for an invite link.</p>
        </div>
      )}
      <div className="camp-grid">
        {mine.map((campaign) => {
          const next = upcomingSessions(state, campaign.id)[0];
          return (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="camp-card" style={{ ["--c" as string]: campaign.color }}>
              <div style={{ height: 92, background: `linear-gradient(90deg, rgba(0,0,0,.45), rgba(0,0,0,.05)), url(${campaign.cover.src}) center/cover` }} />
              <div className="pad">
                <div className="kick" style={{ color: campaign.color }}>{campaign.icon} {campaign.system || "Table"}</div>
                <h2>{campaign.name}</h2>
                <p className="tz">{next ? `Next ${relativeWhen(next.startsAt, state.me.tz).toLowerCase()}` : "No upcoming night"}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
