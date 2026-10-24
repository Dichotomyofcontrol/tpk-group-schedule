"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getFirebase } from "@/lib/firebase-client";
import { isOrganizer } from "@/lib/model";
import { useStore } from "@/lib/store";
import { formatDayHeading, formatTime, weekdayName, zonedTimeToUtc } from "@/lib/time";
import { DEFAULT_RULES, TPK_OWNER_EMAIL, TPK_TZ, matchBooking, parseGm, weekdayInTz, type PendingBooking } from "@/lib/tpk-rules";
import { DateBlock, Icon } from "./ui";

type Camp = { id: string; name: string };
type Row = PendingBooking & { review?: boolean };
type Miss = { cid: string; sid: string; campaign: string; title: string; startsAt: string; tz: string; location: string };
type Data = { bookings: Row[]; notOnTpk: Miss[]; campaigns: Camp[] };
type Act = "assign" | "ignore" | "keep" | "undo" | "change";
export const TPK_BOOK_URL = "https://www.tpkbrewing.com/book-online";

/* One shared copy of the sync data, so the Sessions line, session rows and the session page agree. */
let shared: Data | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const setShared = (d: Data | null) => { shared = d; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

function useTpkData() {
  const store = useStore();
  const { state, mode } = store;
  const organizer = useMemo(() => state.campaigns.some((c) => isOrganizer(state, c.id)), [state]);
  const data = useSyncExternalStore(subscribe, () => shared, () => null);
  useEffect(() => {
    if (!organizer || state.syncing || shared || loading) return;
    if (mode === "demo") {
      const camps = state.campaigns.filter((c) => c.status !== "archived" && c.kind !== "oneshot" && isOrganizer(state, c.id)).map((c) => ({ id: c.id, name: c.name }));
      setShared(demoData(camps, state));
      return;
    }
    // Only the TPK import's owner (Seth) has bookings to sync; everyone else skips the call.
    if ((state.me?.email || "").trim().toLowerCase() !== TPK_OWNER_EMAIL) return;
    loading = call("/api/import/tpk/pending").then(async (r) => { if (r.ok) setShared(await r.json()); }).catch(() => {}).finally(() => { loading = null; });
  }, [organizer, state, mode]);
  return { data: organizer ? data : null, mode, flash: store.flash };
}

/** Organizer-only, subtle: this TPK Brewing night has no booking on TPK. */
export function NotOnTpkMark({ cid, sid, long = false }: { cid: string; sid: string; long?: boolean }) {
  const { data } = useTpkData();
  if (!data?.notOnTpk.some((m) => m.cid === cid && m.sid === sid)) return null;
  return long
    ? <p className="note tpk-miss-l"><i className="tpk-miss-dot" aria-hidden="true" />Not on TPK: no matching TPK Brewing booking. <a href={TPK_BOOK_URL} target="_blank" rel="noreferrer">Book on TPK</a> · <Link href="/sessions?sync=tpk">Review</Link></p>
    : <span className="tpk-miss" title="No matching TPK Brewing booking"><i className="tpk-miss-dot" aria-hidden="true" />Not on TPK</span>;
}


async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const user = getFirebase().auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => "") : "";
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(path, { ...init, headers });
}

/** Demo-mode bookings, run through the same rules as the live import. */
function demoData(campaigns: Camp[], state: { sessions: { id: string; cid: string; startsAt: string; tz: string; title?: string; location?: string; status?: string }[]; campaigns: { id: string; name: string }[] }): Data {
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
  ];
  const bookings: Row[] = raw.map((b, i) => {
    const m = matchBooking(b.service, b.startISO, DEFAULT_RULES, campaigns);
    return { key: "demo-" + i, service: b.service, startISO: b.startISO, endISO: b.startISO, location: "5051 SE Hawthorne Blvd, Portland", status: "pending" as const,
      suggestedCids: m.kind === "auto" ? [m.cid] : m.kind === "suggest" ? m.cids : [], reason: m.kind === "suggest" || m.kind === "none" ? m.reason : undefined };
  });
  if (campaigns[0]) bookings.push({ key: "demo-added", service: "Game Master: Max Hobbs (4 HR)", startISO: at(nextDow(3), "18:00"), endISO: at(nextDow(3), "22:00"), location: "", status: "assigned", cid: campaigns[0].id, sessionId: null, linked: false, review: true });
  const now = Date.now();
  const notOnTpk = state.sessions
    .filter((s) => s.status !== "cancelled" && new Date(s.startsAt).getTime() > now && new Date(s.startsAt).getTime() < now + 120 * 86_400_000 && (!s.location || /tpk\s*brewing/i.test(s.location)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 2)
    .map((s) => { const name = state.campaigns.find((c) => c.id === s.cid)?.name || ""; return { cid: s.cid, sid: s.id, campaign: name, title: s.title || name, startsAt: s.startsAt, tz: s.tz, location: s.location || "" }; });
  return { campaigns, bookings, notOnTpk };
}

