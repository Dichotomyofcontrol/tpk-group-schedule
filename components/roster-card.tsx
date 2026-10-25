"use client";

import { useEffect, useRef, useState } from "react";
import { rosterJoinPath, type RosterInput, type RosterPlayer } from "@/lib/roster";
import { useStore } from "@/lib/store";
import { sharePollLink } from "./poll-view";
import { Icon } from "./ui";

const EMPTY: RosterInput = { name: "", characterName: "", email: "", phone: "" };

function fields(player?: RosterPlayer): RosterInput {
  return {
    name: player?.name || "",
    characterName: player?.characterName || "",
    email: player?.email || "",
    phone: player?.phone || "",
  };
}

export function RosterCard({ cid, manage }: { cid: string; manage: boolean }) {
  const store = useStore();
  const listRef = useRef(store.rosterList);
  listRef.current = store.rosterList;
  const gen = useRef(0);
  const [players, setPlayers] = useState<RosterPlayer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<RosterInput>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<RosterInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ticket = ++gen.current;
    listRef.current(cid).then((list) => { if (ticket === gen.current) setPlayers(list); }).catch(() => { if (ticket === gen.current) setPlayers([]); });
  }, [cid, store.state.me.id]);

  async function share(player: RosterPlayer) {
    if (!player.token) return;
    const path = rosterJoinPath(player.token);
    const url = `${window.location.origin}${path}`;
    const text = `Claim your seat as ${player.name}: ${url}`;
    const result = await sharePollLink(url, `Seat for ${player.name}`, text);
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
    setPlayers((list) => [...(list || []).filter((item) => item.id !== result.id), result]);
    setDraft(EMPTY);
    setAdding(false);
    store.flash(`${result.name} is on the roster.`);
  }

  async function save(player: RosterPlayer, event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    gen.current += 1;
    const result = await store.rosterSave(cid, player.id, {
      name: edit.name,
      characterName: edit.characterName || undefined,
      email: edit.email || undefined,
      phone: edit.phone || undefined,
    });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    setPlayers((list) => (list || []).map((item) => item.id === result.id ? result : item));
    setEditing(null);
    store.flash("Saved.");
  }

  async function remove(player: RosterPlayer) {
    if (!window.confirm(`Remove ${player.name} from the roster?`)) return;
    gen.current += 1;
    const ok = await store.rosterRemove(cid, player.id);
    if (!ok) { store.flash("Couldn't remove that player.", "err"); return; }
    setPlayers((list) => (list || []).filter((item) => item.id !== player.id));
    store.flash(`${player.name} was removed from the roster.`);
  }

  const form = (value: RosterInput, set: (next: RosterInput) => void, onSubmit: (event: React.FormEvent) => void, submit: string) => (
    <form className="rform" onSubmit={onSubmit}>
      <div className="fld"><label htmlFor="rn">Name</label><input id="rn" required maxLength={40} value={value.name} onChange={(event) => set({ ...value, name: event.target.value })} /></div>
      <div className="fld"><label htmlFor="rc">Character name</label><input id="rc" maxLength={60} value={value.characterName || ""} placeholder="Optional" onChange={(event) => set({ ...value, characterName: event.target.value })} /></div>
      <div className="two">
        <div className="fld"><label htmlFor="re">Email</label><input id="re" type="email" maxLength={80} value={value.email || ""} placeholder="Optional" onChange={(event) => set({ ...value, email: event.target.value })} /></div>
        <div className="fld"><label htmlFor="rp">Phone</label><input id="rp" type="tel" maxLength={24} value={value.phone || ""} placeholder="Optional" onChange={(event) => set({ ...value, phone: event.target.value })} /></div>
      </div>
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
        <h2>Roster{players ? ` · ${players.length}` : ""}</h2>
        {manage && !adding && <button type="button" className="btn sec sm" onClick={() => { setAdding(true); setEditing(null); setError(""); }}><Icon name="plus" className="ic sm" />Add player</button>}
      </div>
      <p className="note">Each player gets a personal link to claim their seat. Polls count this list.</p>
      {adding && form(draft, setDraft, add, "Add player")}
      {players === null && <p className="note">Loading the roster…</p>}
      {players && players.length === 0 && !adding && <p className="note">No one on the roster yet.</p>}
      {players && players.length > 0 && (
        <ul className="mlist rlist">
          {players.map((player) => (
            <li key={player.id} className="rrow">
              {editing === player.id ? (
                form(edit, setEdit, (event) => save(player, event), "Save")
              ) : (
                <>
                  <div className="mi">
                    <b>{player.name}</b>
                    <span className="note">{[player.characterName, player.email, player.phone].filter(Boolean).join(" · ")}</span>
                  </div>
                  <span className={player.status === "joined" ? "rpill joined" : "rpill"}>{player.status === "joined" ? "Joined" : "Invited"}</span>
                  {manage && (
                    <div className="racts">
                      {player.token && <button type="button" className="btn sec sm" onClick={() => share(player)}><Icon name="link" className="ic sm" />Copy/share link</button>}
                      <button type="button" className="btn ghost sm" onClick={() => { setEditing(player.id); setEdit(fields(player)); setAdding(false); setError(""); }}>Edit</button>
                      <button type="button" className="btn ghost sm ver" onClick={() => remove(player)}>Remove</button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
