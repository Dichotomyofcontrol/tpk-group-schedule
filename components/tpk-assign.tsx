"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getFirebase } from "@/lib/firebase-client";
import { isOrganizer } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatTime, weekdayName, zonedTimeToUtc } from "@/lib/time";
import { DEFAULT_RULES, TPK_TZ, matchBooking, parseGm, weekdayInTz, type PendingBooking } from "@/lib/tpk-rules";
import { DateBlock, Icon } from "./ui";

type Camp = { id: string; name: string };
type Data = { bookings: PendingBooking[]; campaigns: Camp[] };

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const user = getFirebase().auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => "") : "";
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(path, { ...init, headers });
}

/** Demo-mode bookings, run through the same rules as the live import. */
function demoData(campaigns: Camp[]): Data {
  const at = (days: number, hm: string) => {
    const d = new Date(Date.now() + days * 86_400_000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TPK_TZ }).format(d);
    return zonedTimeToUtc(ymd, hm, TPK_TZ).toISOString();
  };
  const nextDow = (dow: number, weeks = 0) => { const today = weekdayInTz(new Date().toISOString()); return ((dow - today + 7) % 7 || 7) + weeks * 7; };
  const raw = [
    { service: "Game Master: Max Hobbs (4 HR)", startISO: at(nextDow(5), "18:00") },
    { service: "Game Master: Isaac Davies (2 HR)", startISO: at(nextDow(2), "19:00") },
    { service: "TLC: Ch. 13 Finale (Choose Your Own)", startISO: at(nextDow(4, 1), "18:30") },
    { service: "Game Master: Sage Ricci (4 HR)", startISO: at(nextDow(6, 1), "12:00") },
  ];
  return {
    campaigns,
    bookings: raw.map((b, i) => {
      const m = matchBooking(b.service, b.startISO, DEFAULT_RULES, campaigns);
      return { key: "demo-" + i, service: b.service, startISO: b.startISO, endISO: b.startISO, location: "5051 SE Hawthorne Blvd, Portland", status: "pending" as const,
        suggestedCids: m.kind === "auto" ? [m.cid] : m.kind === "suggest" ? m.cids : [], reason: m.kind === "suggest" || m.kind === "none" ? m.reason : undefined };
    }),
  };
}

