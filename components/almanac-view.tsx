"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { almanacSpreads, campaignBook, type AlmanacSpread } from "@/lib/almanac";
import { recordedCampaign, recordedKey } from "@/lib/almanac-stats";
import { useStore } from "@/lib/store";
import { formatZone } from "@/lib/time";
import type { Campaign, LedgerEntry } from "@/lib/types";
import { accentVar, worldFor } from "@/lib/world";
import type { CSSProperties } from "react";
import { ForYouLedger } from "./almanac-me";
import { OverallAwards, RecordedLedger, TopTiles } from "./almanac-stats";
import { CampaignTabs } from "./campaign-tabs";
import { BackBar, Icon, Skeleton } from "./ui";

export function AlmanacView() {
  const { state } = useStore();
  const spreads = almanacSpreads(state);
  const recordedIds = spreads
    .map((spread) => state.campaigns.find((item) => item.id === spread.id))
    .map((campaign) => (campaign ? recordedKey(campaign) : null))
    .filter((key): key is string => !!key);
  return (
    <>
      <div className="ptitle">
        <div>
          <h1 className="lt">Almanac</h1>
        </div>
      </div>
      <ForYouLedger state={state} />
      {state.syncing && spreads.length === 0 && <Skeleton rows={2} hero={false} />}
      {!state.syncing && spreads.length === 0 && (
        <div className="card empty-card">
          <h2>Your book is empty</h2>
          <p className="note">Campaigns show up here after you join a table.</p>
          <Link className="btn pri sm" href="/campaigns">Go to Campaigns</Link>
        </div>
      )}
      <OverallAwards ids={recordedIds} />
      <CampaignSwitcher spreads={spreads} campaigns={state.campaigns} />
    </>
  );
}

/** One campaign's stats at a time, picked from a sticky chip row. Defaults to the most hours; mirrors ?c= in the URL. */
function CampaignSwitcher({ spreads, campaigns }: { spreads: AlmanacSpread[]; campaigns: Campaign[] }) {
  const rows = spreads
    .map((spread) => ({ spread, campaign: campaigns.find((item) => item.id === spread.id) }))
    .filter((row): row is { spread: AlmanacSpread; campaign: Campaign } => !!row.campaign);
  const [picked, setPicked] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) setPicked(c);
  }, []);
  const activeId = rows.find((row) => row.campaign.id === picked)?.campaign.id ?? null;
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [rows.length]);
  useEffect(() => {
    // Keep the picked chip in view inside the strip without moving the page.
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !chip) return;
    const left = chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: "instant" as ScrollBehavior });
  }, [activeId, rows.length]);
  if (!rows.length) return null;
  const hoursOf = ({ spread, campaign }: { spread: AlmanacSpread; campaign: Campaign }) => {
    const key = recordedKey(campaign);
    const row = key ? recordedCampaign(key) : null;
    return spread.played > 0 || !row ? spread.hours : row.hours;
  };
  const top = [...rows].sort((a, b) => hoursOf(b) - hoursOf(a))[0];
  const current = rows.find((row) => row.campaign.id === picked) || top;
  const choose = (id: string) => {
    setPicked(id);
    const url = new URL(window.location.href);
    url.searchParams.set("c", id);
    window.history.replaceState(null, "", url.toString());
  };
  return (
    <>
      {rows.length > 1 && (
        <div className={`alm-switch${edges.start ? " fade-s" : ""}${edges.end ? " fade-e" : ""}`}>
          <div className="alm-strip" ref={strip} role="tablist" aria-label="Campaign">
          {rows.map(({ campaign }) => (
            <button key={campaign.id} type="button" role="tab" aria-selected={campaign.id === current.campaign.id} className="alm-chip" style={accentVar(campaign) as CSSProperties} onClick={() => choose(campaign.id)}>
              <i aria-hidden="true" /><span>{campaign.name}</span>
            </button>
          ))}
          </div>
        </div>
      )}
      <div className="almanac-stack" role="tabpanel">
        <Facts rise={false} key={current.campaign.id} campaign={current.campaign} spread={current.spread} level={undefined} recorded={recordedKey(current.campaign)} />
      </div>
    </>
  );
}

