"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rosterJoinPath, unifyPlayers, type RosterInput, type RosterPlayer, type TableSeat } from "@/lib/roster";
import { useStore } from "@/lib/store";
import type { Member, Role } from "@/lib/types";
import { sharePollLink } from "./poll-view";
import { Icon } from "./ui";

const EMPTY: RosterInput = { name: "", characterName: "", email: "", phone: "" };

function fields(seat?: TableSeat): RosterInput {
  return {
    name: seat?.name || "",
    characterName: seat?.characterName || "",
    email: seat?.email || "",
    phone: seat?.phone || "",
  };
}

export function RosterCard({ cid, manage, members, canInvite = false }: { cid: string; manage: boolean; members: Member[]; canInvite?: boolean }) {
  const store = useStore();
  const listRef = useRef(store.rosterList);
  listRef.current = store.rosterList;
  const gen = useRef(0);
  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<RosterInput>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<RosterInput>(EMPTY);
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ticket = ++gen.current;
    listRef.current(cid).then((list) => { if (ticket === gen.current) setRoster(list); }).catch(() => { if (ticket === gen.current) setRoster([]); });
  }, [cid, store.state.me.id]);

  const seats = unifyPlayers(members, roster || []);

  async function share(seat: TableSeat) {
    if (!seat.token) return;
    const path = rosterJoinPath(seat.token);
    const url = `${window.location.origin}${path}`;
    const text = `Claim your seat as ${seat.name}: ${url}`;
    const result = await sharePollLink(url, `Seat for ${seat.name}`, text);
    if (result === "copied") store.flash("Seat link copied. Send it to them.");
    else if (result === "failed") store.flash("Couldn't copy the link.", "err");
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    gen.current += 1;
    const result = await store.rosterAdd(cid, {
      name: draft.name,
      characterName: draft.characterName || undefined,
      email: draft.email || undefined,
      phone: draft.phone || undefined,
    });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setRoster((list) => [...(list || []).filter((item) => item.id !== result.id), result]);
    setDraft(EMPTY);
    setAdding(false);
    store.flash(`${result.name} is on the list.`);
  }

  async function save(seat: TableSeat, event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    gen.current += 1;
    if (seat.rosterId) {
      const result = await store.rosterSave(cid, seat.rosterId, {
        name: edit.name,
        characterName: edit.characterName || undefined,
        email: edit.email || undefined,
        phone: edit.phone || undefined,
      });
      if ("error" in result) { setBusy(false); setError(result.error); return; }
      setRoster((list) => (list || []).map((item) => item.id === result.id ? result : item));
    } else if (seat.memberId) {
      store.patchMember(cid, seat.memberId, { characterName: edit.characterName?.trim() || "" });
    }
    if (seat.memberId && seat.role && seat.role !== "organizer" && role !== seat.role) {
      store.patchMember(cid, seat.memberId, { role });
    }
    setBusy(false);
    setEditing(null);
    store.flash("Saved.");
  }

  async function remove(seat: TableSeat) {
    if (seat.memberId && seat.status === "joined") {
      if (seat.role === "organizer") return;
      if (!window.confirm(`Remove ${seat.name} from this campaign?`)) return;
      store.removeMember(cid, seat.memberId);
      if (seat.rosterId) {
        gen.current += 1;
        const ok = await store.rosterRemove(cid, seat.rosterId);
        if (ok) setRoster((list) => (list || []).filter((item) => item.id !== seat.rosterId));
      }
      store.flash(`${seat.name} was removed.`);
      return;
    }
    if (!seat.rosterId) return;
    if (!window.confirm(`Remove ${seat.name} from the list?`)) return;
    gen.current += 1;
    const ok = await store.rosterRemove(cid, seat.rosterId);
    if (!ok) { store.flash("Couldn't remove that player.", "err"); return; }
    setRoster((list) => (list || []).filter((item) => item.id !== seat.rosterId));
    store.flash(`${seat.name} was removed.`);
  }

  const form = (value: RosterInput, set: (next: RosterInput) => void, onSubmit: (event: React.FormEvent) => void, submit: string, seat?: TableSeat) => (
    <form className="rform" onSubmit={onSubmit}>
      {seat?.memberId && !seat.rosterId ? (
        <p className="note" style={{ margin: 0 }}>{seat.name} already has an account.</p>
      ) : (
        <div className="fld"><label htmlFor="rn">Name</label><input id="rn" required maxLength={40} value={value.name} onChange={(event) => set({ ...value, name: event.target.value })} /></div>
      )}
      <div className="fld"><label htmlFor="rc">Character name</label><input id="rc" maxLength={60} value={value.characterName || ""} placeholder="Optional" onChange={(event) => set({ ...value, characterName: event.target.value })} /></div>
      {(!seat || seat.rosterId) && (
        <div className="two">
          <div className="fld"><label htmlFor="re">Email</label><input id="re" type="email" maxLength={80} value={value.email || ""} placeholder="Optional" onChange={(event) => set({ ...value, email: event.target.value })} /></div>
          <div className="fld"><label htmlFor="rp">Phone</label><input id="rp" type="tel" maxLength={24} value={value.phone || ""} placeholder="Optional" onChange={(event) => set({ ...value, phone: event.target.value })} /></div>
        </div>
      )}
      {seat?.memberId && seat.role && seat.role !== "organizer" && (
        <div className="fld">
          <label htmlFor="rr">Role</label>
          <select id="rr" className="inp" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="member">Player</option>
            <option value="coorganizer">Co-organizer</option>
          </select>
        </div>
      )}
      {error && <p className="guest-err" role="alert">{error}</p>}
      <div className="two end">
        <button type="button" className="btn ghost sm" onClick={() => { setAdding(false); setEditing(null); setError(""); }}>Cancel</button>
        <button type="submit" className="btn pri sm" disabled={busy}>{busy ? "Saving…" : submit}</button>
      </div>
    </form>
  );

  return (
    <section className="card pad roster">
      <div className="sh">
        <h2>Players · {seats.length}</h2>
        {manage && !adding && <button type="button" className="btn sec sm" onClick={() => { setAdding(true); setEditing(null); setError(""); }}><Icon name="plus" className="ic sm" />Add player</button>}
        {!manage && canInvite && <Link className="btn sec sm" href={`/invites?campaign=${cid}`}><Icon name="plus" className="ic sm" />Invite</Link>}
      </div>
      <p className="note">Joined players already have an account. Invited players get a personal link to claim their seat. Polls count this list.</p>
      {adding && form(draft, setDraft, add, "Add player")}
      {roster === null && seats.length === 0 && <p className="note">Loading players…</p>}
      {roster !== null && seats.length === 0 && !adding && <p className="note">No players yet.</p>}
      {seats.length > 0 && (
        <ul className="mlist rlist">
          {seats.map((seat) => {
            const detail = [seat.characterName && seat.characterName !== seat.name ? seat.characterName : "", seat.email, seat.phone].filter(Boolean).join(" · ");
            const mine = seat.memberId === store.state.me.id;
            return (
              <li key={seat.key} className="rrow">
                {editing === seat.key ? (
                  form(edit, setEdit, (event) => save(seat, event), "Save", seat)
                ) : (
                  <>
                    <div className="mi">
                      <b>{seat.name}</b>
                      <span className="note">{[detail, mine ? "you" : "", seat.role === "organizer" ? "Organizer" : seat.role === "coorganizer" ? "Co-organizer" : ""].filter(Boolean).join(" · ")}</span>
                    </div>
                    <span className={seat.status === "joined" ? "rpill joined" : "rpill"}>{seat.status === "joined" ? "Joined" : "Invited"}</span>
                    {manage && (
                      <div className="racts">
                        {seat.token && <button type="button" className="btn sec sm" onClick={() => share(seat)}><Icon name="link" className="ic sm" />Copy/share link</button>}
                        <button type="button" className="btn ghost sm" onClick={() => { setEditing(seat.key); setEdit(fields(seat)); setRole(seat.role === "coorganizer" ? "coorganizer" : "member"); setAdding(false); setError(""); }}>Edit</button>
                        {seat.role !== "organizer" && <button type="button" className="btn ghost sm ver" onClick={() => remove(seat)}>Remove</button>}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
