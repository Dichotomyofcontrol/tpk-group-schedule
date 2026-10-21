"use client";

import Link from "next/link";
import { memberCampaigns, upcomingSessions } from "@/lib/model";
import { useStore } from "@/lib/store";
import { coverArt } from "@/lib/covers";
import { relativeWhen } from "@/lib/time";
import { EmptyState } from "./empty-state";

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
        <EmptyState
          title={state.me.id ? "You're not on a table yet" : "Sign in to see your tables"}
          action={state.me.id
            ? (state.me.canCreateCampaigns ? <Link className="b p" href="/campaigns/new">New campaign</Link> : undefined)
            : <Link className="b p" href="/signin">Sign in</Link>}
        >
          {state.me.id
            ? "Ask your organizer for an invite link. Campaigns only show up after you're on the roster."
            : "Your campaigns, next session, and the people at the table live here after you sign in."}
        </EmptyState>
      )}
      <div className="camp-grid">
        {mine.map((campaign) => {
          const next = upcomingSessions(state, campaign.id)[0];
          return (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="camp-card" style={{ ["--c" as string]: campaign.color }}>
              <div style={{ height: 92, background: `linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,.02)), url(${coverArt(campaign.cover.src)}) center/cover` }} />
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