export function CampaignAlmanac({ cid }: { cid: string }) {
  const { state } = useStore();
  const campaign = state.campaigns.find((item) => item.id === cid);
  const book = campaignBook(state, cid);
  const toneId = campaign && book ? campaign.id : "";
  useEffect(() => {
    if (!toneId) return;
    const world = worldFor(state.campaigns.find((item) => item.id === toneId)!);
    const root = document.documentElement;
    root.style.setProperty("--acc", world.accent);
    document.body.dataset.world = world.id;
    return () => {
      root.style.removeProperty("--acc");
      delete document.body.dataset.world;
    };
  }, [toneId, state.campaigns]);
  if (!book || !campaign) {
    return (
      <>
        <BackBar href="/almanac" label="Almanac" />
        <div className="card empty-card">
          <h1 className="lt">You&apos;re not at this table</h1>
          <p className="note">The almanac only opens campaigns you&apos;ve joined.</p>
          <Link className="btn pri sm" href="/almanac">Back to the Almanac</Link>
        </div>
      </>
    );
  }
  return (
    <>
      <BackBar href="/almanac" label="Almanac" />
      <CampaignTabs cid={cid} current="almanac" />
      <Facts campaign={campaign} spread={book.spread} level={book.spread.partyLevel ?? null} recorded={recordedKey(campaign)} />

      {book.places.length > 0 && (
        <>
          <div className="sh secth"><h2>Places</h2></div>
          <ul className="place-list">
            {book.places.map((place) => (
              <li key={place.name}>
                <b>{place.name}</b>
                <span>{place.nights === 0 ? "Named, not yet played" : `${place.nights} ${place.nights === 1 ? "night" : "nights"}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {book.ledger.length > 0 && (
        <>
          <div className="sh secth"><h2>Quests and loot</h2></div>
          <ul className="ledger-list">
            {book.ledger.map((entry) => <LedgerRow key={entry.id} entry={entry} tz={campaign.tz} />)}
          </ul>
        </>
      )}
    </>
  );
}

/** One campaign's Almanac facts: totals, then the recorded stats. One link out. */
function Facts({ campaign, spread, level, recorded, rise = true }: { campaign: Campaign; spread: AlmanacSpread; level?: number | null; recorded: string | null; rise?: boolean }) {
  const row = recorded ? recordedCampaign(recorded) : null;
  // App counts first; a table with no app sessions falls back to its recordings.
  const useApp = spread.played > 0 || !row;
  const top = {
    nights: useApp ? spread.played : row!.sessions,
    hours: useApp ? spread.hours : Math.round(row!.hours),
    recaps: spread.recaps,
    level,
  };
  return (
    <section className={`card alm-facts${rise ? " rise" : ""}`} data-world={worldFor(campaign).id} style={accentVar(campaign) as CSSProperties}>
      <div className="alm-facts-h">
        <h2 className="lt">{campaign.name}</h2>
        <Link className="lnk" href={`/campaigns/${campaign.id}`}>Campaign <Icon name="arrow" className="ic sm" /></Link>
      </div>
      {row ? <RecordedLedger cid={recorded!} top={top} /> : (
        <div className="rec-big">
          <TopTiles top={top} />
        </div>
      )}
    </section>
  );
}

function LedgerRow({ entry, tz }: { entry: LedgerEntry; tz: string }) {
  const when = Number.isNaN(new Date(entry.at).getTime()) ? entry.at : formatZone(new Date(entry.at), tz, { month: "short", day: "numeric", year: "numeric" });
  return (
    <li>
      <span>{entry.kind === "milestone" ? "Quest" : entry.kind === "xp" ? "XP" : "Loot"}</span>
      <b>{entry.text}</b>
      <time dateTime={entry.at}>{when}</time>
    </li>
  );
}

