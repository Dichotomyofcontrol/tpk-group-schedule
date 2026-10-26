"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { almanacSpreads, campaignBook, type AlmanacSpread, type CampaignBook, type ChronicleNight } from "@/lib/almanac";
import { recordedKey } from "@/lib/almanac-stats";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatZone, relativeWhen } from "@/lib/time";
import type { LedgerEntry } from "@/lib/types";
import { accentVar, worldFor } from "@/lib/world";
import type { CSSProperties } from "react";
import { CombinedLedger, RecordedLedger, TpkCeremony } from "./almanac-stats";
import { CampaignTabs } from "./campaign-tabs";
import { CharacterName } from "./character-sheet";
import { Avatar, BackBar, CampaignCover, Icon, Skeleton, Watermark } from "./ui";

const BLANK: Record<CampaignBook["blanks"][number], { title: string; body: string }> = {
  npcs: { title: "NPCs", body: "No names are kept outside the party." },
  factions: { title: "Factions", body: "No factions are recorded." },
  ledger: { title: "Quests and loot", body: "The campaign ledger is empty." },
  places: { title: "Places", body: "No table or site is named." },
};

export function AlmanacView() {
  const { state } = useStore();
  const spreads = almanacSpreads(state);
  return (
    <>
      <div className="ptitle">
        <div>
          <h1 className="lt">Almanac</h1>
        </div>
      </div>
      {(() => {
        const keys = spreads
          .map((spread) => state.campaigns.find((item) => item.id === spread.id))
          .map((campaign) => (campaign ? recordedKey(campaign) : null))
          .filter((key): key is string => !!key);
        if (!keys.length) return null;
        return (
          <>
            <TpkCeremony campaignIds={keys} />
            <CombinedLedger campaignIds={keys} />
            {keys.length > 1 && keys.map((key, index) => (
              <RecordedLedger key={key} cid={key} withAwards={false} kicker={`Ledger ${String(index + 1).padStart(2, "0")} / ${String(keys.length).padStart(2, "0")}`} />
            ))}
          </>
        );
      })()}
      {state.syncing && spreads.length === 0 && <Skeleton rows={2} hero={false} />}
      {!state.syncing && spreads.length === 0 && (
        <div className="card empty-card">
          <h2>Your book is empty</h2>
          <p className="note">Campaigns show up here after you join a table.</p>
          <Link className="btn pri sm" href="/campaigns">Go to Campaigns</Link>
        </div>
      )}
      <div className="almanac-stack">
        {spreads.map((spread) => {
          const campaign = state.campaigns.find((item) => item.id === spread.id);
          if (!campaign) return null;
          return <Spread key={spread.id} spread={spread} cover={<CampaignCover campaign={campaign} />} />;
        })}
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
  const world = worldFor(campaign);
  const years = groupYears(book.chronicle);
  return (
    <>
      <BackBar href="/almanac" label="Almanac" />
      <CampaignTabs cid={cid} current="almanac" />
      <section className="card hero chead" data-world={world.id} style={accentVar(campaign) as CSSProperties}>
        <div className="hero-cover">
          <CampaignCover campaign={campaign} />
        </div>
        <div className="hb">
          <Watermark word={world.word} />
          <h1 className="lt">{campaign.name}</h1>
          <p className="meta">
            {book.spread.worldPlace !== "The Table" && <span className="mg">{book.spread.worldPlace}</span>}
            {book.spread.system && <span className="mg">{book.spread.system}</span>}
          </p>
          {(book.spread.latest || book.spread.previouslyOn) && (
            <blockquote className="book-quote">
              <p>{book.spread.latest?.snippet || book.spread.previouslyOn}</p>
              <footer>{book.spread.latest ? book.spread.latest.title : "Previously on"}</footer>
            </blockquote>
          )}
          <div className="bigstats">
            <div><b>{book.spread.played}</b><span>{book.spread.played === 1 ? "Night" : "Nights"}</span></div>
            <div><b>{book.spread.hours}</b><span>{book.spread.hours === 1 ? "Hour" : "Hours"}</span></div>
            <div><b>{book.spread.partyLevel ?? "—"}</b><span>Party level</span></div>
          </div>
        </div>
      </section>

      {recordedKey(campaign) && <RecordedLedger cid={recordedKey(campaign)!} />}

      <div className="sh secth"><h2>The party</h2></div>
      {book.current.length > 0 ? (
        <ul className="spot-grid">
          {book.current.map((spot) => <SpotlightCard key={spot.name} cid={cid} name={spot.name} line={spot.line} player={spot.player} />)}
        </ul>
      ) : (
        <p className="note book-gap">No character sheets are stored for this table.</p>
      )}
      {book.former.length > 0 && (
        <>
          <h3 className="former-h">Former</h3>
          <ul className="spot-grid former">
            {book.former.map((spot) => <SpotlightCard key={spot.name} cid={cid} name={spot.name} line={spot.line} player={spot.player} />)}
          </ul>
        </>
      )}
      <ul className="seat-row">
        {book.spread.seats.map((seat) => (
          <li key={seat.id}>
            <Avatar name={seat.name} id={seat.id} />
            <b>{seat.name}</b>
            {seat.note && (seat.note === "Runs the table" || seat.note === "Co-organizer"
              ? <span>{seat.note}</span>
              : <CharacterName cid={cid} name={seat.note} className="seat-char" />)}
          </li>
        ))}
      </ul>

      <div className="sh secth">
        <h2>The chronicle</h2>
        {book.chronicle.length > 1 && <Link className="lnk" href={`/campaigns/${cid}/recaps`}>All recaps <Icon name="arrow" className="ic sm" /></Link>}
      </div>
      {book.chronicle.length > 0 ? (
        <div className="chronicle">
          {years.map((group) => (
            <section key={group.year}>
              <h3>{group.year}</h3>
              <ol>
                {group.nights.map((night) => <ChronicleRow key={night.id} cid={cid} night={night} />)}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="note book-gap">{book.unwritten > 0 ? `${book.unwritten} ${book.unwritten === 1 ? "night has" : "nights have"} been played. No recap is written yet.` : "No nights have been played yet."}</p>
      )}
      {book.chronicle.length > 0 && book.unwritten > 0 && (
        <p className="note book-gap">{book.unwritten} other {book.unwritten === 1 ? "night has" : "nights have"} no recap.</p>
      )}

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

      {book.spread.next && (
        <p className="next-line">
          <span>Next</span>
          <Link href={nightHref(cid, book.spread.next.id)}>{book.spread.next.title}</Link>
          <em>{whenLabel(book.spread.next.startsAt, book.spread.next.tz)}</em>
        </p>
      )}

      <BlankIndex blanks={book.blanks} />
    </>
  );
}

function Spread({ spread, cover }: { spread: AlmanacSpread; cover: ReactNode }) {
  const campaign = { id: spread.id, name: spread.name };
  const faces = spread.party.length
    ? spread.party
    : spread.seats.map((seat) => ({ name: seat.name, detail: seat.note }));
  return (
    <article className="card spread rise" data-world={worldFor(campaign).id} style={accentVar(campaign) as CSSProperties}>
      <Link className="spread-cover" href={`/campaigns/${spread.id}/almanac`} aria-label={`${spread.name} almanac`}>
        {cover}
      </Link>
      <div className="spread-body">
        <Watermark word={spread.worldWord} />
        <h2><Link href={`/campaigns/${spread.id}/almanac`}>{spread.name}</Link></h2>
        <div className="bigstats">
          <div><b>{spread.played}</b><span>{spread.played === 1 ? "Night" : "Nights"}</span></div>
          <div><b>{spread.hours}</b><span>{spread.hours === 1 ? "Hour" : "Hours"}</span></div>
          <div><b>{spread.recaps}</b><span>{spread.recaps === 1 ? "Recap" : "Recaps"}</span></div>
        </div>
        {spread.next && (
          <p className="next-line">
            <span>Next</span>
            <Link href={nightHref(spread.id, spread.next.id)}>{spread.next.title}</Link>
            <em>{whenLabel(spread.next.startsAt, spread.next.tz)}</em>
          </p>
        )}
        {(spread.latest || spread.previouslyOn) && (
          <blockquote className="book-quote">
            <p>{spread.latest?.snippet || spread.previouslyOn}</p>
            <footer>{spread.latest ? spread.latest.title : "Previously on"}</footer>
          </blockquote>
        )}
        {faces.length > 0 && (
          <ul className="party-row">
            {faces.map((face) => (
              <li key={face.name}>
                {spread.party.length > 0
                  ? <CharacterName cid={spread.id} name={face.name} className="party-name" />
                  : <b>{face.name}</b>}
                {face.detail && <span>{face.detail}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="spread-links">
          <Link className="lnk" href={`/campaigns/${spread.id}/almanac`}>Open this book <Icon name="arrow" className="ic sm" /></Link>
          <Link className="lnk" href={`/campaigns/${spread.id}`}>The table</Link>
        </p>
      </div>
    </article>
  );
}

function SpotlightCard({ cid, name, line, player }: { cid: string; name: string; line: string; player?: string }) {
  return (
    <li className="spot">
      <CharacterName cid={cid} name={name} className="spot-name" />
      {line && <span className="line">{line}</span>}
      {player && <span className="by">Played by {player}</span>}
    </li>
  );
}

function ChronicleRow({ cid, night }: { cid: string; night: ChronicleNight }) {
  const when = formatDayHeading(night.startsAt, night.tz);
  return (
    <li>
      <Link href={nightHref(cid, night.id)}>
        <time dateTime={night.startsAt}><b>{when.day}</b>{when.mon}</time>
        <span>
          <strong>{night.title}</strong>
          {night.snippet ? <em>{night.snippet}</em> : night.pdf ? <em>Filed as a PDF.</em> : null}
        </span>
      </Link>
    </li>
  );
}

function nightHref(cid: string, id: string): string {
  return `/campaigns/${cid}/sessions/${id}`;
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

function BlankIndex({ blanks }: { blanks: CampaignBook["blanks"] }) {
  if (!blanks.length) return null;
  return (
    <aside className="blank-index" aria-label="Not written down">
      <h2>Not written down</h2>
      <ul>
        {blanks.map((key) => (
          <li key={key}><b>{BLANK[key].title}</b><span>{BLANK[key].body}</span></li>
        ))}
      </ul>
    </aside>
  );
}


function whenLabel(iso: string, tz: string): string {
  const when = formatDayHeading(iso, tz);
  return `${when.dow[0]}${when.dow.slice(1).toLowerCase()} ${when.mon[0]}${when.mon.slice(1).toLowerCase()} ${when.day} · ${relativeWhen(iso, tz)}`;
}

function groupYears(nights: ChronicleNight[]): { year: string; nights: ChronicleNight[] }[] {
  const groups: { year: string; nights: ChronicleNight[] }[] = [];
  for (const night of nights) {
    const year = formatZone(new Date(night.startsAt), night.tz, { year: "numeric" });
    const last = groups[groups.length - 1];
    if (!last || last.year !== year) groups.push({ year, nights: [night] });
    else last.nights.push(night);
  }
  return groups;
}