/** Organizer-only: one quiet line ("TPK sync · 3 to review") that opens the two-way review sheet. */
export function TpkAssign() {
  const { data, mode, flash } = useTpkData();
  const [open, setOpen] = useState(false);
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("sync") === "tpk" || q.get("assign") === "tpk") setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, close]);
  if (!data) return null;
  const added = data.bookings.filter((b) => b.review).sort((a, b) => a.startISO.localeCompare(b.startISO));
  const toAssign = data.bookings.filter((b) => !b.review).sort((a, b) => a.startISO.localeCompare(b.startISO));
  const n = added.length + toAssign.length + data.notOnTpk.length;
  if (n === 0) return null;

  const act = async (b: Row, action: Act, cid?: string, saveRule?: boolean) => {
    const name = data.campaigns.find((c) => c.id === cid || c.id === b.cid)?.name;
    const msg = (j: { linked?: boolean; rule?: unknown; undone?: { kept?: boolean } }) =>
      action === "keep" ? "Kept." : action === "undo" ? (j.undone?.kept ? "Unassigned. The night has RSVPs or notes, so it stays." : "Undone. It's back in Assign.")
      : action === "ignore" ? (b.status === "assigned" ? "Noted." : "Ignored.") : `${j.linked ? "Linked to the night already on" : "Added to"} ${name}.${j.rule ? " Rule saved." : ""}`;
    if (mode === "demo") {
      const rest = data.bookings.filter((x) => x.key !== b.key);
      setShared({ ...data, bookings: action === "undo" ? [...rest, { ...b, status: "pending", review: false, cid: null, suggestedCids: b.cid ? [b.cid] : [] }] : rest });
      flash(msg({ rule: saveRule }));
      return;
    }
    const res = await call("/api/import/tpk/pending", { method: "POST", body: JSON.stringify({ action, id: b.key, cid, saveRule }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { flash(json.error || "Couldn't save that. Try again.", "err"); return; }
    setShared({ bookings: json.bookings, notOnTpk: json.notOnTpk, campaigns: json.campaigns });
    flash(msg(json));
  };
  const dismiss = async (m: Miss) => {
    if (mode === "demo") { setShared({ ...data, notOnTpk: data.notOnTpk.filter((x) => x !== m) }); flash("Dismissed."); return; }
    const res = await call("/api/import/tpk/pending", { method: "POST", body: JSON.stringify({ action: "dismiss", cid: m.cid, sid: m.sid }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { flash(json.error || "Couldn't save that. Try again.", "err"); return; }
    setShared({ bookings: json.bookings, notOnTpk: json.notOnTpk, campaigns: json.campaigns });
    flash("Dismissed.");
  };

  return (
    <section className="tpkq" aria-label="TPK sync">
      <button type="button" className="tpkq-line" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="tpkq-t"><b>TPK sync</b> · {n} to review</span>
        <Icon name="chev" className="ic sm mchev" />
      </button>
      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tpks-h">
          <button className="modal-scrim" type="button" aria-label="Close" onClick={close} />
          <div className="card sheet wide tpks">
            <div className="sh"><h2 id="tpks-h">TPK sync</h2><button className="iconbtn" type="button" aria-label="Close" autoFocus onClick={close}><Icon name="x" /></button></div>
            <p className="note">Your TPK Brewing bookings next to your sessions here. Nothing is added without showing up in this list.</p>
            {added.length > 0 && <Group title="Added from TPK" n={added.length} hint="Matched by a rule and added. Keep it, change the campaign, or undo.">
              {added.map((b) => <AddedRow key={b.key} booking={b} campaigns={data.campaigns} onAct={act} />)}
            </Group>}
            {toAssign.length > 0 && <Group title="To assign" n={toAssign.length} hint="On TPK, not on any campaign yet.">
              {toAssign.map((b) => <TpkRow key={b.key} booking={b} campaigns={data.campaigns} onAct={act} />)}
            </Group>}
            {data.notOnTpk.length > 0 && <Group title="Not booked at TPK" n={data.notOnTpk.length} hint="Sessions at TPK Brewing in the next 120 days with no matching booking.">
              {data.notOnTpk.map((m) => <MissRow key={m.cid + m.sid} miss={m} onDismiss={dismiss} />)}
            </Group>}
            <div className="two end"><button type="button" className="btn pri sm" onClick={close}>Done</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function Group({ title, n, hint, children }: { title: string; n: number; hint: string; children: React.ReactNode }) {
  return (
    <div className="tpkg">
      <h3 className="tpkg-h">{title} <span className="tpkg-n">({n})</span></h3>
      <p className="note tpkg-hint">{hint}</p>
      <div className="card list ledger tpkq-list">{children}</div>
    </div>
  );
}

function AddedRow({ booking: b, campaigns, onAct }: { booking: Row; campaigns: Camp[]; onAct: (b: Row, a: Act, cid?: string, rule?: boolean) => Promise<void> }) {
  const [changing, setChanging] = useState(false);
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const when = formatDayHeading(b.startISO, TPK_TZ);
  const name = campaigns.find((c) => c.id === b.cid)?.name || b.cid;
  const run = async (a: Act, c?: string) => { setBusy(true); await onAct(b, a, c); setBusy(false); };
  return (
    <div className="tpkr">
      <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
      <div className="tpkr-b">
        <b className="tpkr-s">{b.service}</b>
        <span className="note">{formatTime(new Date(b.startISO), TPK_TZ)} · {b.linked ? "Linked to" : "Added to"} <b className="tpkr-c">{name}</b></span>
        {!changing ? (
          <div className="tpkr-acts">
            <button type="button" className="btn sec sm" disabled={busy} onClick={() => run("keep")}>Keep</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setChanging(true)}>Change</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => run("undo")}>Undo</button>
          </div>
        ) : (
          <div className="tpkr-acts">
            <label className="tpkr-pick">
              <span className="sr">Move {b.service} to</span>
              <select value={cid} onChange={(e) => setCid(e.target.value)} disabled={busy}>
                <option value="">Move to…</option>
                {campaigns.filter((c) => c.id !== b.cid).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Icon name="chev" className="ic sm" />
            </label>
            <button type="button" className="btn pri sm tpkr-go" disabled={!cid || busy} onClick={() => run("change", cid)}>Move</button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setChanging(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MissRow({ miss: m, onDismiss }: { miss: Miss; onDismiss: (m: Miss) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const when = formatDayHeading(m.startsAt, m.tz);
  return (
    <div className="tpkr">
      <DateBlock dow={when.dow} day={when.day} mon={when.mon} />
      <div className="tpkr-b">
        <Link className="tpkr-s" href={`/campaigns/${m.cid}/sessions/${m.sid}`}><b>{m.title}</b></Link>
        <span className="note">{formatTime(new Date(m.startsAt), m.tz)} · {m.location || "No place set"}{m.title !== m.campaign ? ` · ${m.campaign}` : ""}</span>
        <div className="tpkr-acts">
          <a className="btn sec sm" href={TPK_BOOK_URL} target="_blank" rel="noreferrer">Book on TPK</a>
          <button type="button" className="btn ghost sm" disabled={busy} title="Booked elsewhere or not needed" onClick={async () => { setBusy(true); await onDismiss(m); setBusy(false); }}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function TpkRow({ booking: b, campaigns, onAct }: { booking: PendingBooking; campaigns: Camp[]; onAct: (b: Row, a: Act, cid?: string, rule?: boolean) => Promise<void> }) {
  const suggested = b.suggestedCids ?? [];
  const [cid, setCid] = useState(suggested.length === 1 ? suggested[0] : "");
  const [rule, setRule] = useState(false);
  const [busy, setBusy] = useState(false);
  const when = formatDayHeading(b.startISO, TPK_TZ);
  const gm = parseGm(b.service);
  const dow = weekdayName(weekdayInTz(b.startISO));
  const pick = campaigns.find((c) => c.id === cid);
  const others = campaigns.filter((c) => !suggested.includes(c.id));
  const run = async (a: Act) => { setBusy(true); await onAct(b, a, cid || undefined, rule); setBusy(false); };
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
