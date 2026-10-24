"use client";

import { useState } from "react";
import { isOrganizer } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Campaign, LedgerEntry } from "@/lib/types";
import { Icon } from "./ui";

const KINDS: { id: LedgerEntry["kind"]; label: string }[] = [
  { id: "loot", label: "Loot" },
  { id: "xp", label: "XP" },
  { id: "milestone", label: "Milestone" },
];

/** The party's ledger: loot found, XP awarded, milestones. Organizer writes; everyone reads. */
export function PartyLedger({ campaign }: { campaign: Campaign }) {
  const store = useStore();
  const organizer = isOrganizer(store.state, campaign.id);
  const entries = [...(campaign.ledger || [])].sort((a, b) => b.at.localeCompare(a.at));
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<LedgerEntry["kind"]>("loot");
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  if (!entries.length && !organizer) return null;
  const xp = entries.filter((e) => e.kind === "xp").reduce((n, e) => n + (parseInt(e.text.replace(/[^0-9]/g, ""), 10) || 0), 0);
  const shown = all ? entries : entries.slice(0, 6);
  const save = (next: LedgerEntry[]) => store.patchCampaign(campaign.id, { ledger: next.slice(-200) });

  return (
    <>
      <div className="sh secth">
        <h2>Party ledger</h2>
        {organizer && !adding && <button type="button" className="btn sec sm" onClick={() => setAdding(true)}><Icon name="plus" className="ic sm" />Add</button>}
      </div>
      <section className="card list ledger" aria-label="Party ledger">
        {adding && (
          <form className="lform" onSubmit={(e) => {
            e.preventDefault();
            const clean = text.trim().slice(0, 140);
            if (!clean) return;
            save([...(campaign.ledger || []), { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), kind, text: clean }]);
            setText(""); setAdding(false); store.flash("Added to the ledger.");
          }}>
            <div className="lkinds tabs" role="radiogroup" aria-label="Kind">
              {KINDS.map((k) => <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={kind === k.id ? "on" : ""} onClick={() => setKind(k.id)}>{k.label}</button>)}
            </div>
            <label className="sr" htmlFor="lg-text">Entry</label>
            <input id="lg-text" className="inp" autoFocus maxLength={140} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "xp" ? "450 XP — the bridge troll" : kind === "loot" ? "+1 longsword, 120 gp" : "Reached Barovia"} />
            <div className="tn-actions">
              <button type="button" className="btn ghost sm" onClick={() => { setAdding(false); setText(""); }}>Cancel</button>
              <button type="submit" className="btn pri sm">Add</button>
            </div>
          </form>
        )}
        {!entries.length && !adding && <p className="note lempty">Loot, XP and milestones the party earns, in one place.</p>}
        {shown.map((e) => (
          <div key={e.id} className="lrow">
            <span className={`ltag ${e.kind}`}>{KINDS.find((k) => k.id === e.kind)?.label}</span>
            <span className="ltext">{e.text}</span>
            <span className="ldate">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: campaign.tz }).format(new Date(e.at))}</span>
            {organizer && <button type="button" className="iconbtn" aria-label={`Remove ${e.text}`} onClick={() => {
              const before = campaign.ledger || [];
              save(before.filter((x) => x.id !== e.id));
              store.flash("Removed from the ledger.", "ok", { label: "Undo", run: () => save(before) });
            }}><Icon name="x" /></button>}
          </div>
        ))}
        {(entries.length > 6 || xp > 0) && (
          <div className="lfoot">
            {xp > 0 ? <span className="note">{xp.toLocaleString()} XP total</span> : <span />}
            {entries.length > 6 && <button type="button" className="btn ghost sm" onClick={() => setAll((v) => !v)}>{all ? "Show less" : `Show all ${entries.length}`}</button>}
          </div>
        )}
      </section>
    </>
  );
}
