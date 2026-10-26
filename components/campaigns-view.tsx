"use client";

import Link from "next/link";
import { archivedCampaigns, isOrganizer, memberCampaigns , displayTitle } from "@/lib/model";
import { useStore } from "@/lib/store";
import { relativeWhen } from "@/lib/time";
import type { Campaign } from "@/lib/types";
import { CampaignCover, Icon, Skeleton } from "./ui";
import { accentVar, worldFor } from "@/lib/world";
import type { CSSProperties } from "react";

export function CampaignsView() {
  const store = useStore();
  const { state } = store;
  const mine = memberCampaigns(state);
  const archived = archivedCampaigns(state);
  return (
    <>
      <div className="ptitle">
        <div>
          
          <h1 className="lt">Campaigns</h1>
        </div>
        {state.me.canCreateCampaigns && <Link className="btn sec sm" href="/campaigns/new"><Icon name="plus" className="ic sm" />New campaign</Link>}
      </div>
      {state.syncing && <Skeleton rows={2} hero={false} />}
      {!state.syncing && mine.length === 0 && (
        <div className="card empty-card">
          <h2>{state.me.canCreateCampaigns ? "No active campaigns" : "Your table awaits"}</h2>
          <p className="note">{state.me.canCreateCampaigns ? (archived.length ? "Start one, or restore an archived campaign below." : "Start one and invite your players.") : "Ask your organizer for an invite link."}</p>
          {state.me.canCreateCampaigns && <Link className="btn pri sm" href="/campaigns/new">Start a campaign</Link>}
        </div>
      )}
      <div className="camp-grid">
        {mine.map((c) => <CampaignCard key={c.id} campaign={c} />)}
      </div>
      {archived.length > 0 && (
        <section aria-labelledby="arch-h">
          <h2 className="mhd" id="arch-h">Archived</h2>
          <div className="card list">
            {archived.map((c) => (
              <div key={c.id} className="srow arow">
                <Link className="st" href={`/campaigns/${c.id}`}><b>{c.name}</b><span className="note">Hidden from Sessions</span></Link>
                {isOrganizer(state, c.id) && <button className="btn sec sm" onClick={() => store.archiveCampaign(c.id, false)}>Restore</button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { state } = useStore();
  const now = Date.now();
  const world = worldFor(campaign);
  const next = state.sessions
    .filter((s) => s.cid === campaign.id && s.status === "scheduled" && new Date(s.endsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return (
    <Link href={`/campaigns/${campaign.id}`} className="card camp-card rise" data-world={world.id} style={accentVar(campaign) as CSSProperties}>
      <CampaignCover campaign={campaign} />
      <span className="pad">
        <p className="kicker">{world.word}</p>
        <h2>{campaign.name}</h2>
        <span className="note">{next ? `Next ${relativeWhen(next.startsAt, state.me.tz).toLowerCase()}${displayTitle(next, campaign.name) !== campaign.name ? ` · ${displayTitle(next, campaign.name)}` : ""}` : "No session scheduled"}</span>
      </span>
    </Link>
  );
}