/** Organizer-only: "3 TPK bookings to assign", folding open to a compact ledger of rows. */
export function TpkAssign() {
  const store = useStore();
  const { state, mode, flash } = store;
  const organizer = useMemo(() => state.campaigns.some((c) => isOrganizer(state, c.id)), [state]);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    if (mode === "demo") {
      const camps = state.campaigns.filter((c) => c.status !== "archived" && c.kind !== "oneshot" && isOrganizer(state, c.id)).map((c) => ({ id: c.id, name: c.name }));
      setData((d) => d ?? demoData(camps));
      return;
    }
    const res = await call("/api/import/tpk/pending").catch(() => null);
    if (res?.ok) setData(await res.json());
  }, [mode, state]);
  useEffect(() => { if (organizer && !state.syncing) void load(); }, [organizer, state.syncing, load]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("assign") === "tpk") setOpen(true); }, []);
  if (!organizer || !data || data.bookings.length === 0) return null;
  const n = data.bookings.length;

  const act = async (b: PendingBooking, action: "assign" | "ignore", cid?: string, saveRule?: boolean) => {
    const name = data.campaigns.find((c) => c.id === cid)?.name;
    if (mode === "demo") {
      setData({ ...data, bookings: data.bookings.filter((x) => x.key !== b.key) });
      flash(action === "ignore" ? "Ignored." : `Added to ${name}.${saveRule ? " Rule saved." : ""}`);
      return;
    }
    const res = await call("/api/import/tpk/pending", { method: "POST", body: JSON.stringify({ action, id: b.key, cid, saveRule }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { flash(json.error || "Couldn't save that. Try again.", "err"); return; }
    setData({ bookings: json.bookings, campaigns: json.campaigns });
    flash(action === "ignore" ? (b.status === "assigned" ? "Noted." : "Ignored.") : `${json.linked ? "Linked to the night already on" : "Added to"} ${name}.${json.rule ? " Rule saved." : ""}`);
  };

  return (
    <section className={open ? "tpkq open" : "tpkq"} aria-label="TPK bookings">
      <button type="button" className="tpkq-line" aria-expanded={open} aria-controls="tpkq-list" onClick={() => setOpen(!open)}>
        <span className="tpkq-n" aria-hidden="true">{n}</span>
        <span className="tpkq-t">{n === 1 ? "TPK booking to assign" : "TPK bookings to assign"}</span>
        <Icon name="chev" className="ic sm mchev" />
      </button>
      {open && (
        <div id="tpkq-list" className="card list ledger tpkq-list">
          {[...data.bookings].sort((a, b) => a.startISO.localeCompare(b.startISO)).map((b) => <TpkRow key={b.key} booking={b} campaigns={data.campaigns} onAct={act} />)}
          <p className="note tpkq-foot">From your TPK Brewing bookings. Assigning adds the night to that campaign, or links the one already there.</p>
        </div>
      )}
    </section>
  );
}

function TpkRow({ booking: b, campaigns, onAct }: { booking: PendingBooking; campaigns: Camp[]; onAct: (b: PendingBooking, a: "assign" | "ignore", cid?: string, rule?: boolean) => Promise<void> }) {
  const suggested = b.suggestedCids ?? [];
  const [cid, setCid] = useState(suggested.length === 1 ? suggested[0] : "");
  const [rule, setRule] = useState(false);
  const [busy, setBusy] = useState(false);
  const when = formatDayHeading(b.startISO, TPK_TZ);
  const gm = parseGm(b.service);
  const dow = weekdayName(weekdayInTz(b.startISO));
  const pick = campaigns.find((c) => c.id === cid);
  const others = campaigns.filter((c) => !suggested.includes(c.id));
  const run = async (a: "assign" | "ignore") => { setBusy(true); await onAct(b, a, cid || undefined, rule); setBusy(false); };
  const flagged = b.status === "assigned" && b.possiblyCancelled;
  return (
    <div className={flagged ? "tpkr flagged" : "tpkr"}>
      <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
      <div className="tpkr-b">
        <b className="tpkr-s">{b.service}</b>
        <span className="note">{formatTime(new Date(b.startISO), TPK_TZ)} · TPK Brewing{flagged ? " · " : ""}{flagged && <em className="tpkr-x">Possibly cancelled: gone from your TPK bookings</em>}</span>
        {!flagged && (
          <div className="tpkr-acts">
            <label className="tpkr-pick">
              <span className="sr">Campaign for {b.service}</span>
              <select value={cid} onChange={(e) => setCid(e.target.value)} disabled={busy}>
                <option value="">Choose campaign…</option>
                {suggested.length > 0 && (
                  <optgroup label="Suggested">
                    {suggested.map((id) => <option key={id} value={id}>{campaigns.find((c) => c.id === id)?.name || id}</option>)}
                  </optgroup>
                )}
                {suggested.length > 0 ? <optgroup label="All campaigns">{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                  : others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Icon name="chev" className="ic sm" />
            </label>
            <button type="button" className="btn pri sm tpkr-go" disabled={!cid || busy} onClick={() => run("assign")}>Assign</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => run("ignore")}>Ignore</button>
          </div>
        )}
        {!flagged && b.reason && suggested.length > 1 && <span className="note tpkr-why">{b.reason} Pick one.</span>}
        {!flagged && gm && pick && (
          <label className="tpkr-rule">
            <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} disabled={busy} />
            <span>Always assign {gm} on {dow}s to {pick.name}</span>
          </label>
        )}
        {flagged && (
          <div className="tpkr-acts"><button type="button" className="btn ghost sm" disabled={busy} onClick={() => run("ignore")}>Got it</button></div>
        )}
      </div>
    </div>
  );
}
