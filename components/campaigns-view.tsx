"use client";

import Link from "next/link";
import { memberCampaigns, upcomingSessions } from "@/lib/model";
import { coverSrc } from "@/lib/covers";
import { useStore } from "@/lib/store";
import { relativeWhen } from "@/lib/time";
import { Icon } from "./ui";

export function CampaignsView() {
  const { state } = useStore();
  const mine = memberCampaigns(state);
  return (
    <>
      <div className="ptitle">
        <div>
          <div className="eyebrow">{mine.length} {mine.length === 1 ? "table" : "tables"}</div>
          <h1 className="lt">Campaigns</h1>
        </div>
        {state.me.canCreateCampaigns && <Link className="btn sec sm" href="/campaigns/new"><Icon name="plus" className="ic sm" />New</Link>}
      </div>
      {mine.length === 0 && (
        <div className="card ph-poll">
          <h2>Your table awaits</h2>
          <p className="note">{state.me.id ? "Ask your organizer for an invite link." : "Sign in from the home page to see the campaigns you're invited to."}</p>
        </div>
      )}
      <div className="camp-grid">
        {mine.map((campaign) => {
          const next = upcomingSessions(state, campaign.id)[0];
          const hidden = state.hiddenCids.includes(campaign.id);
          return (
            <article key={campaign.id} className="card camp-card">
              <Link href={`/campaigns/${campaign.id}`}>
                <div className="cover"><img className="art" src={coverSrc(campaign.cover.src, campaign.id)} alt="" /></div>
                <div className="pad">
                  <div className="eyebrow">{campaign.system || "Tabletop"}</div>
                  <h2>{campaign.name}</h2>
                  <p className="note">{next ? `Next ${relativeWhen(next.startsAt, state.me.tz).toLowerCase()}` : "No upcoming night"}{hidden ? " · hidden from play dates" : ""}</p>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
