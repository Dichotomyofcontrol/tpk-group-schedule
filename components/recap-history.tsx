"use client";

import Link from "next/link";
import { membersOf, pastSessions } from "@/lib/model";
import { hasRecap } from "@/lib/recap";
import { useStore } from "@/lib/store";
import { RecapRow } from "./campaign-view";
import { BackBar } from "./ui";

/** Every recap for one campaign, oldest first, so the story reads in order. */
export function RecapHistory({ cid }: { cid: string }) {
  const { state } = useStore();
  const campaign = state.campaigns.find((c) => c.id === cid);
  const me = membersOf(state, cid).find((m) => m.id === state.me.id);
  if (!campaign || !me) {
    return (
      <>
        <BackBar href="/campaigns" label="Campaigns" />
        <div className="card empty-card">
          <h1 className="lt">You&apos;re not at this table</h1>
          <p className="note">Campaigns show up after an invite. If you have a link, open that.</p>
          <Link className="btn pri sm" href="/campaigns">Go to Campaigns</Link>
        </div>
      </>
    );
  }
  const recaps = pastSessions(state, cid).filter((s) => hasRecap(s)).reverse();
  return (
    <>
      <BackBar href={`/campaigns/${cid}`} label={campaign.name} />
      <div className="ptitle"><h1 className="lt">Recaps</h1></div>
      {recaps.length > 1 && <p className="note rhsub">{recaps.length} recaps, oldest first</p>}
      {recaps.length > 0 ? (
        <div className={recaps.length > 1 ? "card list tline asc" : "card list"}>
          {recaps.map((s) => <RecapRow key={s.id} session={s} />)}
        </div>
      ) : (
        <div className="card pad"><p className="note">No recaps yet. They show up here after each session.</p></div>
      )}
    </>
  );
}
