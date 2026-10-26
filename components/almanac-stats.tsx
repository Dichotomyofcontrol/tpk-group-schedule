import { CharacterName } from "./character-sheet";
import {
  byWhom,
  campaignAwards,
  combinedLedger,
  floorHolders,
  type Award,
  type LedgerRow,
  groupTotals,
  recordDate,
  recordedCampaign,
  thousandWords,
  tpkAwards,
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

export function RecordedLedger({ cid, kicker, withAwards = true }: { cid: string; kicker?: string; withAwards?: boolean }) {
  const row = recordedCampaign(cid);
  if (!row) return null;
  const awards = withAwards ? campaignAwards(cid) : [];
  return (
    <>
      <LedgerBody row={row} heading={kicker ? row.name : undefined} />
      {awards.length > 0 && (
        <section className="tpk-ledger" aria-label={`${row.name} awards`}>
          <h2 className="lt tpk-awards-h">Awards</h2>
          <AwardGrid awards={awards} />
        </section>
      )}
    </>
  );
}

/** The full original ledger, every stat summed across the player's recorded tables. */
export function CombinedLedger({ campaignIds }: { campaignIds: string[] }) {
  const row = combinedLedger(campaignIds);
  if (!row) return null;
  return <LedgerBody row={row} heading={row.span ? "All tables" : "Stats"} floorShown={!row.span} />;
}

function AwardGrid({ awards }: { awards: Award[] }) {
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

function LedgerBody({ row, heading = "Stats", floorShown = true }: { row: LedgerRow | RecordedCampaign; heading?: string; floorShown?: boolean }) {
  const floor = floorHolders(row);
  const topNpc = maxCount(row.npcs);
  const topPlace = maxCount(row.locations);
  const nat20By = byWhom(row.nat20By);
  const nat1By = byWhom(row.nat1By);
  return (
    <section className="rec-ledger" aria-label={`${row.name} recordings`}>
      <h2>{heading}</h2>
      <div className="rec-big">
        <div><b>{row.sessions.toLocaleString()}</b><span>sessions recorded</span></div>
        <div><b>{Math.round(row.hours).toLocaleString()}</b><span>hours at the table</span></div>
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
                <CharacterName cid={("cid" in death && death.cid) || row.id} name={death.name} className="death-name" />
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

export function TpkCeremony({ campaignIds }: { campaignIds: string[] }) {
  const totals = groupTotals(campaignIds);
  const awards = tpkAwards(campaignIds);
  if (!totals) return null;
  return (
    <section className="tpk-ledger" aria-label="The TPK awards">
      <h2 className="lt">The TPK</h2>
      <div className="tpk-totals">
        <div><b>{totals.sessions.toLocaleString()}</b><span>sessions</span></div>
        <div><b>{totals.hours.toLocaleString()}</b><span>hours</span></div>
        <div><b>{totals.wordsLabel}</b><span>words</span></div>
      </div>
      {awards.length > 0 && (
        <>
          <h2 className="lt tpk-awards-h">Awards</h2>
          <AwardGrid awards={awards} />
        </>
      )}
    </section>
  );
}
