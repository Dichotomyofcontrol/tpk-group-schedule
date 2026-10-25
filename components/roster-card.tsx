"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { rosterJoinPath, seatLabel, unifyPlayers, type RosterInput, type RosterPlayer, type TableSeat } from "@/lib/roster";
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
  const [menu, setMenu] = useState<string | null>(null);
  const [menuUp, setMenuUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ticket = ++gen.current;
    listRef.current(cid).then((list) => { if (ticket === gen.current) setRoster(list); }).catch(() => { if (ticket === gen.current) setRoster([]); });
  }, [cid, store.state.me.id]);

  const seats = unifyPlayers(members, roster || []);

  async function share(seat: TableSeat) {
    if (!seat.token || !seat.rosterId) return;
    setMenu(null);
    const path = rosterJoinPath(seat.token);
    const url = `${window.location.origin}${path}`;
    const result = await sharePollLink(url, `Seat for ${seat.name}`, `Claim your seat as ${seat.name}`);
    if (result === "aborted") return;
    if (result === "failed") { store.flash("Couldn't copy the link.", "err"); return; }
    const saved = await store.rosterShare(cid, seat.rosterId);
    if ("error" in saved) { store.flash(saved.error, "err"); return; }
    setRoster((list) => (list || []).map((item) => item.id === saved.id ? saved : item));
    store.flash(result === "shared" ? "Link shared." : "Link copied. Send it to them.");
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
      {manage && <p className="note">A seat stays not invited until you copy its link. Polls count this list.</p>}
      {adding && form(draft, setDraft, add, "Add player")}
      {roster === null && seats.length === 0 && <p className="note">Loading players…</p>}
      {roster !== null && seats.length === 0 && !adding && <p className="note">No players yet.</p>}
      {seats.length > 0 && (
        <ul className="mlist rlist">
          {seats.map((seat) => {
            const character = seat.characterName && seat.characterName !== seat.name ? seat.characterName : "";
            const label = seatLabel(seat);
            const open = menu === seat.key;
            return (
              <li key={seat.key} className={editing === seat.key ? "prow editing" : "prow"}>
                {editing === seat.key ? (
                  form(edit, setEdit, (event) => save(seat, event), "Save", seat)
                ) : (
                  <>
                    <div className="mi">
                      <b>{seat.name}</b>
                      {character && <span className="sub">{character}</span>}
                    </div>
                    <span className={label === "Joined" ? "rpill joined" : label === "Link copied" ? "rpill copied" : "rpill"}>{label}</span>
                    {manage && (
                      <div className="prow-acts">
                        {seat.token && seat.status !== "joined" && (
                          <button type="button" className="iconbtn" title="Copy link" aria-label={`Copy invite link for ${seat.name}`} onClick={() => share(seat)}>
                            <Icon name="link" className="ic sm" />
                          </button>
                        )}
                        <div className="mwrap">
                          <button type="button" className="iconbtn" aria-label={`Actions for ${seat.name}`} aria-haspopup="menu" aria-expanded={open} onClick={(event) => {
                            if (open) { setMenu(null); return; }
                            setMenuUp(event.currentTarget.getBoundingClientRect().bottom > window.innerHeight - 160);
                            setMenu(seat.key);
                          }}>
                            <Icon name="dots" />
                          </button>
                          {open && (
                            <>
                              <button className="mscrim" type="button" aria-label="Close" onClick={() => setMenu(null)} />
                              <div className={menuUp ? "fmenu up" : "fmenu"} role="menu">
                                <button role="menuitem" type="button" onClick={() => { setMenu(null); setEditing(seat.key); setEdit(fields(seat)); setRole(seat.role === "coorganizer" ? "coorganizer" : "member"); setAdding(false); setError(""); }}>Edit</button>
                                {seat.role !== "organizer" && <button role="menuitem" type="button" className="ver" onClick={() => { setMenu(null); remove(seat); }}>Remove</button>}
                              </div>
                            </>
                          )}
                        </div>
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
