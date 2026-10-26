import { CharacterName } from "./character-sheet";
import {
  byWhom,
  campaignAwards,
  tpkAwards,
  floorHolders,
  type Award,
  recordDate,
  recordedCampaign,
  thousandWords,
  type RecordedCampaign,
} from "@/lib/almanac-stats";

function Bars({ rows }: { rows: { name: string; width: number; value: string }[] }) {
  return (
    <ul className="rec-bars">
      {rows.map((row) => (
        <li key={row.name}>
          <span className="lbl" title={row.name}>{row.name}</span>
          <span className="bar" style={{ ["--w" as string]: `${row.width}%` }}><i /></span>
          <span className="num">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function maxCount(rows: { count: number }[]): number {
  return Math.max(1, ...rows.map((row) => row.count));
}

export type TopStats = { nights: number; hours: number; recaps: number; level?: number | null };

/** Nights, hours and recaps from the app, plus party level when known. */
export function TopTiles({ top }: { top: TopStats }) {
  return (
    <>
      <div><b>{top.nights.toLocaleString()}</b><span>{top.nights === 1 ? "night" : "nights"}</span></div>
      <div><b>{top.hours.toLocaleString()}</b><span>{top.hours === 1 ? "hour" : "hours"}</span></div>
      <div><b>{top.recaps.toLocaleString()}</b><span>{top.recaps === 1 ? "recap" : "recaps"}</span></div>
      {top.level !== undefined && <div><b>{top.level ?? "—"}</b><span>party level</span></div>}
    </>
  );
}

export function RecordedLedger({ cid, kicker, withAwards = true, top }: { cid: string; kicker?: string; withAwards?: boolean; top?: TopStats }) {
  const row = recordedCampaign(cid);
  if (!row) return null;
  const awards = withAwards ? campaignAwards(cid) : [];
  return (
    <>
      <LedgerBody row={row} heading={kicker ? row.name : undefined} top={top} />
      {awards.length > 0 && (
        <section className="tpk-ledger" aria-label={`${row.name} awards`}>
          <h2 className="lt tpk-awards-h">Awards</h2>
          <AwardGrid awards={awards} />
        </section>
      )}
    </>
  );
}

/** The overall top 10 across the recorded tables this player has joined. */
export function OverallAwards({ ids }: { ids: string[] }) {
  const awards = tpkAwards(ids);
  if (!awards.length) return null;
  return (
    <section className="tpk-ledger" aria-label="Top awards">
      <h2 className="lt tpk-awards-h">Top {awards.length} awards</h2>
      <AwardGrid awards={awards} />
    </section>
  );
}

export function AwardGrid({ awards }: { awards: Award[] }) {
  return (
    <div className="award-grid">
      {awards.map((award) => (
        <article key={award.title} className="award">
          <div className="seal" aria-hidden="true">{award.n}</div>
          <h3>{award.title}</h3>
          <p className="who">{award.who}</p>
          <p>{award.body}</p>
        </article>
      ))}
    </div>
  );
}

function LedgerBody({ row, heading = "Stats", floorShown = true, top }: { row: RecordedCampaign; heading?: string; floorShown?: boolean; top?: TopStats }) {
  const floor = floorHolders(row);
  const topNpc = maxCount(row.npcs);
  const topPlace = maxCount(row.locations);
  const nat20By = byWhom(row.nat20By);
  const nat1By = byWhom(row.nat1By);
  return (
    <section className="rec-ledger" aria-label={`${row.name} recordings`}>
      {!top && <h2>{heading}</h2>}
      <div className="rec-big">
        {top ? <TopTiles top={top} /> : (
          <>
            <div><b>{row.sessions.toLocaleString()}</b><span>sessions recorded</span></div>
            <div><b>{Math.round(row.hours).toLocaleString()}</b><span>hours at the table</span></div>
          </>
        )}
        <div><b>{thousandWords(row.words).toLocaleString()}</b><span>thousand words spoken</span></div>
        <div><b>{row.nat20.toLocaleString()}</b><span>&ldquo;nat 20&rdquo; said aloud</span>{nat20By && <em>By {nat20By}</em>}</div>
        <div><b>{row.nat1.toLocaleString()}</b><span>&ldquo;nat 1&rdquo; said aloud</span>{nat1By && <em>By {nat1By}</em>}</div>
      </div>
      <div className="rec-grid">
        <article>
          <h3>Death register</h3>
          <ul className="rec-deaths">
            {row.deaths.length === 0 && (
              <li className="none"><b>0</b><i>No player character has died on record. Yet.</i></li>
            )}
            {row.deaths.map((death) => (
              <li key={death.name} className={death.returned ? "back" : "stayed"}>
                <CharacterName cid={row.id} name={death.name} className="death-name" />
                <i>{death.line}</i>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>Most-named NPCs</h3>
          <Bars rows={row.npcs.map((npc) => ({ name: npc.name, width: Math.round((npc.count / topNpc) * 100), value: npc.count.toLocaleString() }))} />
        </article>
        <article>
          <h3>Most-visited places</h3>
          <Bars rows={row.locations.map((place) => ({ name: place.name, width: Math.round((place.count / topPlace) * 100), value: place.count.toLocaleString() }))} />
        </article>
        {floorShown && (
        <article>
            <h3>Who holds the floor</h3>
            <Bars rows={floor.map((holder) => ({ name: holder.name, width: holder.width, value: `${holder.share}%` }))} />
          </article>
        )}
      </div>
      <p className="rec-long">Longest night: <b>{row.longest.title}</b> · {recordDate(row.longest.date)} · {row.longest.hours} h</p>
    </section>
  );
}
