"use client";

import { useState } from "react";
import { isStaff } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Session } from "@/lib/types";
import { Icon } from "./ui";

/** A short note from the organizer to everyone coming: what to bring, where to meet, prep. Organizers edit; everyone reads. */
export function TableNote({ session }: { session: Session }) {
  const store = useStore();
  const staff = isStaff(store.state, session.cid);
  const note = (session.notes || "").trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  if (!note && !staff) return null;

  if (editing) {
    return (
      <section className="card pad tnote" aria-labelledby="tn-h">
        <form onSubmit={(e) => {
          e.preventDefault();
          store.editSession(session.id, { notes: draft.trim().slice(0, 600) });
          setEditing(false);
          store.flash(draft.trim() ? "Note saved." : "Note removed.");
        }}>
          <div className="field">
            <label id="tn-h" htmlFor="tn-text">Note for the table</label>
            <textarea id="tn-text" rows={3} maxLength={600} autoFocus value={draft} placeholder="Bring your sheets. We pick up at the docks." onChange={(e) => setDraft(e.target.value)} />
          </div>
          <div className="tn-actions">
            <button type="button" className="btn ghost sm" onClick={() => { setDraft(note); setEditing(false); }}>Cancel</button>
            <button type="submit" className="btn pri sm">Save</button>
          </div>
        </form>
      </section>
    );
  }

  if (!note) {
    return (
      <button type="button" className="card tnote-add" onClick={() => { setDraft(""); setEditing(true); }}>
        <Icon name="plus" className="ic sm" />Add a note for the table
      </button>
    );
  }

  return (
    <section className="card pad tnote" aria-labelledby="tn-h">
      <div className="sh">
        <h2 id="tn-h">Note for the table</h2>
        {staff && <button type="button" className="btn ghost sm" onClick={() => { setDraft(note); setEditing(true); }}>Edit</button>}
      </div>
      <p className="tn-body">{note}</p>
    </section>
  );
}
